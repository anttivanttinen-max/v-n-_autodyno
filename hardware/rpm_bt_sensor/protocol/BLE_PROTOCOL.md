# BLE protocol v1 ja MotoLab integration contract

Laite mainostaa nimellä `MotoLab-RPM-BT`. Kaikki UUID:t ovat 128-bittisiä:

- Service: `7b7d0001-6b8a-4f2a-9c4b-3b9a4e4d0001`
- Telemetry notify/read: `7b7d0002-6b8a-4f2a-9c4b-3b9a4e4d0001`
- Config write/read: `7b7d0003-6b8a-4f2a-9c4b-3b9a4e4d0001`
- Device info read: `7b7d0004-6b8a-4f2a-9c4b-3b9a4e4d0001`

## Telemetry, little-endian, packed, 36 bytes

| Offset | Type | Field | Unit |
|---:|---|---|---|
| 0 | uint8 | version (=1) | - |
| 1 | uint8 | flags: bit0 engineOff, bit1 signalValid | - |
| 2 | uint16 | sequence | wraps |
| 4 | uint32 | uptimeMs | ms |
| 8 | float32 | rpm | rpm |
| 12 | float32 | rawRpm | rpm |
| 16 | float32 | pulsesPerRev | pulse/rev |
| 20 | uint8 | confidence | 0..100 |
| 21 | uint8 | reserved | 0 |
| 22 | uint16 | windowAccepted | count |
| 24 | uint32 | acceptedTotal | count |
| 28 | uint16 | noiseRejected | count, saturating |
| 30 | uint16 | jumpRejected | count, saturating |
| 32 | uint16 | dropoutCount | count, saturating |
| 34 | uint16 | resetCounter | count |

Notify 10 Hz. RAW-loki tallentaa payloadin heksana täsmälleen vastaanotetussa muodossa.

## Config

UTF-8 ASCII komennot, enintään 31 tavua:

- `PPR=1.000` asettaa 0.1–8.0 pulsesPerRev ja tallentaa NVS:ään.
- `RESET_COUNTERS` nollaa noise/jump/dropout-laskurit.
- `PING` ei muuta asetuksia.

Info-characteristic palauttaa JSON:n: firmware, board, protocol ja pulsePin.

## MotoLab contract

Adapteri tuottaa sisäisen tapahtuman:

```json
{"source":"rpm_bt_v1","t_monotonic_ms":1234,"rpm":6123.4,"confidence":93,"signalValid":true,"engineOff":false,"sequence":42,"pulsesPerRev":1.0,"counters":{"accepted":400,"noise":2,"jump":1,"dropout":0,"resets":0}}
```

Säännöt:

1. Adapteri käyttää koneen monotonista vastaanottoaikaa ja säilyttää laitteen `uptimeMs`:n diagnostiikkaan.
2. Sekvenssiaukko kasvattaa hostin `blePacketLoss`-laskuria; se ei interpoloi puuttuvaa RPM:ää.
3. `signalValid=false`, `engineOff=true`, confidence <60 tai yli 500 ms vanha näyte ei saa olla dynolaskennan auktoriteetti.
4. Learning-vaiheen auktoriteetti on GPS. RPM-BT on kandidaatti/validointisignaali, kunnes hyväksymiskriteerit täyttyvät ja tuotantolupa annetaan.
5. Kamera pysyy pois. Audio/kontaktimikki on vain fallback/tutkimuspolku eikä saa opettaa mallia ilman validoitua moottorisignaalia.
6. Mittauspolku tekee vain BLE-dekoodauksen, ikä-/confidence-portituksen ja tapahtuman välityksen; lokitus ja analyysi ovat sivupolulla.
7. Integraatio feature flagin `rpmBtResearchEnabled` takana, oletus `false`. Ei automaattista tuotantoaktivointia.


