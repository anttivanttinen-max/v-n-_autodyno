# VÄNÄ MotorLab — Zeel Studio (DEV)

Erillinen kehityssovellus PCDI-10VT-aineiston lukemiseen, visualisointiin, versiointiin ja vertaamiseen. Se ei muuta tuotanto-MotorLabia.

## Käynnistys

```powershell
python .\work\motolab_zeel_studio\app.py
```

Sovellus avaa oletuksena paikallisen, lopulliseen baselineen palautetun 480 tavun lukublokin, jos tiedosto on saatavilla. Muita 480 tavun `poll_values.bin`-tiedostoja voi avata käyttöliittymästä.

## Nykyiset ominaisuudet

### Valikot

- **Tiedosto:** avaa RAW-blokki, tallenna versio, avaa lähdekansio ja sulje
- **Yhteys:** päivitä yhteys, tarkista laite ja suorita turvallinen CDI-luku
- **CDI-laite:** tunnistus ja kaikkien asetusten luku; kirjoitus, Program ja rollback näkyvät lukittuina
- **Kartat:** sytytyskartat, YPVS/PV, limiter ja Shift Light
- **Versiot:** tallennus, vertailu, versioluettelo ja rollback-varaus
- **Kaappaus:** RAW-näkymä, USBPcap-tila, kaappauskansio ja kaappauksen käynnistys
- **Työkalut:** eheystarkistus, auditointi sekä varaukset autotunelle ja protokollakartoitukselle
- **Näkymä:** suora siirtyminen jokaiseen välilehteen ja kaikkien tilojen päivitys
- **Ohje:** käyttöohje, turvarajat ja versiotiedot

- PCDI-10VT:n laitetilan tarkistus ZeelProg-sillan kautta
- Ignition Map #1 ja #2 graafisesti ja taulukkona
- Shift Light -peilien yhdenmukaisuuden tarkistus
- SHA-256-lähdejälki
- paikalliset muuttumattomat versiot (`.bin` + `.json`)
- kahden 480 tavun lukublokin offset-diff
- todistettujen ja tuntemattomien muutosten erottelu
- USBPcap-ympäristön ja uusimman kaappauksen tilan näyttö
- RAW-heksanäkymä, lähdepolku, koko, kuvaus ja täydellinen SHA-256
- YPVS-, limiter- ja Shift Light -kenttien todistetason erottelu
- tallennettujen versioiden määrä ja uusimman version tunnistus
- append-only auditointiloki latauksista, laitetarkistuksista, live-luvuista, versioista ja vertailuista
- kirjoitusnäkymä, joka pysyy tarkoituksella lukittuna

## Turvaraja

Sovellus ei vielä kirjoita CDI:lle. Kirjoitus avataan kenttäkohtaisesti vasta, kun sovelluksen arvon siirto ZeelProgiin, ennen-snapshot, Program, Read, tarkka readback ja rollback on testattu yhtenä tapahtumana. Shift Lightin tavukartoitus tunnetaan, mutta UI-arvon asettamisen ja koko tapahtuman atomisuutta ei ole vielä todistettu.
