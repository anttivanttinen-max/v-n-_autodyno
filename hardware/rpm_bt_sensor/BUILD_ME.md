# BUILD ME – RPM-BT V1

## 1. Hanki ja varmista

Osta kaikki `BOM.csv`:ssä `TARVITAAN` merkityt osat. ESP32-S3 N16R8 on ehdollisesti sopiva: varmista kortin malli, 3,3 V logiikka, GPIO4:n saatavuus ja Arduino-ESP32 3.3.11 -tuki. BOM:n status tarkoittaa projektissa varmennettua tietoa, ei sitä että osa olisi fyysisesti käyttäjän hallussa.

## 2. Rakenna pöydällä

1. Juota ensin U2, R2, R3, C1, R4, C2 ja C3 reikälevylle tai PCB:lle.
2. Lisää D1, D2, R1 ja J1. Pidä J1–R1–D2–GND -silmukka lyhyenä.
3. Mittaa ilman ESP32:ta: 3V3–GND ei ole oikosulussa; FILTER–GND noin 1 MΩ DC; PICKUP–GND ei ole suora oikosulku.
4. Kytke ESP32 pinni-pinniltä `WIRING.md`:n mukaan. Syötä virta USB-virtapankista.
5. Älä kytke prototyyppiä ajoneuvon 12 V järjestelmään.

## 3. Lataa firmware

Arduino IDE: asenna esp32 board package **3.3.11**, valitse tarkkaa korttia vastaava ESP32-S3-profiili, USB CDC On Boot `Enabled`, flash 16 MB ja PSRAM OPI 8 MB vain jos korttivalmistaja niin määrittää. Avaa `firmware/rpm_bt_sensor/rpm_bt_sensor.ino`, tarkista `PULSE_PIN`, käännä ja lataa. Ulkoisia Arduino-kirjastoja ei tarvita ESP32-core:n lisäksi.

## 4. Asenna pickup

Moottori pois ja jäähtynyt. Tee aluksi 3 kierrosta eristettyä pickup-johtoa yhden tulpanjohdon ympärille 50–100 mm päähän tulpan hatusta. Lukitse lämpökutisteella/kaapelisiteillä puristamatta tulpanjohtoa. Reititä kierretty pari kohtisuoraan pois sytytyspuolasta ja suurvirtajohdoista. Kiinnitä kotelo viileään, kuivaan, tärinältä suojattuun paikkaan. Lisää kierroksia enintään kuuteen vain jos pulssit puuttuvat. Jos noise/jump kasvaa, vähennä kierroksia tai siirrä pickupia kauemmas hatusta.

## 5. Windows-testi

Asenna Python 3.11+ ja kaksoisnapsauta `windows/START_RPM_BT.cmd`. Käynnistin luo paikallisen ympäristön, asentaa `bleak`-kirjaston, etsii `MotoLab-RPM-BT`-laitteen ja tallentaa saman session `logs/`-kansioon CSV-, JSONL- ja RAW-tiedostoina. Lopeta Ctrl+C.

## 6. pulsesPerRev

Oletus `1.0` tarkoittaa yhtä havaittua sytytyspulssia per kampiakselin kierros. Tyypillinen nelitahti erillisellä puolalla voi vaatia `0.5`; wasted-spark usein `1.0`; monisylinterisen pickupin tulos riippuu siitä, minkä johdon ympärillä pickup on. Älä päättele arvoa pelkästä moottorityypistä.

Kalibroi tasaisella kierrosluvulla GPS-auktoriteettiin tai luotettavaan huoltotakometriin nähden. Windows-työkalussa `--ppr 0.5`, `--ppr 1`, `--ppr 2` jne. Työkalu kirjoittaa asetuksen BLE CFG -characteristiciin. Hyväksy arvo, kun RPM-suhde pysyy ±3 % vähintään 30 s kolmella tasolla. Learning-vaiheessa GPS on auktoriteetti; audio ei opeta mallia ennen tämän signaalin validointia.

## 7. Testijärjestys

1. **Kuollut pöytä:** 60 s ilman moottoria: RPM 0, engineOff=true, accepted=0.
2. **Synteettinen 3,3 V pulssi:** syötä turvallisesta generaattorista GPIO-puolelle 10–200 Hz, 50 % duty; älä syötä yli 3,3 V. Vertaile odotukseen `RPM=Hz*60/PPR`.
3. **Tyhjäkäynti:** 2 min; etsi vakaa RPM ja säädä pickupin paikka/kierrokset.
4. **Kolme tasoa:** tyhjäkäynti, keski, korkea; 30 s/taso ja vertailuarvo.
5. **Nopea muutos:** hallittu kiihdytys/hidastus; varmista ettei jump rejection jäädy oikeaa signaalia yli 500 ms.
6. **Dropout:** irrota pickup moottorin käydessä vain kotelon J1:stä; engineOff viimeistään 1,5 s ja dropout kasvaa.
7. **EMI:** valot/tuulettimet päälle/pois; false RPM moottori sammutettuna = 0.
8. **30 min soak:** tarkista lämpö, BLE, lokien jatkuvuus ja kotelon kiinnitys.

## Hyväksymiskriteerit

- Ei galvaanista yhteyttä tulpanjohtoon; kotelo suljettu ja vedonpoisto tehty.
- Synteettinen testi: ±1 % taajuudesta 10–200 Hz.
- Vertailutesti: mediaanivirhe ≤3 % ja 95. persentiili ≤5 % kullakin kolmella vakaalla tasolla.
- Vakaalla tasolla confidence ≥80 vähintään 95 % näytteistä.
- Engine-off ≤1,5 s viimeisestä hyväksytystä pulssista; sammutettuna ei yhtään hyväksyttyä RPM-näytettä 60 sekunnissa.
- BLE-sekvenssiaukkoja alle 1 % / 30 min, loggeri merkitsee kaikki aukot.
- Jump reject alle 2 % hyväksytyistä pulsseista vakaalla kierrosluvulla; noise reject ei kasva jatkuvasti moottori sammutettuna.
- ESP32/U2/suojaus ei lämpene käsin havaittavasti ja resetCounter ei kasva testin aikana.
- Tuotantointegraatio jää feature flagin taakse ja vaatii erillisen luvan.

## Fyysinen luovutuslista

Käyttäjän pitää: hankkia BOM-osat; varmistaa ESP32-kortin pinout; juottaa suojaus/piirinmuokkaus; tehdä 3–6 kierroksen eristetty pickup; asentaa suojattu kierretty pari, kotelo ja vedonpoisto; flashata firmware; suorittaa yllä olevat kahdeksan testiä; toimittaa CSV/JSONL/RAW sekä vertailuarvot hyväksyntää varten.


