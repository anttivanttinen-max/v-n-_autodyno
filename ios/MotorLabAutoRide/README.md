# MotorLab Auto Ride for iPhone

Native iOS shell for automatic ride detection when the MotorLab web/PWA UI is not open.

## Flow

1. User launches MotorLab once and grants Location = Always.
2. CoreLocation significant-location monitoring remains armed.
3. When iOS relaunches/wakes the app for location activity, MotorLab waits for three credible moving samples at >= 8 km/h.
4. A confirmed ride switches to high-accuracy location updates and immediately persists GPS points in Documents/MotorLabAutoRides/current.json.
5. A stop is finalized only after 180 seconds below 2 km/h, so traffic lights do not end the ride.
6. Completed rides are stored as ride-<timestamp>.json.

## Important iOS boundary

Background location is native. Microphone/RPM capture must follow iOS audio-session/background rules and is intentionally not faked here. The existing MotorLab web dyno engine remains unchanged. The next integration step is to bridge the native ride-start event into the MotorLab measurement UI/runtime when it is available, and add a native audio capture path if unattended background RPM audio is required.

## Build

Install XcodeGen, run `xcodegen generate` in this directory, open `MotorLabAutoRide.xcodeproj`, select a Development Team, then build to the iPhone. Background Modes -> Location updates is represented by `UIBackgroundModes=location` in Info.plist.
