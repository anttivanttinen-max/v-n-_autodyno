#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "usb/usb_host.h"

// MotoLab / Zeeltronic ESP32-S3 bridge — stage 1 USB probe
// Target: generic ESP32-S3 N16R8, native USB-OTG port connected to Zeeltronic PC-USB cable.
// BLE stays available while the USB-OTG peripheral is in HOST mode.
// This firmware does NOT alter CDI settings. It only enumerates the programmer cable
// and reports the exact USB VID/PID/class so the transport driver can be locked down.

static const char *FW = "motolab-zeel-usb-probe-v1";
static const char *BLE_NAME = "MotoLab-Zeel";
static const char *SERVICE_UUID = "7d7d0001-7a45-4545-4c54-524f4e494301";
static const char *STATUS_UUID  = "7d7d0002-7a45-4545-4c54-524f4e494301";

static BLECharacteristic *statusChar = nullptr;
static usb_host_client_handle_t clientHandle = nullptr;
static usb_device_handle_t deviceHandle = nullptr;
static volatile uint8_t pendingAddress = 0;
static volatile bool deviceGone = false;

static void publish(const String &msg) {
  Serial0.println(msg);
  if (statusChar) {
    statusChar->setValue(msg.c_str());
    statusChar->notify();
  }
}

static void usbClientEvent(const usb_host_client_event_msg_t *eventMsg, void *) {
  if (!eventMsg) return;
  switch (eventMsg->event) {
    case USB_HOST_CLIENT_EVENT_NEW_DEV:
      pendingAddress = eventMsg->new_dev.address;
      publish(String("USB NEW address=") + pendingAddress);
      break;
    case USB_HOST_CLIENT_EVENT_DEV_GONE:
      deviceGone = true;
      publish("USB DISCONNECTED");
      break;
    default:
      break;
  }
}

static void usbDaemonTask(void *) {
  const usb_host_config_t hostConfig = {
    .skip_phy_setup = false,
    .intr_flags = ESP_INTR_FLAG_LEVEL1,
  };

  esp_err_t err = usb_host_install(&hostConfig);
  if (err != ESP_OK) {
    publish(String("USB HOST INSTALL ERROR ") + esp_err_to_name(err));
    vTaskDelete(nullptr);
    return;
  }
  publish("USB HOST READY");

  while (true) {
    uint32_t flags = 0;
    usb_host_lib_handle_events(pdMS_TO_TICKS(1000), &flags);
    if (flags & USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS) {
      usb_host_device_free_all();
    }
  }
}

static void usbClientTask(void *) {
  delay(250);
  const usb_host_client_config_t clientConfig = {
    .is_synchronous = false,
    .max_num_event_msg = 5,
    .async = {
      .client_event_callback = usbClientEvent,
      .callback_arg = nullptr,
    }
  };

  esp_err_t err = usb_host_client_register(&clientConfig, &clientHandle);
  if (err != ESP_OK) {
    publish(String("USB CLIENT ERROR ") + esp_err_to_name(err));
    vTaskDelete(nullptr);
    return;
  }
  publish("USB CLIENT READY — connect Zeeltronic PC-USB cable");

  while (true) {
    usb_host_client_handle_events(clientHandle, pdMS_TO_TICKS(100));

    if (deviceGone && deviceHandle) {
      usb_host_device_close(clientHandle, deviceHandle);
      deviceHandle = nullptr;
      deviceGone = false;
    }

    uint8_t addr = pendingAddress;
    if (addr && !deviceHandle) {
      pendingAddress = 0;
      err = usb_host_device_open(clientHandle, addr, &deviceHandle);
      if (err != ESP_OK) {
        publish(String("USB OPEN ERROR ") + esp_err_to_name(err));
        continue;
      }

      const usb_device_desc_t *d = nullptr;
      err = usb_host_get_device_descriptor(deviceHandle, &d);
      if (err != ESP_OK || !d) {
        publish(String("USB DESCRIPTOR ERROR ") + esp_err_to_name(err));
        continue;
      }

      char line[192];
      snprintf(line, sizeof(line),
               "ZEEL USB VID=%04X PID=%04X class=%02X subclass=%02X proto=%02X configs=%u maxpkt0=%u",
               d->idVendor, d->idProduct, d->bDeviceClass, d->bDeviceSubClass,
               d->bDeviceProtocol, d->bNumConfigurations, d->bMaxPacketSize0);
      publish(line);

      if (d->idVendor == 0x0403) {
        publish("FTDI VID detected — next firmware can use FTDI bulk/control transport");
      } else {
        publish("USB identity captured — use VID/PID above for the final Zeel transport driver");
      }
    }
  }
}

void setup() {
  Serial0.begin(115200);
  delay(150);
  Serial0.println();
  Serial0.println(FW);

  BLEDevice::init(BLE_NAME);
  BLEServer *server = BLEDevice::createServer();
  BLEService *service = server->createService(SERVICE_UUID);
  statusChar = service->createCharacteristic(
    STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusChar->addDescriptor(new BLE2902());
  statusChar->setValue("BOOTING");
  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();

  publish(String("READY ") + FW + " BLE=" + BLE_NAME);

  xTaskCreatePinnedToCore(usbDaemonTask, "usb-daemon", 4096, nullptr, 5, nullptr, 0);
  xTaskCreatePinnedToCore(usbClientTask, "usb-client", 6144, nullptr, 4, nullptr, 1);
}

void loop() {
  delay(1000);
}
