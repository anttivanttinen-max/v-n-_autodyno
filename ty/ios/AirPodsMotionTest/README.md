# VÄNÄ MotoLab — AirPods Motion Test

Minimal native iOS test app for `CMHeadphoneMotionManager`.

Purpose:
- verify `isDeviceMotionAvailable` on the physically connected headphones
- show Core Motion authorization state
- start/stop headphone device-motion updates
- display gravity, user acceleration, rotation rate and attitude values live
- make it explicit when the connected headphones do not expose headphone motion to iOS

This test does **not** change the MotoLab PWA or its measurement logic.

## Build without owning a Mac

GitHub Actions uses a hosted macOS runner, installs XcodeGen, generates the Xcode project and performs an unsigned iOS Simulator build. This proves the source compiles without requiring a local Mac.

CI workflow: `.github/workflows/ios-airpods-motion-test.yml`.

A simulator cannot answer whether a real AirPods pair supports headphone motion. The final `isDeviceMotionAvailable` test must run on a real iPhone with the headphones connected.

## Installing on an iPhone

A real-device iOS app must be Apple-signed. For TestFlight/App Store or registered-device distribution, configure an Apple Developer Program signing identity/provisioning profile. No certificate, private key or provisioning profile is committed to this public repository.

The CI workflow intentionally uses `CODE_SIGNING_ALLOWED=NO`; it builds the test app but does not produce an installable signed IPA.

## Test procedure

1. Pair/connect the headphones normally in iOS Bluetooth settings.
2. Open **MotoLab Motion Test** on the iPhone.
3. Press **TARKISTA AIRPODS MOTION**.
4. Read `isDeviceMotionAvailable`:
   - `YES` = iOS exposes headphone motion for the current connected headphones.
   - `NO` = the current headphones cannot be used through `CMHeadphoneMotionManager` on that device/setup.
5. If available, press **KÄYNNISTÄ MOTION** and move/vibrate the headphones. Values should update live.

## Privacy

The test app stores and uploads nothing. Motion values only exist in memory while the app is running.
