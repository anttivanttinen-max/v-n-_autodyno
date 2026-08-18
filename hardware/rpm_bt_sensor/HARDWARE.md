# Hardware architecture and build detail

## Source choice

| Method | Role | Strength | Main risk | Decision |
|---|---|---|---|---|
| Inductive spark-lead pickup | Primary v1 reference | Direct events, small CPU load, no engine contact | EMI, pulses-per-rev configuration | Selected |
| Contact vibration / BT earbud | Parallel validation | Already strong evidence at 6591 vs ~6600 RPM, 92.2% confidence | Bluetooth audio routing, resonances, charging/runtime | Keep as independent shadow reference |
| Hall / optical | Future lab reference | Exact event geometry | Requires magnet/target, alignment and rotating-part work | Optional only |

The contact result proves the mount is valuable, but an ordinary BT earbud cannot feed samples directly to ESP32-S3 BLE firmware without a separately confirmed audio front end. Therefore it is not invented into the v1 electrical BOM.

## What is verified vs proposed

### Verified in project context

- ESP32-S3 N16R8 board exists/has been selected. Exact carrier-board model and its printed pin map remain to be photographed.
- Extension nut + tightly packed aluminium shim contact mount.
- Strong reference observation: estimated ~6600 RPM, audio average ~6591 RPM, confidence ~92.2%, f0 ~109–112 Hz.

### Proposed v1 BOM — confirm/acquire

| Qty | Part | Value / requirement |
|---:|---|---|
| 1 | 74HC14 or 74LVC1G14 Schmitt inverter | 3.3 V operation; verify the exact part supports 3.3 V |
| 1 | Series resistor R1 | 100 kΩ, 0.25 W |
| 1 | Shunt resistor R2 | 10 kΩ, 0.25 W |
| 1 | Input capacitor C1 | 1 nF, >=100 V, C0G/film preferred |
| 1 | Clamp pair D1 | BAT54S to 0 V / 3.3 V rails |
| 1 | Schmitt pull-up/pull-down R3 | 100 kΩ (fit according to inverter topology below) |
| 1 | Output resistor R4 | 1 kΩ between Schmitt output and GPIO4 |
| 2 | Decoupling capacitors | 100 nF ceramic at IC and 10 µF at board input |
| 1 | Pickup wire pair | Insulated, twisted after the pickup loop; no galvanic engine connection |
| 1 | Enclosure | Splash resistant, cable glands, nonconductive preferred |
| 1 | Optional buck converter | Automotive-rated 9–16 V to regulated 5 V, input fuse and transient protection |
| 1 | Optional LED + resistor | LED and 1 kΩ |

If a comparator module is substituted, it must run at 3.3 V and its OUT must never exceed 3.3 V. Common 5 V LM393 modules often pull OUT up to 5 V: do not connect one without changing/verifying the pull-up.

## Pin-by-pin wiring (ESP32-S3)

| ESP32-S3 signal | Connect to | Notes |
|---|---|---|
| GPIO4 | R4 1 kΩ -> Schmitt OUT | Digital pulse input, interrupt on rising edge |
| 3V3 | Schmitt VCC, clamp high rail | Do not power external 5 V logic here |
| GND | Schmitt GND, clamp low rail | Sensor-side local ground only; pickup is isolated |
| GPIO48 | 1 kΩ -> LED -> GND | Optional; change `PIN_STATUS_LED` if board LED differs |
| GPIO0 | Button -> GND | Optional config/session marker; also BOOT on many boards |
| USB | PC / clean USB supply | Flash, serial debug and preferred bench power |
| 5V/VBUS | Approved regulated 5 V only | Exact board pin name must be checked on silkscreen |

Avoid GPIO19/20 for the sensor because many ESP32-S3 boards use them for native USB. Avoid flash/PSRAM pins; N16R8 carrier pin availability depends on the exact board.

## Protected pickup input

`PICKUP+ -> C1 1 nF -> R1 100k -> node SENSE`. `PICKUP- -> local GND` only at the input board. `R2 10k` connects SENSE to GND. BAT54S clamps SENSE to 0/3.3 V. SENSE drives one Schmitt input. The Schmitt output goes through R4 1k to GPIO4. Power the Schmitt from 3.3 V and place 100 nF directly across its supply pins.

This is an empirical low-energy pickup front-end, not a connection to the ignition circuit. Start with three turns around the insulated high-tension lead. Too few pulses: increase turns one at a time. Double triggers/noise: reduce turns, increase spacing from coil/CDI, shorten the unshielded loop, and use the firmware debounce.

## Mechanics

- Put the electronics enclosure on the frame in moving air, away from cylinder/head/exhaust, coil and CDI. Target enclosure temperature under 60 °C.
- Lead the pickup wire away from the plug cap, then twist the outbound/return pair. Cross power wires at 90° where possible.
- Add two-stage strain relief: cable gland at enclosure and a soft frame tie 50–100 mm away. Leave a service loop; do not let the lead touch exhaust or steering stops.
- Support the PCB with four soft standoffs or thin closed-cell foam at enclosure edges. Do not encapsulate the antenna; keep the ESP32 antenna end against plastic with at least 10 mm clearance from metal/battery.
- Keep USB connector accessible for the first tests. Seal only after the full acceptance test.

### Contact reference mount

Use only the validated geometry: extension nut on the cylinder/head stud, then aluminium shim packed so the earbud/contact transducer is rigidly preloaded. Add an independent safety tether. Keep it clear of hot surfaces and do not load the earbud battery at high temperature. These runs are tagged `contact_audio_reference`; do not mix older no-extension-nut calibration into the same set.

## Power and grounding

Bench: USB power only. Vehicle: the safest first ride is a USB power bank inside the enclosure/bag. A vehicle-battery buck is optional and unverified until its exact module is known. If used, add a small fuse close to battery positive, reverse-polarity protection and automotive transient suppression per the converter maker. Never use motorcycle chassis or engine as a pickup conductor. Do not connect USB and an unknown vehicle 5 V source simultaneously.

