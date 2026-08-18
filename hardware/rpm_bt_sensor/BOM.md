# BOM — RPM-BT V1

## Project evidence versus physical stock

The repository identifies an ESP32-S3 N16R8 and a previously supplied Partco list as project inputs. It does **not** prove which exact parts are currently on the bench. Compare package markings and quantities before building; missing items are not claimed to exist.

## Minimum bench build

| Qty | Part | Exact requirement | Purpose |
|---:|---|---|---|
| 1 | ESP32-S3 development board | N16R8 preferred; exact carrier pinout must be checked | MCU + BLE |
| 1 | Schmitt inverter | 74HC14 at 3.3 V, DIP-14 for supplied placement drawing; or a separately laid-out 74LVC1G14 | Clean pulse/hysteresis |
| 1 | R1 | 100 kΩ, 0.25 W | Pickup current limiting |
| 1 | R2 | 10 kΩ, 0.25 W | SENSE discharge/bias |
| 1 | R4 | 1 kΩ | GPIO isolation |
| 1 | C1 | 1 nF, C0G/film, at least 100 V | Input RF/high-frequency filtering |
| 1 | clamp pair | BAT54S wired to 0 V and 3.3 V per placement guide | SENSE rail clamp |
| 1 | decoupling capacitor | 100 nF ceramic at IC VCC/GND | Logic supply decoupling |
| 1 | bulk capacitor | 10 µF at board power input | Local supply reserve |
| 0.5 m | insulated pickup wire/pair | Heat-resistant; twisted after wrap | 3–6 turn non-contact pickup |
| 1 | perfboard/breadboard | Match selected IC package | Prototype assembly |
| 1 | USB power bank | No vehicle-ground connection | Safest V1 road power |

## Required before vehicle/road testing

| Qty | Part | Requirement |
|---:|---|---|
| 1 | non-conductive enclosure | Flame-retardant/splash-resistant, antenna clearance |
| 2 | cable glands/strain reliefs | Pickup and USB/power leads |
| several | heat sleeve, P-clips, ties | Automotive temperature grade; no exhaust/moving contact |
| 1 | shielded pair (if run >300 mm) | Shield grounded only at enclosure sensor GND |

## Optional

| Qty | Part | Requirement / warning |
|---:|---|---|
| 1 | LED + resistor | LED and 1 kΩ from verified GPIO48 |
| 1 | automotive 9–16 V → 5 V converter | Deferred until exact module, fuse, reverse-polarity and transient protection are verified; power bank remains V1 default |

Never substitute a 5 V-only logic device or a comparator module that pulls its output to 5 V. Do not connect CDI, coil negative, HT copper, engine or chassis to the pickup input.
