# VÄNÄ MotoLab Zeel Capture 1.0

Windows-työkalu ZeelProg ↔ Zeeltronic PC-USB -liikenteen häviöttömään tallennukseen. Valmis oletusreitti on:

`ZeelProg → COM10 ⇄ COM11 → MotoLab Capture → COM7 → Zeeltronic FTDI`

ZeelProg avaa COM10:n. Capture avaa virtuaaliparin oman COM11-päänsä ja fyysisen COM7-portin. Capture välittää vain sarjaporteilta vastaanotettuja tavuja: se ei generoi, tulkitse, muuta eikä lisää omia CDI-komentoja.

## Asennus

Aja PowerShellissä:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-MotoLab-Zeel-Capture.ps1
```

Asennus kopioi ohjelman `%LOCALAPPDATA%\MotoLab\ZeelCapture`-kansioon ja luo **MotoLab Zeel Capture** -työpöytäkuvakkeen.

## Käyttö

1. Varmista Laitehallinnasta, että virtuaalipari on COM10 ⇄ COM11 ja Zeeltronic FTDI on COM7.
2. Sulje ZeelProg, jos se on jo auki. Käynnistä **MotoLab Zeel Capture** työpöydältä.
3. Paina **START PROXY** ja odota vihreää **YHDISTETTY**-tilaa.
4. Avaa ZeelProg ja valitse sen portiksi **COM10**. Älä valitse COM11:tä tai COM7:ää ZeelProgissa.
5. Tee yksi tarkoituksellinen ZeelProg-toiminto tai asetusmuutos kerrallaan.
6. Lopeta ZeelProgin toiminto ja paina Capturessa punaista **STOP**-painiketta.
7. Avaa sessio **AVAA DATAKANSIO** -painikkeella ja säilytä `.raw`-tiedostot muuttamattomina.

STOP sulkee portit ja viimeistelee lokit sekä `summary.json`-yhteenvedon. Jos COM7 tai COM11 irtoaa, tila vaihtuu **RECONNECT...**-tilaan. Capture kirjaa virheen, ei lähetä reconnectin aikana mitään ja yrittää avata molemmat portit uudelleen kahden sekunnin välein.

## Tallennusmuodot

Jokainen sessio tallentuu kansioon `Documents\MotoLab\ZeelCapture\YYYY-MM-DD_HH-mm-ss-fff\`:

- `pc_to_zeel.raw` – COM11:ltä vastaanotettu muuttamaton tavujono
- `zeel_to_pc.raw` – COM7:ltä vastaanotettu muuttamaton tavujono
- `events.jsonl` – järjestysnumero, monotoninen mikrosekuntiaika, UTC-aika, suunta, pituus, HEX ja ASCII
- `timeline.csv` – sama aikajana taulukkomuodossa
- `session.json` – portit, baudinopeus ja turvametadata
- `summary.json` – tavut, lukuosat, kesto, reconnect-yritykset ja hallittu STOP

Vastaanotettu tavuerä tallennetaan RAW-lokiin ennen välitysyritystä. Näin myös välitysvirhettä välittömästi edeltänyt vastaanotto säilyy todisteena. RAW-tiedostot ovat suuntakohtaisia tavujonoja; tarkat erärajat ja aikaleimat ovat JSONL/CSV-aikajanassa.

## Asetusten vaihto

Oletuksia voi tarvittaessa vaihtaa komentoriviltä:

```powershell
.\MotoLab-Zeel-Capture.ps1 -CapturePort COM11 -ZeelProgPort COM10 -HardwarePort COM7 -Baud 115200
```

Sarja-asetus on 8N1 ilman flow controlia. DTR ja RTS ovat päällä kuten tavallisessa Zeeltronic FTDI -yhteydessä.
