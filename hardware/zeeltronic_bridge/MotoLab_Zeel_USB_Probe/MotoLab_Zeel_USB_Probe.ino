#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "usb/usb_host.h"

// MotoLab / Zeeltronic ESP32-S3 bridge — stage 2.2 protocol capture
// Target: ESP32-S3 N16R8. PC/debug stays on the board's Single Serial UART bridge.
// Native USB-OTG port is dedicated to the Zeeltronic PC-USB cable (FTDI 0403:6001).
// SAFE DEFAULT: READ-ONLY. Incoming Zeeltronic bytes are captured and forwarded to BLE,
// but BLE writes are NOT sent to the CDI unless an explicit runtime unlock is issued.
// Goal: preserve as much transport evidence as possible for later protocol analysis.

static const char *FW = "motolab-zeel-ftdi-capture-v2.2";
static const char *BLE_NAME = "MotoLab-Zeel";
static const char *SERVICE_UUID = "7d7d0001-7a45-4545-4c54-524f4e494301";
static const char *STATUS_UUID  = "7d7d0002-7a45-4545-4c54-524f4e494301";
static const char *RX_UUID      = "7d7d0003-7a45-4545-4c54-524f4e494301";
static const char *TX_UUID      = "7d7d0004-7a45-4545-4c54-524f4e494301";
static const char *CFG_UUID     = "7d7d0005-7a45-4545-4c54-524f4e494301";

static BLECharacteristic *statusChar=nullptr,*rxChar=nullptr,*txChar=nullptr,*cfgChar=nullptr;
static usb_host_client_handle_t clientHandle=nullptr;
static usb_device_handle_t deviceHandle=nullptr;
static volatile uint8_t pendingAddress=0;
static volatile bool deviceGone=false;
static bool ftdiReady=false;
static bool writeUnlocked=false;
static uint8_t epIn=0,epOut=0,claimedInterface=0xFF;
static uint16_t epInMps=64,epOutMps=64;
static uint32_t baudRate=115200;
static uint64_t rxBytes=0,txBytes=0,rxPackets=0,txPackets=0;
static uint32_t connectCount=0,disconnectCount=0,transferErrors=0;
static uint32_t sessionStartMs=0,lastRxMs=0,lastTxMs=0;

static String hexBytes(const uint8_t *d,size_t n,size_t maxN=96){
  static const char *h="0123456789ABCDEF";String s;size_t m=min(n,maxN);s.reserve(m*3+16);
  for(size_t i=0;i<m;i++){if(i)s+=' ';s+=h[d[i]>>4];s+=h[d[i]&15];}
  if(n>m)s+=" ...";return s;
}
static void publish(const String &msg){
  Serial0.print('[');Serial0.print(millis());Serial0.print("] ");Serial0.println(msg);
  if(statusChar){statusChar->setValue(msg.c_str());statusChar->notify();}
}
static void captureLine(const char *dir,const uint8_t *d,size_t n){
  Serial0.print("CAP,");Serial0.print(millis());Serial0.print(',');Serial0.print(dir);Serial0.print(',');Serial0.print(n);Serial0.print(',');Serial0.println(hexBytes(d,n));
}

static void controlDone(usb_transfer_t*){}
static esp_err_t controlOut(uint8_t req,uint16_t value,uint16_t index=0){
  if(!deviceHandle)return ESP_ERR_INVALID_STATE;
  usb_transfer_t *t=nullptr;esp_err_t e=usb_host_transfer_alloc(8,0,&t);if(e!=ESP_OK)return e;
  auto *s=(usb_setup_packet_t*)t->data_buffer;
  s->bmRequestType=0x40;s->bRequest=req;s->wValue=value;s->wIndex=index;s->wLength=0;
  t->device_handle=deviceHandle;t->bEndpointAddress=0;t->callback=controlDone;t->context=nullptr;t->num_bytes=8;
  e=usb_host_transfer_submit_control(clientHandle,t);
  if(e==ESP_OK){uint32_t start=millis();while(t->status==USB_TRANSFER_STATUS_COMPLETED && millis()-start<2)delay(1);delay(5);}else transferErrors++;
  usb_host_transfer_free(t);return e;
}

static bool ftdiBaudValue(uint32_t baud,uint16_t &value,uint16_t &index){
  index=0;switch(baud){
    case 9600:value=0x4138;return true;case 19200:value=0x809C;return true;case 38400:value=0xC04E;return true;
    case 57600:value=0x0034;return true;case 115200:value=0x001A;return true;case 230400:value=0x000D;return true;
    case 460800:value=0x4006;return true;case 921600:value=0x8003;return true;default:return false;}
}
static bool configureFtdi(uint32_t baud){
  if(!ftdiReady)return false;uint16_t v=0,i=0;if(!ftdiBaudValue(baud,v,i)){publish("UNSUPPORTED BAUD");return false;}
  if(controlOut(0,0)!=ESP_OK)return false;if(controlOut(4,0x0008)!=ESP_OK)return false;if(controlOut(3,v,i)!=ESP_OK)return false;if(controlOut(2,0)!=ESP_OK)return false;
  // Deliberately do not pulse DTR/RTS in capture mode; avoid unintended target-side side effects.
  baudRate=baud;publish(String("FTDI CONFIGURED ")+baudRate+" 8N1 READ_ONLY="+(writeUnlocked?"0":"1"));
  if(cfgChar)cfgChar->setValue((String("BAUD=")+baudRate+";MODE="+(writeUnlocked?"BRIDGE":"READONLY")).c_str());return true;
}

static void dumpConfigDescriptor(){
  const usb_config_desc_t *cfg=nullptr;if(usb_host_get_active_config_descriptor(deviceHandle,&cfg)!=ESP_OK||!cfg)return;
  publish(String("USB CFG total=")+cfg->wTotalLength+" interfaces="+cfg->bNumInterfaces);
  const uint8_t *p=(const uint8_t*)cfg,*end=p+cfg->wTotalLength;
  while(p+2<=end){uint8_t len=p[0],type=p[1];if(len<2||p+len>end)break;
    if(type==USB_B_DESCRIPTOR_TYPE_INTERFACE&&len>=9){auto *i=(const usb_intf_desc_t*)p;publish(String("USB IF num=")+i->bInterfaceNumber+" alt="+i->bAlternateSetting+" class="+String(i->bInterfaceClass,HEX)+" sub="+String(i->bInterfaceSubClass,HEX)+" proto="+String(i->bInterfaceProtocol,HEX)+" eps="+i->bNumEndpoints);}
    else if(type==USB_B_DESCRIPTOR_TYPE_ENDPOINT&&len>=7){auto *e=(const usb_ep_desc_t*)p;publish(String("USB EP addr=0x")+String(e->bEndpointAddress,HEX)+" attr=0x"+String(e->bmAttributes,HEX)+" mps="+e->wMaxPacketSize+" interval="+e->bInterval);}
    p+=len;
  }
}
static bool findBulkEndpoints(){
  const usb_config_desc_t *cfg=nullptr;esp_err_t e=usb_host_get_active_config_descriptor(deviceHandle,&cfg);if(e!=ESP_OK||!cfg)return false;
  const uint8_t *p=(const uint8_t*)cfg,*end=p+cfg->wTotalLength;uint8_t currentIf=0xFF;epIn=epOut=0;claimedInterface=0xFF;
  while(p+2<=end){uint8_t len=p[0],type=p[1];if(len<2||p+len>end)break;
    if(type==USB_B_DESCRIPTOR_TYPE_INTERFACE&&len>=9){currentIf=((const usb_intf_desc_t*)p)->bInterfaceNumber;}
    else if(type==USB_B_DESCRIPTOR_TYPE_ENDPOINT&&len>=7){auto *ep=(const usb_ep_desc_t*)p;if((ep->bmAttributes&0x03)==USB_BM_ATTRIBUTES_XFER_BULK){
      if(claimedInterface==0xFF)claimedInterface=currentIf;if(ep->bEndpointAddress&0x80){epIn=ep->bEndpointAddress;epInMps=ep->wMaxPacketSize;}else{epOut=ep->bEndpointAddress;epOutMps=ep->wMaxPacketSize;}}}
    p+=len;
  }
  if(!epIn||!epOut||claimedInterface==0xFF)return false;
  e=usb_host_interface_claim(clientHandle,deviceHandle,claimedInterface,0);if(e!=ESP_OK){publish(String("USB CLAIM ERROR ")+esp_err_to_name(e));claimedInterface=0xFF;return false;}return true;
}

static void txDone(usb_transfer_t *t){
  if(t->status==USB_TRANSFER_STATUS_COMPLETED){txBytes+=t->actual_num_bytes;txPackets++;lastTxMs=millis();captureLine("TX",t->data_buffer,t->actual_num_bytes);}else transferErrors++;
  usb_host_transfer_free(t);
}
static bool sendFtdi(const uint8_t *data,size_t len){
  if(!writeUnlocked){publish(String("TX BLOCKED READ-ONLY bytes=")+len);captureLine("TX_BLOCKED",data,len);return false;}
  if(!ftdiReady||!epOut||!deviceHandle||!len)return false;usb_transfer_t *t=nullptr;if(usb_host_transfer_alloc(len,0,&t)!=ESP_OK)return false;
  memcpy(t->data_buffer,data,len);t->num_bytes=len;t->device_handle=deviceHandle;t->bEndpointAddress=epOut;t->callback=txDone;t->context=nullptr;
  esp_err_t e=usb_host_transfer_submit(t);if(e!=ESP_OK){transferErrors++;usb_host_transfer_free(t);return false;}return true;
}
static void rxDone(usb_transfer_t *t){
  if(t->status==USB_TRANSFER_STATUS_COMPLETED){
    rxPackets++;if(t->actual_num_bytes>=2){const uint8_t *d=t->data_buffer+2;size_t n=t->actual_num_bytes-2;rxBytes+=n;lastRxMs=millis();
      Serial0.print("FTDI_STATUS,");Serial0.print(millis());Serial0.print(',');Serial0.print(t->data_buffer[0],HEX);Serial0.print(',');Serial0.println(t->data_buffer[1],HEX);
      if(n){captureLine("RX",d,n);if(rxChar){rxChar->setValue(d,n);rxChar->notify();}}
    }
  }else transferErrors++;
  if(ftdiReady&&deviceHandle){t->num_bytes=t->data_buffer_size;if(usb_host_transfer_submit(t)!=ESP_OK){transferErrors++;usb_host_transfer_free(t);}}else usb_host_transfer_free(t);
}
static bool startRx(){usb_transfer_t *t=nullptr;size_t n=max<size_t>(64,epInMps);if(usb_host_transfer_alloc(n,0,&t)!=ESP_OK)return false;t->device_handle=deviceHandle;t->bEndpointAddress=epIn;t->callback=rxDone;t->context=nullptr;t->num_bytes=n;if(usb_host_transfer_submit(t)!=ESP_OK){usb_host_transfer_free(t);return false;}return true;}

class TxCallbacks:public BLECharacteristicCallbacks{void onWrite(BLECharacteristic *c)override{size_t n=c->getLength();const uint8_t *d=c->getData();if(d&&n)sendFtdi(d,n);}};
class CfgCallbacks:public BLECharacteristicCallbacks{void onWrite(BLECharacteristic *c)override{
  String s=c->getValue();s.trim();s.toUpperCase();
  if(s.startsWith("BAUD=")){configureFtdi(s.substring(5).toInt());return;}
  if(s=="STATUS"){publish(String("STATS rxB=")+rxBytes+" txB="+txBytes+" rxP="+rxPackets+" txP="+txPackets+" err="+transferErrors+" upMs="+(millis()-sessionStartMs));return;}
  if(s=="LOCK"){writeUnlocked=false;publish("WRITE LOCKED — READ ONLY");return;}
  if(s=="UNLOCK_WRITE_I_ACCEPT_RISK"){writeUnlocked=true;publish("WRITE UNLOCKED — BRIDGE MODE");return;}
  publish(String("CFG UNKNOWN: ")+s);
}};

static void usbClientEvent(const usb_host_client_event_msg_t *m,void*){if(!m)return;if(m->event==USB_HOST_CLIENT_EVENT_NEW_DEV){pendingAddress=m->new_dev.address;publish(String("USB NEW address=")+pendingAddress);}else if(m->event==USB_HOST_CLIENT_EVENT_DEV_GONE){deviceGone=true;publish("USB DISCONNECTED");}}
static void usbDaemonTask(void*){const usb_host_config_t c={.skip_phy_setup=false,.intr_flags=ESP_INTR_FLAG_LEVEL1};esp_err_t e=usb_host_install(&c);if(e!=ESP_OK){publish(String("USB HOST INSTALL ERROR ")+esp_err_to_name(e));vTaskDelete(nullptr);return;}publish("USB HOST READY");while(true){uint32_t f=0;usb_host_lib_handle_events(pdMS_TO_TICKS(1000),&f);if(f&USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS)usb_host_device_free_all();}}
static void usbClientTask(void*){
  delay(250);const usb_host_client_config_t c={.is_synchronous=false,.max_num_event_msg=5,.async={.client_event_callback=usbClientEvent,.callback_arg=nullptr}};esp_err_t e=usb_host_client_register(&c,&clientHandle);if(e!=ESP_OK){publish(String("USB CLIENT ERROR ")+esp_err_to_name(e));vTaskDelete(nullptr);return;}publish("USB CLIENT READY — connect Zeeltronic PC-USB cable");
  while(true){usb_host_client_handle_events(clientHandle,pdMS_TO_TICKS(100));
    if(deviceGone&&deviceHandle){ftdiReady=false;if(claimedInterface!=0xFF){usb_host_interface_release(clientHandle,deviceHandle,claimedInterface);claimedInterface=0xFF;}usb_host_device_close(clientHandle,deviceHandle);deviceHandle=nullptr;deviceGone=false;epIn=epOut=0;disconnectCount++;writeUnlocked=false;publish("SESSION CLOSED; WRITE RELOCKED");}
    uint8_t a=pendingAddress;if(a&&!deviceHandle){pendingAddress=0;e=usb_host_device_open(clientHandle,a,&deviceHandle);if(e!=ESP_OK){publish(String("USB OPEN ERROR ")+esp_err_to_name(e));continue;}
      const usb_device_desc_t *d=nullptr;e=usb_host_get_device_descriptor(deviceHandle,&d);if(e!=ESP_OK||!d){publish("USB DESCRIPTOR ERROR");continue;}
      char line[180];snprintf(line,sizeof(line),"USB DEV VID=%04X PID=%04X bcd=%04X class=%02X sub=%02X proto=%02X mps0=%u cfgs=%u",d->idVendor,d->idProduct,d->bcdDevice,d->bDeviceClass,d->bDeviceSubClass,d->bDeviceProtocol,d->bMaxPacketSize0,d->bNumConfigurations);publish(line);dumpConfigDescriptor();
      if(d->idVendor!=0x0403||d->idProduct!=0x6001){publish("NOT ZEEL FTDI 0403:6001 — CAPTURE REFUSED");continue;}
      if(!findBulkEndpoints()){publish("FTDI BULK ENDPOINTS NOT FOUND");continue;}
      snprintf(line,sizeof(line),"FTDI READY if=%u epIN=0x%02X mps=%u epOUT=0x%02X mps=%u",claimedInterface,epIn,epInMps,epOut,epOutMps);publish(line);
      ftdiReady=true;writeUnlocked=false;sessionStartMs=millis();rxBytes=txBytes=rxPackets=txPackets=0;transferErrors=0;connectCount++;configureFtdi(baudRate);if(!startRx())publish("FTDI RX START ERROR");
    }
  }
}

void setup(){
  Serial0.begin(115200);delay(150);Serial0.println();Serial0.println(FW);
  BLEDevice::init(BLE_NAME);BLEServer *s=BLEDevice::createServer();BLEService *svc=s->createService(SERVICE_UUID);
  statusChar=svc->createCharacteristic(STATUS_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);statusChar->addDescriptor(new BLE2902());
  rxChar=svc->createCharacteristic(RX_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);rxChar->addDescriptor(new BLE2902());
  txChar=svc->createCharacteristic(TX_UUID,BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_WRITE_NR);txChar->setCallbacks(new TxCallbacks());
  cfgChar=svc->createCharacteristic(CFG_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_WRITE);cfgChar->setCallbacks(new CfgCallbacks());cfgChar->setValue("BAUD=115200;MODE=READONLY");
  svc->start();BLEAdvertising *a=BLEDevice::getAdvertising();a->addServiceUUID(SERVICE_UUID);a->setScanResponse(true);BLEDevice::startAdvertising();
  publish(String("READY ")+FW+" BLE="+BLE_NAME+" SAFE=READ_ONLY");
  xTaskCreatePinnedToCore(usbDaemonTask,"usb-daemon",4096,nullptr,5,nullptr,0);xTaskCreatePinnedToCore(usbClientTask,"usb-client",8192,nullptr,4,nullptr,1);
}
void loop(){delay(5000);if(ftdiReady)publish(String("HEARTBEAT rxB=")+rxBytes+" txB="+txBytes+" rxP="+rxPackets+" txP="+txPackets+" err="+transferErrors+" lastRx="+lastRxMs+" lastTx="+lastTxMs+" mode="+(writeUnlocked?"BRIDGE":"READONLY"));}
