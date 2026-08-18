#include <Arduino.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include "usb/usb_host.h"

// MotoLab / Zeeltronic ESP32-S3 bridge - v2.3 read-only capture firmware.
// Target: ESP32-S3 N16R8 with Arduino-ESP32 3.3.11.
// Native USB-OTG: Zeeltronic PC-USB FTDI 0403:6001.
// UART0 / board Single Serial (CH343): debug and lossless protocol capture.
// Safety: every boot and every USB reconnect starts read-only.

static const char *FW = "motolab-zeel-ftdi-capture-v2.3";
static const char *BLE_NAME = "MotoLab-Zeel";
static const char *SERVICE_UUID = "7d7d0001-7a45-4545-4c54-524f4e494301";
static const char *STATUS_UUID  = "7d7d0002-7a45-4545-4c54-524f4e494301";
static const char *RX_UUID      = "7d7d0003-7a45-4545-4c54-524f4e494301";
static const char *TX_UUID      = "7d7d0004-7a45-4545-4c54-524f4e494301";
static const char *CFG_UUID     = "7d7d0005-7a45-4545-4c54-524f4e494301";

static const uint16_t ZEEL_VID = 0x0403;
static const uint16_t ZEEL_PID = 0x6001;
static const size_t BLE_CHUNK = 180;  // Fits the requested 247-byte ATT MTU.

static BLECharacteristic *statusChar = nullptr;
static BLECharacteristic *rxChar = nullptr;
static BLECharacteristic *txChar = nullptr;
static BLECharacteristic *cfgChar = nullptr;
static usb_host_client_handle_t clientHandle = nullptr;
static usb_device_handle_t deviceHandle = nullptr;

static volatile uint8_t pendingAddress = 0;
static volatile bool deviceGone = false;
static volatile bool bleConnected = false;
static volatile bool ftdiReady = false;
static volatile bool rxTransferActive = false;
static bool writeUnlocked = false;
static uint8_t epIn = 0;
static uint8_t epOut = 0;
static uint8_t claimedInterface = 0xFF;
static uint16_t epInMps = 64;
static uint16_t epOutMps = 64;
static uint32_t baudRate = 115200;
static uint64_t rxBytes = 0;
static uint64_t txBytes = 0;
static uint32_t rxPackets = 0;
static uint32_t txPackets = 0;
static uint32_t connectCount = 0;
static uint32_t disconnectCount = 0;
static uint32_t transferErrors = 0;
static uint32_t blockedWrites = 0;
static uint32_t sessionStartMs = 0;
static uint32_t lastRxMs = 0;
static uint32_t lastTxMs = 0;

static String hexBytes(const uint8_t *data, size_t length, size_t maxLength = 96) {
  static const char *hex = "0123456789ABCDEF";
  String result;
  const size_t shown = min(length, maxLength);
  result.reserve(shown * 3 + 16);
  for (size_t i = 0; i < shown; ++i) {
    if (i) result += ' ';
    result += hex[data[i] >> 4];
    result += hex[data[i] & 0x0F];
  }
  if (length > shown) result += " ...";
  return result;
}

static void notifyText(BLECharacteristic *characteristic, const String &message) {
  if (!characteristic || !bleConnected) return;
  const size_t length = message.length();
  for (size_t offset = 0; offset < length; offset += BLE_CHUNK) {
    const size_t count = min(BLE_CHUNK, length - offset);
    characteristic->setValue((uint8_t *)message.c_str() + offset, count);
    characteristic->notify();
    delay(2);
  }
}

static void publish(const String &message) {
  Serial0.print('[');
  Serial0.print(millis());
  Serial0.print("] ");
  Serial0.println(message);
  notifyText(statusChar, message);
}

static void captureLine(const char *direction, const uint8_t *data, size_t length) {
  Serial0.print("CAP,");
  Serial0.print(millis());
  Serial0.print(',');
  Serial0.print(direction);
  Serial0.print(',');
  Serial0.print(length);
  Serial0.print(',');
  Serial0.println(hexBytes(data, length));
}

static void notifyRx(const uint8_t *data, size_t length) {
  if (!rxChar || !bleConnected) return;
  for (size_t offset = 0; offset < length; offset += BLE_CHUNK) {
    const size_t count = min(BLE_CHUNK, length - offset);
    rxChar->setValue(data + offset, count);
    rxChar->notify();
    delay(2);
  }
}

struct ControlContext {
  volatile bool done;
  usb_transfer_status_t status;
};

static void controlDone(usb_transfer_t *transfer) {
  ControlContext *context = static_cast<ControlContext *>(transfer->context);
  if (context) {
    context->status = transfer->status;
    context->done = true;
  }
}

static esp_err_t controlOut(uint8_t request, uint16_t value, uint16_t index = 0) {
  if (!deviceHandle || !clientHandle) return ESP_ERR_INVALID_STATE;
  usb_transfer_t *transfer = nullptr;
  esp_err_t error = usb_host_transfer_alloc(sizeof(usb_setup_packet_t), 0, &transfer);
  if (error != ESP_OK) return error;

  usb_setup_packet_t *setup = reinterpret_cast<usb_setup_packet_t *>(transfer->data_buffer);
  setup->bmRequestType = 0x40;
  setup->bRequest = request;
  setup->wValue = value;
  setup->wIndex = index;
  setup->wLength = 0;

  ControlContext context = {false, USB_TRANSFER_STATUS_ERROR};
  transfer->device_handle = deviceHandle;
  transfer->bEndpointAddress = 0;
  transfer->callback = controlDone;
  transfer->context = &context;
  transfer->num_bytes = sizeof(usb_setup_packet_t);
  error = usb_host_transfer_submit_control(clientHandle, transfer);
  if (error == ESP_OK) {
    while (!context.done) {
      usb_host_client_handle_events(clientHandle, pdMS_TO_TICKS(20));
    }
    if (context.status != USB_TRANSFER_STATUS_COMPLETED) error = ESP_FAIL;
  }
  if (error != ESP_OK) ++transferErrors;
  usb_host_transfer_free(transfer);
  return error;
}

static bool ftdiBaudValue(uint32_t baud, uint16_t &value, uint16_t &index) {
  index = 0;
  switch (baud) {
    case 9600: value = 0x4138; return true;
    case 19200: value = 0x809C; return true;
    case 38400: value = 0xC04E; return true;
    case 57600: value = 0x0034; return true;
    case 115200: value = 0x001A; return true;
    case 230400: value = 0x000D; return true;
    case 460800: value = 0x4006; return true;
    case 921600: value = 0x8003; return true;
    default: return false;
  }
}

static bool configureFtdi(uint32_t baud) {
  if (!ftdiReady) return false;
  uint16_t value = 0;
  uint16_t index = 0;
  if (!ftdiBaudValue(baud, value, index)) {
    publish("UNSUPPORTED BAUD");
    return false;
  }
  // SIO_RESET, SIO_SET_DATA (8N1), SIO_SET_BAUD_RATE, SIO_SET_FLOW_CTRL.
  if (controlOut(0, 0) != ESP_OK || controlOut(4, 0x0008) != ESP_OK ||
      controlOut(3, value, index) != ESP_OK || controlOut(2, 0) != ESP_OK) {
    publish("FTDI CONTROL ERROR");
    return false;
  }
  // Capture mode deliberately does not pulse DTR/RTS.
  baudRate = baud;
  const String mode = writeUnlocked ? "BRIDGE" : "READONLY";
  const String cfg = String("BAUD=") + baudRate + ";MODE=" + mode;
  if (cfgChar) cfgChar->setValue(cfg.c_str());
  publish(String("FTDI CONFIGURED ") + baudRate + " 8N1 MODE=" + mode);
  return true;
}

static void dumpConfigDescriptor() {
  const usb_config_desc_t *config = nullptr;
  if (usb_host_get_active_config_descriptor(deviceHandle, &config) != ESP_OK || !config) return;
  publish(String("USB CFG total=") + config->wTotalLength + " interfaces=" + config->bNumInterfaces);
  const uint8_t *cursor = reinterpret_cast<const uint8_t *>(config);
  const uint8_t *end = cursor + config->wTotalLength;
  while (cursor + 2 <= end) {
    const uint8_t length = cursor[0];
    const uint8_t type = cursor[1];
    if (length < 2 || cursor + length > end) break;
    if (type == USB_B_DESCRIPTOR_TYPE_INTERFACE && length >= sizeof(usb_intf_desc_t)) {
      const usb_intf_desc_t *interfaceDesc = reinterpret_cast<const usb_intf_desc_t *>(cursor);
      publish(String("USB IF num=") + interfaceDesc->bInterfaceNumber + " alt=" +
              interfaceDesc->bAlternateSetting + " class=" + String(interfaceDesc->bInterfaceClass, HEX) +
              " sub=" + String(interfaceDesc->bInterfaceSubClass, HEX) + " proto=" +
              String(interfaceDesc->bInterfaceProtocol, HEX) + " eps=" + interfaceDesc->bNumEndpoints);
    } else if (type == USB_B_DESCRIPTOR_TYPE_ENDPOINT && length >= sizeof(usb_ep_desc_t)) {
      const usb_ep_desc_t *endpoint = reinterpret_cast<const usb_ep_desc_t *>(cursor);
      publish(String("USB EP addr=0x") + String(endpoint->bEndpointAddress, HEX) + " attr=0x" +
              String(endpoint->bmAttributes, HEX) + " mps=" + endpoint->wMaxPacketSize +
              " interval=" + endpoint->bInterval);
    }
    cursor += length;
  }
}

static bool findAndClaimBulkEndpoints() {
  const usb_config_desc_t *config = nullptr;
  if (usb_host_get_active_config_descriptor(deviceHandle, &config) != ESP_OK || !config) return false;
  const uint8_t *cursor = reinterpret_cast<const uint8_t *>(config);
  const uint8_t *end = cursor + config->wTotalLength;
  uint8_t currentInterface = 0xFF;
  epIn = 0;
  epOut = 0;
  claimedInterface = 0xFF;
  while (cursor + 2 <= end) {
    const uint8_t length = cursor[0];
    const uint8_t type = cursor[1];
    if (length < 2 || cursor + length > end) break;
    if (type == USB_B_DESCRIPTOR_TYPE_INTERFACE && length >= sizeof(usb_intf_desc_t)) {
      currentInterface = reinterpret_cast<const usb_intf_desc_t *>(cursor)->bInterfaceNumber;
    } else if (type == USB_B_DESCRIPTOR_TYPE_ENDPOINT && length >= sizeof(usb_ep_desc_t)) {
      const usb_ep_desc_t *endpoint = reinterpret_cast<const usb_ep_desc_t *>(cursor);
      if ((endpoint->bmAttributes & 0x03) == USB_BM_ATTRIBUTES_XFER_BULK) {
        if (claimedInterface == 0xFF) claimedInterface = currentInterface;
        if (endpoint->bEndpointAddress & 0x80) {
          epIn = endpoint->bEndpointAddress;
          epInMps = endpoint->wMaxPacketSize;
        } else {
          epOut = endpoint->bEndpointAddress;
          epOutMps = endpoint->wMaxPacketSize;
        }
      }
    }
    cursor += length;
  }
  if (!epIn || !epOut || claimedInterface == 0xFF) return false;
  const esp_err_t error = usb_host_interface_claim(clientHandle, deviceHandle, claimedInterface, 0);
  if (error != ESP_OK) {
    publish(String("USB CLAIM ERROR ") + esp_err_to_name(error));
    claimedInterface = 0xFF;
    return false;
  }
  return true;
}

static void txDone(usb_transfer_t *transfer) {
  if (transfer->status == USB_TRANSFER_STATUS_COMPLETED) {
    txBytes += transfer->actual_num_bytes;
    ++txPackets;
    lastTxMs = millis();
    captureLine("TX", transfer->data_buffer, transfer->actual_num_bytes);
  } else {
    ++transferErrors;
    publish(String("USB TX ERROR status=") + static_cast<int>(transfer->status));
  }
  usb_host_transfer_free(transfer);
}

static bool sendFtdi(const uint8_t *data, size_t length) {
  if (!writeUnlocked) {
    ++blockedWrites;
    captureLine("TX_BLOCKED", data, length);
    publish(String("TX BLOCKED READ-ONLY bytes=") + length);
    return false;
  }
  if (!ftdiReady || !epOut || !deviceHandle || !length) return false;
  usb_transfer_t *transfer = nullptr;
  if (usb_host_transfer_alloc(length, 0, &transfer) != ESP_OK) return false;
  memcpy(transfer->data_buffer, data, length);
  transfer->num_bytes = length;
  transfer->device_handle = deviceHandle;
  transfer->bEndpointAddress = epOut;
  transfer->callback = txDone;
  transfer->context = nullptr;
  const esp_err_t error = usb_host_transfer_submit(transfer);
  if (error != ESP_OK) {
    ++transferErrors;
    usb_host_transfer_free(transfer);
    publish(String("USB TX SUBMIT ERROR ") + esp_err_to_name(error));
    return false;
  }
  return true;
}

static void rxDone(usb_transfer_t *transfer) {
  if (transfer->status == USB_TRANSFER_STATUS_COMPLETED) {
    ++rxPackets;
    if (transfer->actual_num_bytes >= 2) {
      Serial0.print("FTDI_STATUS,");
      Serial0.print(millis());
      Serial0.print(',');
      Serial0.print(transfer->data_buffer[0], HEX);
      Serial0.print(',');
      Serial0.println(transfer->data_buffer[1], HEX);
      const uint8_t *payload = transfer->data_buffer + 2;
      const size_t payloadLength = transfer->actual_num_bytes - 2;
      if (payloadLength) {
        rxBytes += payloadLength;
        lastRxMs = millis();
        captureLine("RX", payload, payloadLength);
        notifyRx(payload, payloadLength);
      }
    }
  } else if (transfer->status != USB_TRANSFER_STATUS_CANCELED && !deviceGone) {
    ++transferErrors;
    publish(String("USB RX ERROR status=") + static_cast<int>(transfer->status));
  }

  if (ftdiReady && deviceHandle && !deviceGone) {
    transfer->num_bytes = transfer->data_buffer_size;
    if (usb_host_transfer_submit(transfer) == ESP_OK) return;
    ++transferErrors;
  }
  rxTransferActive = false;
  usb_host_transfer_free(transfer);
}

static bool startRx() {
  if (rxTransferActive) return true;
  usb_transfer_t *transfer = nullptr;
  const size_t size = max<size_t>(64, epInMps);
  if (usb_host_transfer_alloc(size, 0, &transfer) != ESP_OK) return false;
  transfer->device_handle = deviceHandle;
  transfer->bEndpointAddress = epIn;
  transfer->callback = rxDone;
  transfer->context = nullptr;
  transfer->num_bytes = size;
  rxTransferActive = true;
  if (usb_host_transfer_submit(transfer) != ESP_OK) {
    rxTransferActive = false;
    usb_host_transfer_free(transfer);
    return false;
  }
  return true;
}

static String statsLine() {
  char line[240];
  snprintf(line, sizeof(line),
           "STATS rxB=%llu txB=%llu rxP=%lu txP=%lu blocked=%lu err=%lu usbConnect=%lu "
           "usbDisconnect=%lu upMs=%lu mode=%s",
           (unsigned long long)rxBytes, (unsigned long long)txBytes, (unsigned long)rxPackets,
           (unsigned long)txPackets, (unsigned long)blockedWrites, (unsigned long)transferErrors,
           (unsigned long)connectCount, (unsigned long)disconnectCount,
           (unsigned long)(sessionStartMs ? millis() - sessionStartMs : 0),
           writeUnlocked ? "BRIDGE" : "READONLY");
  return String(line);
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    bleConnected = true;
    publish("BLE CONNECTED");
  }
  void onDisconnect(BLEServer *) override {
    bleConnected = false;
    BLEDevice::startAdvertising();
    Serial0.println("BLE DISCONNECTED; ADVERTISING RESTARTED");
  }
};

class TxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const size_t length = characteristic->getLength();
    const uint8_t *data = characteristic->getData();
    if (data && length) sendFtdi(data, length);
  }
};

class CfgCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String command = characteristic->getValue();
    command.trim();
    command.toUpperCase();
    if (command.startsWith("BAUD=")) {
      configureFtdi(static_cast<uint32_t>(command.substring(5).toInt()));
    } else if (command == "STATUS") {
      publish(statsLine());
    } else if (command == "INFO") {
      publish(String("INFO fw=") + FW + " vid=0403 pid=6001 baud=" + baudRate);
    } else if (command == "LOCK") {
      writeUnlocked = false;
      publish("WRITE LOCKED - READ ONLY");
    } else if (command == "UNLOCK_WRITE_I_ACCEPT_RISK") {
      writeUnlocked = true;
      publish("WRITE UNLOCKED - BRIDGE MODE");
    } else {
      publish(String("CFG UNKNOWN: ") + command);
    }
  }
};

static void usbClientEvent(const usb_host_client_event_msg_t *message, void *) {
  if (!message) return;
  if (message->event == USB_HOST_CLIENT_EVENT_NEW_DEV) {
    pendingAddress = message->new_dev.address;
    publish(String("USB NEW address=") + pendingAddress);
  } else if (message->event == USB_HOST_CLIENT_EVENT_DEV_GONE) {
    ftdiReady = false;
    writeUnlocked = false;
    deviceGone = true;
    publish("USB DISCONNECTED; WRITE RELOCKED");
  }
}

static void closeDevice() {
  ftdiReady = false;
  writeUnlocked = false;
  if (!deviceHandle) return;
  if (epIn) {
    usb_host_endpoint_halt(deviceHandle, epIn);
    usb_host_endpoint_flush(deviceHandle, epIn);
  }
  const uint32_t deadline = millis() + 500;
  while (rxTransferActive && static_cast<int32_t>(deadline - millis()) > 0) {
    usb_host_client_handle_events(clientHandle, pdMS_TO_TICKS(20));
  }
  if (claimedInterface != 0xFF) {
    usb_host_interface_release(clientHandle, deviceHandle, claimedInterface);
  }
  usb_host_device_close(clientHandle, deviceHandle);
  deviceHandle = nullptr;
  claimedInterface = 0xFF;
  epIn = 0;
  epOut = 0;
  deviceGone = false;
  ++disconnectCount;
  publish("SESSION CLOSED; READY FOR RECONNECT");
}

static void rejectOpenDevice(const String &reason) {
  publish(reason);
  if (deviceHandle) usb_host_device_close(clientHandle, deviceHandle);
  deviceHandle = nullptr;
  pendingAddress = 0;
}

static void openPendingDevice() {
  const uint8_t address = pendingAddress;
  if (!address || deviceHandle) return;
  pendingAddress = 0;
  esp_err_t error = usb_host_device_open(clientHandle, address, &deviceHandle);
  if (error != ESP_OK) {
    publish(String("USB OPEN ERROR ") + esp_err_to_name(error));
    return;
  }
  const usb_device_desc_t *descriptor = nullptr;
  error = usb_host_get_device_descriptor(deviceHandle, &descriptor);
  if (error != ESP_OK || !descriptor) {
    rejectOpenDevice("USB DESCRIPTOR ERROR");
    return;
  }
  char line[180];
  snprintf(line, sizeof(line),
           "USB DEV VID=%04X PID=%04X bcd=%04X class=%02X sub=%02X proto=%02X mps0=%u cfgs=%u",
           descriptor->idVendor, descriptor->idProduct, descriptor->bcdDevice,
           descriptor->bDeviceClass, descriptor->bDeviceSubClass, descriptor->bDeviceProtocol,
           descriptor->bMaxPacketSize0, descriptor->bNumConfigurations);
  publish(line);
  dumpConfigDescriptor();
  if (descriptor->idVendor != ZEEL_VID || descriptor->idProduct != ZEEL_PID) {
    rejectOpenDevice("NOT ZEEL FTDI 0403:6001 - CAPTURE REFUSED");
    return;
  }
  if (!findAndClaimBulkEndpoints()) {
    rejectOpenDevice("FTDI BULK ENDPOINTS NOT FOUND");
    return;
  }
  snprintf(line, sizeof(line), "FTDI READY if=%u epIN=0x%02X mps=%u epOUT=0x%02X mps=%u",
           claimedInterface, epIn, epInMps, epOut, epOutMps);
  publish(line);
  ftdiReady = true;
  writeUnlocked = false;
  sessionStartMs = millis();
  rxBytes = 0;
  txBytes = 0;
  rxPackets = 0;
  txPackets = 0;
  blockedWrites = 0;
  transferErrors = 0;
  ++connectCount;
  if (!configureFtdi(baudRate)) {
    publish("FTDI CONFIGURATION FAILED");
    return;
  }
  if (!startRx()) publish("FTDI RX START ERROR");
}

static void usbDaemonTask(void *) {
  usb_host_config_t config = {};
  config.skip_phy_setup = false;
  config.intr_flags = ESP_INTR_FLAG_LEVEL1;
  const esp_err_t error = usb_host_install(&config);
  if (error != ESP_OK) {
    publish(String("USB HOST INSTALL ERROR ") + esp_err_to_name(error));
    vTaskDelete(nullptr);
    return;
  }
  publish("USB HOST READY");
  while (true) {
    uint32_t flags = 0;
    usb_host_lib_handle_events(pdMS_TO_TICKS(1000), &flags);
    if (flags & USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS) usb_host_device_free_all();
  }
}

static void usbClientTask(void *) {
  delay(250);
  usb_host_client_config_t config = {};
  config.is_synchronous = false;
  config.max_num_event_msg = 8;
  config.async.client_event_callback = usbClientEvent;
  config.async.callback_arg = nullptr;
  const esp_err_t error = usb_host_client_register(&config, &clientHandle);
  if (error != ESP_OK) {
    publish(String("USB CLIENT ERROR ") + esp_err_to_name(error));
    vTaskDelete(nullptr);
    return;
  }
  publish("USB CLIENT READY - connect Zeeltronic PC-USB cable");
  while (true) {
    usb_host_client_handle_events(clientHandle, pdMS_TO_TICKS(100));
    if (deviceGone) closeDevice();
    openPendingDevice();
  }
}

void setup() {
  Serial0.begin(115200);
  delay(150);
  Serial0.println();
  Serial0.println(FW);

  BLEDevice::init(BLE_NAME);
  BLEDevice::setMTU(247);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);
  statusChar = service->createCharacteristic(
      STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  statusChar->addDescriptor(new BLE2902());
  rxChar = service->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  rxChar->addDescriptor(new BLE2902());
  txChar = service->createCharacteristic(
      TX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  txChar->setCallbacks(new TxCallbacks());
  cfgChar = service->createCharacteristic(
      CFG_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  cfgChar->setCallbacks(new CfgCallbacks());
  cfgChar->setValue("BAUD=115200;MODE=READONLY");
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  publish(String("READY ") + FW + " BLE=" + BLE_NAME + " SAFE=READ_ONLY");
  xTaskCreatePinnedToCore(usbDaemonTask, "usb-daemon", 4096, nullptr, 5, nullptr, 0);
  xTaskCreatePinnedToCore(usbClientTask, "usb-client", 8192, nullptr, 4, nullptr, 1);
}

void loop() {
  delay(5000);
  if (ftdiReady) publish(String("HEARTBEAT ") + statsLine());
}

