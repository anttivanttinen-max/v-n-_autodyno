# VÄNÄ MotoRLab — Zeel Studio (DEV)

Erillinen kehityssovellus PCDI-10VT-aineiston lukemiseen, visualisointiin, versiointiin ja vertaamiseen. Se ei muuta tuotanto-MotoRLabia.

## Käynnistys

```powershell
python .\work\motolab_zeel_studio\app.py
```

Sovellus avaa oletuksena paikallisen, lopulliseen baselineen palautetun 480 tavun lukublokin, jos tiedosto on saatavilla. Muita 480 tavun `poll_values.bin`-tiedostoja voi avata käyttöliittymästä.

## Nykyiset ominaisuudet

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
