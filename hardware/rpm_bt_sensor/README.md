# VÄNÄ MotoLab RPM-BT V1

Tutkimuskelpoinen induktiivinen kierroslukuanturi. Eristetty pickup-johto kierretään tulpanjohdon ympärille; se ei tee galvaanista kytkentää sytytysjärjestelmään. Suojaus ja Schmitt-trigger muuttavat impulssin 3,3 V logiikaksi ESP32-S3:lle. Laite lähettää mittaukset BLE:llä Windows-testerille ja myöhemmin MotoLabille.

> Tila: tutkimusprototyyppi. Ei tuotanto-MotoLabiin ilman erillistä lupaa. Learning-vaiheessa GPS on auktoriteetti. Kamera on pois käytöstä. Audiota tai kontaktimikrofonia ei käytetä oppimiseen ennen moottorisignaalin validointia.

## Sisältö

- `BUILD_ME.md` – ostot, rakentaminen, asennus, kalibrointi, testi ja hyväksyntä
- `BOM.csv` – lopullinen osaluettelo ja hankintatila
- `WIRING.md` – pinni-pinniltä kytkentä ja suojauspiirin mitoitus
- `firmware/rpm_bt_sensor/rpm_bt_sensor.ino` – Arduino-ESP32 3.3.11 firmware
- `protocol/BLE_PROTOCOL.md` – BLE- ja MotoLab-sopimus
- `windows/rpm_bt_logger.py` – Windows BLE-testeri ja CSV/JSONL/RAW-loki
- `windows/START_RPM_BT.cmd` – yhden klikkauksen käynnistin
- `tests/test_parser.py` – protokollan ja lokirivin yksikkötestit
- `diagrams/` – kytkentä- ja järjestelmäkaaviot

## Turvallisuus

Älä kuori, puhkaise tai kytke tulpanjohtoa sähköisesti. Sammuta moottori ennen pickupin asentamista. Pidä elektroniikka erossa pakoputkesta, sylinteristä, ketjusta, puhaltimesta, polttoaineesta ja sytytyspuolan ensiö-/toisiojohdoista. Käytä suljettua eristävää koteloa ja vedonpoistoa. Prototyyppi ei ole ajoneuvohyväksytty.


