# MotoLab Zeel Capture v1

Windows-työkalu Zeeltronic PC-USB -liikenteen häviöttömään tutkimukseen. Tunnettu testattu USB-adapteri: FTDI VID `0403`, PID `6001`.

## Tavoite

1. tunnistaa Zeeltronic FTDI automaattisesti
2. tunnistaa ESP32-S3 Single Serial / CH343 debug-portti
3. tallentaa jokainen saatu tavupaketti alkuperäisenä RAW-datana
4. tallentaa aikajana JSONL- ja CSV-muodossa HEX- ja ASCII-esityksineen
5. mahdollistaa ZeelProg-liikenteen läpinäkyvä proxy, kun Windowsissa on virtuaali-COM-pari
6. rakentaa sessioista haettava indeksi, tavuhistogrammit, n-grammit ja kahden session binääridiffit
7. pitää analyysi erillään alkuperäisestä RAW-datasta

## Turvamalli

`READ-ONLY` ei generoi eikä lähetä CDI:lle omia komentoja. Se avaa fyysisen FTDI-portin ja tallentaa vain saapuvan datan.

`ZEELPROG PROXY` välittää ZeelProgin aidosti lähettämät tavut fyysiselle Zeeltronic-portille ja tallentaa molemmat suunnat. Capture ei itse keksi tai muodosta Zeeltronic-komentoja.

Virtuaalisen COM-portin luominen Windowsiin vaatii kernel-ajurin ja järjestelmänvalvojan hyväksynnän. Tätä paketti ei asenna huomaamatta. Kun sopiva virtuaali-COM-pari on asennettu, Capture tunnistaa tyypilliset com0com/CNCA/CNCB/Virtual-nimet automaattisesti.

## Sessiorakenne

Jokainen käynnistys tallentuu kansioon:

`Documents\MotoLab\ZeelCapture\YYYY-MM-DD_HH-mm-ss\`

Tiedostot:

- `session.json` – versio, portit, baud, laite- ja turvametadata
- `events.jsonl` – jokainen havaittu paketti aikaleimalla, suunnalla, HEXillä ja ASCIIlla
- `timeline.csv` – sama taulukkokäyttöön
- `zeel_to_pc.raw` – muuttamaton vastaanotettu binäärivirta
- `pc_to_zeel.raw` – muuttamaton lähetetty binäärivirta proxy-tilassa
- `summary.json` – tavut, paketit ja kesto
- `analysis/*.analysis.json` – johdettu analyysi; ei korvaa RAW-dataa

## Käyttö

Aja `MotoLab-Zeel-Capture.ps1` PowerShellissä tai asenna työpöytäkuvake `Install-MotoLab-Zeel-Capture.ps1`:llä.

Ensimmäinen testijärjestys:

1. Zeeltronic PC-USB suoraan Windowsiin.
2. Paina **TUNNISTA**. Fyysisen portin pitäisi näkyä `zeel-ftdi`-merkinnällä.
3. Aloita **READ-ONLY** ennen protokollan kirjoituspuolen tutkimusta.
4. Kun virtuaali-COM-pari on erikseen asennettu, Capture avaa parin toisen pään ja ZeelProg asetetaan käyttämään parin toista päätä.
5. Tee yksi tarkoituksellinen asetusmuutos kerrallaan ZeelProgissa ja pysäytä sessio selvästi muutoksen jälkeen.
6. Paina **ANALYSOI** tai aja `Analyze-ZeelCapture.ps1`.

## Diff-haku

Kahden session vertailu:

```powershell
.\Analyze-ZeelCapture.ps1 -SessionA 2026-08-18_18-00-00 -SessionB 2026-08-18_18-05-00
```

Tekstihaku koko arkistosta:

```powershell
.\Analyze-ZeelCapture.ps1 -Search "AA 55"
```

Analyysi tuottaa binäärioffset-diffit sekä 2–8 tavun yleisimmät n-grammit. Tämä auttaa tunnistamaan vakioheaderit, komennot, osoitteet, payload-pituudet, karttapisteet ja mahdolliset checksum/CRC-kentät useiden kontrolloitujen sessioiden yli.

## Mitä ei vielä oleteta

Zeeltronicin julkisesti dokumentoimattomia komentokoodeja, baudinopeutta, checksumia tai karttaformaattia ei arvata. Ne päätellään aidosta liikenteestä ja jokainen päätelmä sidotaan alkuperäiseen capture-sessioon.
