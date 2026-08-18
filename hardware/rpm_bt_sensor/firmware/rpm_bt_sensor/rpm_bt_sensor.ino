#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <LittleFS.h>
#include <esp_task_wdt.h>

// Arduino-ESP32 3.3.11. Confirm these GPIOs against the exact carrier silkscreen.
static constexpr uint8_t PIN_RPM = 4;
static constexpr uint8_t PIN_STATUS_LED = 48;
static constexpr uint8_t PIN_BUTTON = 0;

static const char *SERVICE_UUID = "f7b10001-6a4d-4b2a-9c41-7a3b84d2e001";
static const char *MEAS_UUID    = "f7b10002-6a4d-4b2a-9c41-7a3b84d2e001";
static const char *STATUS_UUID  = "f7b10003-6a4d-4b2a-9c41-7a3b84d2e001";
static const char *CONFIG_UUID  = "f7b10004-6a4d-4b2a-9c41-7a3b84d2e001";
static const char *RAW_UUID     = "f7b10005-6a4d-4b2a-9c41-7a3b84d2e001";

enum Flags : uint16_t {
  VALID=1u<<0, LEARNING_ELIGIBLE=1u<<1, ENGINE_VALIDATED=1u<<2,
  DROPOUT=1u<<3, JUMP_REJECTED=1u<<4, HARMONIC_ADJUSTED=1u<<5,
  CONFIG_CHANGED=1u<<6, SESSION_ACTIVE=1u<<7
};

struct __attribute__((packed)) MeasurementV1 {
  uint8_t version, source;
  uint16_t flags;
  uint32_t seq, timestampMs;
  uint16_t rpm;
  uint8_t confidence, signal;
  float rawFrequencyHz;
  uint16_t rawCandidateRpm, rejectionCount;
};
static_assert(sizeof(MeasurementV1)==24, "MeasurementV1 size");

struct __attribute__((packed)) RawEventV1 {
  uint8_t version, reserved;
  uint16_t seq;
  uint32_t timestampUs, periodUs;
  uint16_t edgeCount, flags;
};
static_assert(sizeof(RawEventV1)==16, "RawEventV1 size");

struct Config {
  float pulsesPerRev=1.0f;
  uint16_t minRpm=500, maxRpm=16000;
  uint8_t notifyHz=10;
  bool raw=false, session=true;
} cfg;

portMUX_TYPE edgeMux=portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t isrLastUs=0, isrPeriodUs=0, isrEdgeCount=0;
volatile uint16_t isrRawSeq=0;
static constexpr uint32_t ISR_MIN_US=350; // rejects >171k edges/min, safely above intended range

BLEServer *server=nullptr;
BLECharacteristic *measChr=nullptr, *statusChr=nullptr, *configChr=nullptr, *rawChr=nullptr;
bool clientConnected=false, wasConnected=false, fsReady=false;
uint32_t txSeq=0, lastNotifyMs=0, lastAcceptedMs=0, lastLogMs=0;
uint16_t rejectionCount=0;
float filteredRpm=0, previousRawHz=0;
uint8_t stableWindows=0;
uint16_t transientFlags=0;
File sessionFile;

void IRAM_ATTR onEdge() {
  uint32_t now=micros();
  uint32_t dt=now-isrLastUs;
  if (isrLastUs && dt>=ISR_MIN_US) {
    portENTER_CRITICAL_ISR(&edgeMux);
    isrPeriodUs=dt; isrEdgeCount++; isrRawSeq++;
    portEXIT_CRITICAL_ISR(&edgeMux);
  }
  if (!isrLastUs || dt>=ISR_MIN_US) isrLastUs=now;
}

void setStatus(const char *state, const char *detail="") {
  char s[180];
  snprintf(s,sizeof(s),"{\"state\":\"%s\",\"detail\":\"%s\",\"uptimeMs\":%lu,\"rejections\":%u}",
           state,detail,(unsigned long)millis(),rejectionCount);
  statusChr->setValue((uint8_t*)s,strlen(s));
  if(clientConnected) statusChr->notify();
}

String configJson() {
  char s[180];
  snprintf(s,sizeof(s),"{\"pulsesPerRev\":%.3f,\"minRpm\":%u,\"maxRpm\":%u,\"notifyHz\":%u,\"raw\":%s,\"session\":%s}",
    cfg.pulsesPerRev,cfg.minRpm,cfg.maxRpm,cfg.notifyHz,cfg.raw?"true":"false",cfg.session?"true":"false");
  return String(s);
}

bool readNumber(const String &j,const char *key,float &out) {
  String token=String("\"")+key+"\""; int p=j.indexOf(token); if(p<0)return false;
  p=j.indexOf(':',p); if(p<0)return false; out=j.substring(p+1).toFloat(); return true;
}
bool readBool(const String &j,const char *key,bool &out) {
  String token=String("\"")+key+"\""; int p=j.indexOf(token); if(p<0)return false;
  p=j.indexOf(':',p); if(p<0)return false; String v=j.substring(p+1); v.trim();
  if(v.startsWith("true")){out=true;return true;} if(v.startsWith("false")){out=false;return true;} return false;
}

bool applyConfig(const String &j) {
  Config next=cfg; float v;
  if(readNumber(j,"pulsesPerRev",v)) next.pulsesPerRev=v;
  if(readNumber(j,"minRpm",v)) next.minRpm=(uint16_t)v;
  if(readNumber(j,"maxRpm",v)) next.maxRpm=(uint16_t)v;
  if(readNumber(j,"notifyHz",v)) next.notifyHz=(uint8_t)v;
  readBool(j,"raw",next.raw); readBool(j,"session",next.session);
  if(next.pulsesPerRev<0.25f || next.pulsesPerRev>8.0f || next.minRpm<100 ||
     next.maxRpm>30000 || next.maxRpm<=next.minRpm || next.notifyHz<1 || next.notifyHz>20) return false;
  cfg=next; transientFlags|=CONFIG_CHANGED; configChr->setValue(configJson().c_str()); return true;
}

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    String j=String(c->getValue().c_str());
    if(applyConfig(j)) setStatus("config_ok"); else setStatus("config_error","invalid value");
  }
};
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {clientConnected=true; digitalWrite(PIN_STATUS_LED,HIGH);}
  void onDisconnect(BLEServer*) override {clientConnected=false; digitalWrite(PIN_STATUS_LED,LOW);}
};

float chooseHarmonic(float rawRpm,uint16_t &flags) {
  if(filteredRpm<cfg.minRpm) return rawRpm;
  float candidates[3]={rawRpm,rawRpm*0.5f,rawRpm*2.0f};
  float best=rawRpm, bestErr=fabsf(rawRpm-filteredRpm)/filteredRpm;
  for(float c:candidates) if(c>=cfg.minRpm && c<=cfg.maxRpm) {
    float e=fabsf(c-filteredRpm)/filteredRpm; if(e<bestErr){bestErr=e;best=c;}
  }
  if(fabsf(best-rawRpm)>1.0f) flags|=HARMONIC_ADJUSTED;
  return best;
}

bool openSession() {
  if(!fsReady || !cfg.session || sessionFile) return (bool)sessionFile;
  char path[48]; snprintf(path,sizeof(path),"/session_%lu.csv",(unsigned long)millis());
  sessionFile=LittleFS.open(path,FILE_WRITE);
  if(sessionFile) sessionFile.println("seq,timestamp_ms,rpm,confidence,signal,raw_hz,raw_candidate,flags,rejections");
  return (bool)sessionFile;
}

void logMeasurement(const MeasurementV1 &m) {
  if(!cfg.session || !openSession() || millis()-lastLogMs<100) return;
  lastLogMs=millis();
  sessionFile.printf("%lu,%lu,%u,%u,%u,%.4f,%u,%u,%u\n",(unsigned long)m.seq,
    (unsigned long)m.timestampMs,m.rpm,m.confidence,m.signal,m.rawFrequencyHz,
    m.rawCandidateRpm,m.flags,m.rejectionCount);
  if((m.seq%50)==0) sessionFile.flush();
}

MeasurementV1 sample() {
  uint32_t period,edges,lastEdge;
  portENTER_CRITICAL(&edgeMux); period=isrPeriodUs; edges=isrEdgeCount; lastEdge=isrLastUs; portEXIT_CRITICAL(&edgeMux);
  uint32_t nowUs=micros(), nowMs=millis(); uint16_t flags=transientFlags; transientFlags=0;
  float hz=(period>0)?1000000.0f/period:0.0f;
  float rawRpm=(cfg.pulsesPerRev>0)?hz*60.0f/cfg.pulsesPerRev:0.0f;
  float candidate=chooseHarmonic(rawRpm,flags);
  bool recent=lastEdge && (uint32_t)(nowUs-lastEdge)<500000u;
  bool range= candidate>=cfg.minRpm && candidate<=cfg.maxRpm;
  float jump=(filteredRpm>0)?fabsf(candidate-filteredRpm)/filteredRpm:0;
  bool accept=recent && range && (filteredRpm==0 || jump<=0.35f);
  if(recent && range && !accept){flags|=JUMP_REJECTED; if(rejectionCount<65535)rejectionCount++; stableWindows=0;}
  if(accept){filteredRpm=(filteredRpm==0)?candidate:(filteredRpm*0.72f+candidate*0.28f); lastAcceptedMs=nowMs; if(stableWindows<20)stableWindows++;}
  bool valid=accept && nowMs-lastAcceptedMs<500;
  if(!recent){flags|=DROPOUT; filteredRpm=0; stableWindows=0;}
  float jitter=(previousRawHz>0 && hz>0)?fabsf(hz-previousRawHz)/previousRawHz:1.0f; previousRawHz=hz;
  int conf=valid ? (int)(100.0f-fminf(60.0f,jitter*300.0f)) : 0;
  if(stableWindows<4) conf=min(conf,70); uint8_t signal=valid?(uint8_t)constrain(100-(int)(jitter*400),0,100):0;
  // Firmware can prove only local signal validity. GPS/reference agreement is a
  // host-side requirement, so V1 never asserts LEARNING_ELIGIBLE by itself.
  if(valid)flags|=VALID;
  if(cfg.session)flags|=SESSION_ACTIVE;
  MeasurementV1 m{1,1,flags,++txSeq,nowMs,(uint16_t)(valid?constrain(lroundf(filteredRpm),0,65535):0),
    (uint8_t)constrain(conf,0,100),signal,hz,(uint16_t)constrain(lroundf(rawRpm),0,65535),rejectionCount};
  (void)edges; return m;
}

void setupBle() {
  uint64_t id=ESP.getEfuseMac(); char name[24]; snprintf(name,sizeof(name),"VANA-RPM-BT-%04X",(uint16_t)id);
  BLEDevice::init(name); BLEDevice::setMTU(185); server=BLEDevice::createServer(); server->setCallbacks(new ServerCallbacks());
  BLEService *svc=server->createService(SERVICE_UUID);
  measChr=svc->createCharacteristic(MEAS_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY); measChr->addDescriptor(new BLE2902());
  statusChr=svc->createCharacteristic(STATUS_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY); statusChr->addDescriptor(new BLE2902());
  configChr=svc->createCharacteristic(CONFIG_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_WRITE); configChr->setCallbacks(new ConfigCallbacks());
  rawChr=svc->createCharacteristic(RAW_UUID,BLECharacteristic::PROPERTY_NOTIFY); rawChr->addDescriptor(new BLE2902());
  configChr->setValue(configJson().c_str()); svc->start();
  BLEAdvertising *adv=BLEDevice::getAdvertising(); adv->addServiceUUID(SERVICE_UUID); adv->setScanResponse(true); adv->start();
}

void setup() {
  Serial.begin(115200); pinMode(PIN_RPM,INPUT); pinMode(PIN_STATUS_LED,OUTPUT); pinMode(PIN_BUTTON,INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_RPM),onEdge,RISING); fsReady=LittleFS.begin(true);
  setupBle(); setStatus("ready",fsReady?"littlefs_ok":"littlefs_unavailable");
  esp_task_wdt_add(NULL);
}

void loop() {
  esp_task_wdt_reset(); uint32_t interval=1000u/cfg.notifyHz;
  if(millis()-lastNotifyMs>=interval) {
    lastNotifyMs=millis(); MeasurementV1 m=sample(); measChr->setValue((uint8_t*)&m,sizeof(m)); if(clientConnected)measChr->notify(); logMeasurement(m);
    if(cfg.raw && clientConnected){uint32_t p,e,t;uint16_t rs;portENTER_CRITICAL(&edgeMux);p=isrPeriodUs;e=isrEdgeCount;t=isrLastUs;rs=isrRawSeq;portEXIT_CRITICAL(&edgeMux);RawEventV1 r{1,0,rs,t,p,(uint16_t)e,m.flags};rawChr->setValue((uint8_t*)&r,sizeof(r));rawChr->notify();}
  }
  if(!clientConnected && wasConnected){delay(200);server->startAdvertising();wasConnected=false;}
  if(clientConnected)wasConnected=true;
  delay(2);
}

