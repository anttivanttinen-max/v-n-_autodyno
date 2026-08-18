#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Preferences.h>

static constexpr uint8_t PULSE_PIN = 4;
static constexpr char DEVICE_NAME[] = "MotoLab-RPM-BT";
static constexpr char SERVICE_UUID[] = "7b7d0001-6b8a-4f2a-9c4b-3b9a4e4d0001";
static constexpr char TELEMETRY_UUID[] = "7b7d0002-6b8a-4f2a-9c4b-3b9a4e4d0001";
static constexpr char CONFIG_UUID[] = "7b7d0003-6b8a-4f2a-9c4b-3b9a4e4d0001";
static constexpr char INFO_UUID[] = "7b7d0004-6b8a-4f2a-9c4b-3b9a4e4d0001";
static constexpr uint32_t MIN_PERIOD_US = 2500;       // 24k pulse/min ceiling
static constexpr uint32_t ENGINE_OFF_US = 1500000;
static constexpr float MAX_STEP_FRACTION = 0.55f;

Preferences prefs;
NimBLECharacteristic *telemetryChar = nullptr;
volatile uint32_t irqLastUs = 0;
volatile uint32_t irqPeriodUs = 0;
volatile uint32_t irqAccepted = 0;
volatile uint32_t irqNoise = 0;

float pulsesPerRev = 1.0f;
float filteredRpm = 0.0f;
float lastRawRpm = 0.0f;
uint32_t processedAccepted = 0;
uint32_t acceptedTotal = 0;
uint16_t jumpRejected = 0, dropoutCount = 0;
uint16_t sequenceNo = 0, resetCounter = 0;
bool wasOff = true;

struct __attribute__((packed)) TelemetryV1 {
  uint8_t version, flags;
  uint16_t sequence;
  uint32_t uptimeMs;
  float rpm, rawRpm, ppr;
  uint8_t confidence, reserved;
  uint16_t windowAccepted;
  uint32_t acceptedTotal;
  uint16_t noiseRejected, jumpRejected, dropoutCount, resetCounter;
};
static_assert(sizeof(TelemetryV1) == 36, "protocol size mismatch");

void IRAM_ATTR onPulse() {
  const uint32_t now = micros();
  const uint32_t period = now - irqLastUs;
  if (irqLastUs && period < MIN_PERIOD_US) { irqNoise++; return; }
  irqLastUs = now;
  if (period) irqPeriodUs = period;
  irqAccepted++;
}

static uint16_t sat16(uint32_t v) { return v > 65535 ? 65535 : (uint16_t)v; }

class ConfigCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &) override {
    std::string s = c->getValue();
    if (s.rfind("PPR=", 0) == 0) {
      float v = strtof(s.c_str() + 4, nullptr);
      if (isfinite(v) && v >= 0.1f && v <= 8.0f) {
        pulsesPerRev = v; prefs.putFloat("ppr", v);
      }
    } else if (s == "RESET_COUNTERS") {
      noInterrupts(); irqNoise = 0; interrupts();
      jumpRejected = dropoutCount = 0;
    }
    char reply[32]; snprintf(reply, sizeof(reply), "PPR=%.3f", pulsesPerRev); c->setValue(reply);
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(PULSE_PIN, INPUT_PULLDOWN);
  prefs.begin("rpm-bt", false);
  pulsesPerRev = prefs.getFloat("ppr", 1.0f);
  esp_reset_reason_t rr = esp_reset_reason();
  resetCounter = (rr == ESP_RST_POWERON) ? 0 : 1;
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, RISING);

  NimBLEDevice::init(DEVICE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P3);
  NimBLEServer *server = NimBLEDevice::createServer();
  NimBLEService *service = server->createService(SERVICE_UUID);
  telemetryChar = service->createCharacteristic(TELEMETRY_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  NimBLECharacteristic *cfg = service->createCharacteristic(CONFIG_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  cfg->setCallbacks(new ConfigCallbacks()); cfg->setValue("PPR=1.000");
  NimBLECharacteristic *info = service->createCharacteristic(INFO_UUID, NIMBLE_PROPERTY::READ);
  info->setValue("{\"fw\":\"1.0.0\",\"board\":\"ESP32-S3-N16R8\",\"protocol\":1,\"pulsePin\":4}");
  service->start();
  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID); adv->setName(DEVICE_NAME); adv->start();
}

void loop() {
  static uint32_t lastPublishMs = 0, lastSeenUs = 0, lastWindowAccepted = 0, lastWindowNoise = 0;
  static uint16_t lastWindowJump = 0;
  uint32_t nowMs = millis();
  if (nowMs - lastPublishMs < 100) { delay(2); return; }
  lastPublishMs = nowMs;

  uint32_t lastUs, periodUs, accepted, noise;
  noInterrupts(); lastUs = irqLastUs; periodUs = irqPeriodUs; accepted = irqAccepted; noise = irqNoise; interrupts();
  const uint32_t nowUs = micros();
  const bool off = !lastUs || (uint32_t)(nowUs - lastUs) > ENGINE_OFF_US;
  const uint32_t deltaAccepted = accepted - processedAccepted;

  if (!off && deltaAccepted && periodUs) {
    float raw = 60000000.0f / (periodUs * pulsesPerRev);
    bool plausible = raw >= 100.0f && raw <= 30000.0f;
    bool jump = filteredRpm > 0 && fabsf(raw - filteredRpm) / filteredRpm > MAX_STEP_FRACTION;
    if (plausible && (!jump || deltaAccepted >= 3)) {
      filteredRpm = filteredRpm == 0 ? raw : (0.28f * raw + 0.72f * filteredRpm);
      lastRawRpm = raw; acceptedTotal += deltaAccepted; lastSeenUs = nowUs;
    } else { jumpRejected = sat16((uint32_t)jumpRejected + deltaAccepted); }
    processedAccepted = accepted;
  }
  if (off) {
    if (!wasOff && lastSeenUs) dropoutCount = sat16((uint32_t)dropoutCount + 1);
    filteredRpm = lastRawRpm = 0;
  }
  wasOff = off;

  uint16_t window = sat16(accepted - lastWindowAccepted); lastWindowAccepted = accepted;
  uint32_t noiseDelta = noise - lastWindowNoise; lastWindowNoise = noise;
  uint16_t jumpDelta = jumpRejected - lastWindowJump; lastWindowJump = jumpRejected;
  int confidence = off ? 0 : 100 - min(60, (int)noiseDelta * 15) - min(40, (int)jumpDelta * 20);
  bool valid = !off && filteredRpm >= 100 && confidence >= 60;
  TelemetryV1 t{1, (uint8_t)((off ? 1 : 0) | (valid ? 2 : 0)), sequenceNo++, nowMs,
                filteredRpm, lastRawRpm, pulsesPerRev, (uint8_t)max(0, confidence), 0,
                window, acceptedTotal, sat16(noise), jumpRejected, dropoutCount, resetCounter};
  telemetryChar->setValue((uint8_t *)&t, sizeof(t)); telemetryChar->notify();
}

