#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "usb/usb_host.h"

// MotoLab / Zeeltronic ESP32-S3 bridge — stage 2 FTDI transport
// Target: ESP32-S3 N16R8. PC/debug stays on the board's Single Serial UART bridge.
// Native USB-OTG port is dedicated to the Zeeltronic PC-USB cable (FTDI 0403:6001).
// This stage exposes a transparent BLE byte pipe and configurable FTDI baud rate.
// It does NOT change ignition/CDI settings on its own.

static const char *FW = "motolab-zeel-ftdi-bridge-v2";
static const char *BLE_NAME = "MotoLab-Zeel";
static const char *SERVICE_UUID = "7d7d0001-7a45-4545-4c54-524f4e494301";
static const char *STATUS_UUID  = "7d7d0002-7a45-4545-4c54-524f4e494301";
static const char *RX_UUID      = "7d7d0003-7a45-4545-4c54-524f4e494301"; // Zeel -> phone notify
static const char *TX_UUID      = "7d7d0004-7a45-4545-4c54-524f4e494301"; // phone -> Zeel write
static const char *CFG_UUID     = "7d7d0005-7a45-4545-4c54-524f4e494301"; // ASCII: BAUD=115200

static BLECharacteristic *statusChar=nullptr,*rxChar=nullptr,*txChar=nullptr,*cfgChar=nullptr;
static usb_host_client_handle_t clientHandle=nullptr;
static usb_device_handle_t deviceHandle=nullptr;
static volatile uint8_t pendingAddress=0;
static volatile bool deviceGone=false;
static bool ftdiReady=false;
static uint8_t epIn=0,epOut=0;
static uint16_t epInMps=64,epOutMps=64;
static uint32_t baudRate=115200;

static void publish(const String &msg){
  Serial0.println(msg);
  if(statusChar){statusChar->setValue(msg.c_str());statusChar->notify();}
}

static esp_err_t controlOut(uint8_t req,uint16_t value,uint16_t index=0){
  if(!deviceHandle)return ESP_ERR_INVALID_STATE;
  usb_transfer_t *t=nullptr;
  esp_err_t e=usb_host_transfer_alloc(0,0,&t); if(e!=ESP_OK)return e;
  t->device_handle=deviceHandle;
  t->bEndpointAddress=0;
  t->callback=nullptr;
  t->context=nullptr;
  t->num_bytes=0;
  t->setup.bmRequestType=0x40; // vendor, device, OUT
  t->setup.bRequest=req;
  t->setup.wValue=value;
  t->setup.wIndex=index;
  t->setup.wLength=0;
  e=usb_host_transfer_submit_control(clientHandle,t);
  if(e==ESP_OK){
    uint32_t start=millis();
    while(t->status==USB_TRANSFER_STATUS_COMPLETED && millis()-start<2) delay(1);
    delay(5);
  }
  usb_host_transfer_free(t);
  return e;
}

// FT232R common baud encodings (FTDI SIO_SET_BAUD_RATE request 3).
// Add more values if ZeelProg capture proves a different rate.
static bool ftdiBaudValue(uint32_t baud,uint16_t &value,uint16_t &index){
  index=0;
  switch(baud){
    case 9600: value=0x4138; return true;
    case 19200: value=0x809C; return true;
    case 38400: value=0xC04E; return true;
    case 57600: value=0x0034; return true;
    case 115200: value=0x001A; return true;
    case 230400: value=0x000D; return true;
    case 460800: value=0x4006; return true;
    case 921600: value=0x8003; return true;
    default:return false;
  }
}

static bool configureFtdi(uint32_t baud){
  if(!ftdiReady)return false;
  uint16_t v=0,i=0;if(!ftdiBaudValue(baud,v,i)){publish("UNSUPPORTED BAUD");return false;}
  // Reset, 8N1, baud, disable flow control, assert DTR/RTS.
  if(controlOut(0,0)!=ESP_OK)return false;             // SIO_RESET
  if(controlOut(4,0x0008)!=ESP_OK)return false;        // SIO_SET_DATA: 8N1
  if(controlOut(3,v,i)!=ESP_OK)return false;           // SIO_SET_BAUD_RATE
  if(controlOut(2,0x0000)!=ESP_OK)return false;        // SIO_SET_FLOW_CTRL none
  controlOut(1,0x0303);                                // SIO_MODEM_CTRL DTR+RTS on
  baudRate=baud;
  publish(String("FTDI CONFIGURED ")+baudRate+" 8N1");
  if(cfgChar)cfgChar->setValue((String("BAUD=")+baudRate).c_str());
  return true;
}

static bool findBulkEndpoints(){
  const usb_config_desc_t *cfg=nullptr;
  esp_err_t e=usb_host_get_active_config_descriptor(deviceHandle,&cfg);
  if(e!=ESP_OK||!cfg)return false;
  const uint8_t *p=(const uint8_t*)cfg;
  const uint8_t *end=p+cfg->wTotalLength;
  epIn=epOut=0;
  while(p+2<=end){
    uint8_t len=p[0],type=p[1]; if(len<2||p+len>end)break;
    if(type==USB_B_DESCRIPTOR_TYPE_ENDPOINT && len>=7){
      const usb_ep_desc_t *ep=(const usb_ep_desc_t*)p;
      if((ep->bmAttributes&0x03)==USB_BM_ATTRIBUTES_XFER_BULK){
        if(ep->bEndpointAddress&0x80){epIn=ep->bEndpointAddress;epInMps=ep->wMaxPacketSize;}
        else {epOut=ep->bEndpointAddress;epOutMps=ep->wMaxPacketSize;}
      }
    }
    p+=len;
  }
  return epIn&&epOut;
}

struct TxCtx{usb_transfer_t *t;};
static void txDone(usb_transfer_t *t){usb_host_transfer_free(t);}

static bool sendFtdi(const uint8_t *data,size_t len){
  if(!ftdiReady||!epOut||!deviceHandle||!len)return false;
  usb_transfer_t *t=nullptr;
  if(usb_host_transfer_alloc(len,0,&t)!=ESP_OK)return false;
  memcpy(t->data_buffer,data,len);
  t->num_bytes=len;t->device_handle=deviceHandle;t->bEndpointAddress=epOut;t->callback=txDone;t->context=nullptr;
  esp_err_t e=usb_host_transfer_submit(t);
  if(e!=ESP_OK){usb_host_transfer_free(t);return false;}
  return true;
}

static void rxDone(usb_transfer_t *t){
  if(t->status==USB_TRANSFER_STATUS_COMPLETED && t->actual_num_bytes>2){
    // FTDI bulk IN packets begin with two modem/status bytes.
    const uint8_t *d=t->data_buffer+2;size_t n=t->actual_num_bytes-2;
    Serial0.write(d,n);
    if(rxChar){rxChar->setValue(d,n);rxChar->notify();}
  }
  if(ftdiReady&&deviceHandle){t->num_bytes=t->data_buffer_size;usb_host_transfer_submit(t);}else usb_host_transfer_free(t);
}

static bool startRx(){
  usb_transfer_t *t=nullptr;size_t n=max<size_t>(64,epInMps);
  if(usb_host_transfer_alloc(n,0,&t)!=ESP_OK)return false;
  t->device_handle=deviceHandle;t->bEndpointAddress=epIn;t->callback=rxDone;t->context=nullptr;t->num_bytes=n;
  if(usb_host_transfer_submit(t)!=ESP_OK){usb_host_transfer_free(t);return false;}
  return true;
}

class TxCallbacks:public BLECharacteristicCallbacks{
  void onWrite(BLECharacteristic *c)override{
    std::string v=c->getValue();if(!v.empty())sendFtdi((const uint8_t*)v.data(),v.size());
  }
};
class CfgCallbacks:public BLECharacteristicCallbacks{
  void onWrite(BLECharacteristic *c)override{
    String s=c->getValue().c_str();s.trim();s.toUpperCase();
    if(s.startsWith("BAUD=")){uint32_t b=s.substring(5).toInt();configureFtdi(b);}
  }
};

static void usbClientEvent(const usb_host_client_event_msg_t *m,void*){
  if(!m)return;
  if(m->event==USB_HOST_CLIENT_EVENT_NEW_DEV){pendingAddress=m->new_dev.address;publish(String("USB NEW address=")+pendingAddress);}
  else if(m->event==USB_HOST_CLIENT_EVENT_DEV_GONE){deviceGone=true;publish("USB DISCONNECTED");}
}

static void usbDaemonTask(void*){
  const usb_host_config_t c={.skip_phy_setup=false,.intr_flags=ESP_INTR_FLAG_LEVEL1};
  esp_err_t e=usb_host_install(&c);if(e!=ESP_OK){publish(String("USB HOST INSTALL ERROR ")+esp_err_to_name(e));vTaskDelete(nullptr);return;}
  publish("USB HOST READY");
  while(true){uint32_t f=0;usb_host_lib_handle_events(pdMS_TO_TICKS(1000),&f);if(f&USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS)usb_host_device_free_all();}
}

static void usbClientTask(void*){
  delay(250);
  const usb_host_client_config_t c={.is_synchronous=false,.max_num_event_msg=5,.async={.client_event_callback=usbClientEvent,.callback_arg=nullptr}};
  esp_err_t e=usb_host_client_register(&c,&clientHandle);if(e!=ESP_OK){publish(String("USB CLIENT ERROR ")+esp_err_to_name(e));vTaskDelete(nullptr);return;}
  publish("USB CLIENT READY — connect Zeeltronic PC-USB cable");
  while(true){
    usb_host_client_handle_events(clientHandle,pdMS_TO_TICKS(100));
    if(deviceGone&&deviceHandle){ftdiReady=false;usb_host_device_close(clientHandle,deviceHandle);deviceHandle=nullptr;deviceGone=false;epIn=epOut=0;}
    uint8_t a=pendingAddress;
    if(a&&!deviceHandle){
      pendingAddress=0;e=usb_host_device_open(clientHandle,a,&deviceHandle);if(e!=ESP_OK){publish(String("USB OPEN ERROR ")+esp_err_to_name(e));continue;}
      const usb_device_desc_t *d=nullptr;e=usb_host_get_device_descriptor(deviceHandle,&d);if(e!=ESP_OK||!d){publish("USB DESCRIPTOR ERROR");continue;}
      char line[128];snprintf(line,sizeof(line),"USB VID=%04X PID=%04X class=%02X",d->idVendor,d->idProduct,d->bDeviceClass);publish(line);
      if(d->idVendor!=0x0403||d->idProduct!=0x6001){publish("NOT ZEEL FTDI 0403:6001");continue;}
      if(!findBulkEndpoints()){publish("FTDI BULK ENDPOINTS NOT FOUND");continue;}
      snprintf(line,sizeof(line),"FTDI READY epIN=0x%02X epOUT=0x%02X",epIn,epOut);publish(line);
      ftdiReady=true;
      configureFtdi(baudRate);
      if(!startRx())publish("FTDI RX START ERROR");
    }
  }
}

void setup(){
  Serial0.begin(115200);delay(150);Serial0.println();Serial0.println(FW);
  BLEDevice::init(BLE_NAME);BLEServer *s=BLEDevice::createServer();BLEService *svc=s->createService(SERVICE_UUID);
  statusChar=svc->createCharacteristic(STATUS_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);statusChar->addDescriptor(new BLE2902());
  rxChar=svc->createCharacteristic(RX_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);rxChar->addDescriptor(new BLE2902());
  txChar=svc->createCharacteristic(TX_UUID,BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_WRITE_NR);txChar->setCallbacks(new TxCallbacks());
  cfgChar=svc->createCharacteristic(CFG_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_WRITE);cfgChar->setCallbacks(new CfgCallbacks());cfgChar->setValue("BAUD=115200");
  svc->start();BLEAdvertising *a=BLEDevice::getAdvertising();a->addServiceUUID(SERVICE_UUID);a->setScanResponse(true);BLEDevice::startAdvertising();
  publish(String("READY ")+FW+" BLE="+BLE_NAME);
  xTaskCreatePinnedToCore(usbDaemonTask,"usb-daemon",4096,nullptr,5,nullptr,0);
  xTaskCreatePinnedToCore(usbClientTask,"usb-client",8192,nullptr,4,nullptr,1);
}
void loop(){delay(1000);}
