# MotoLab Contact Analyzer v1

Standalone-PC-tutkimustyökalu jatkomutteriin tai muuhun moottorin kontaktipisteeseen kiinnitetyn BT-/kontaktisensorin datan tutkimiseen. Työkalua **ei ole integroitu tuotanto-MotoLabiin**, eikä se kirjoita ajoneuvoon tai muuta MotoLabin oppimismalleja.

## Turvaraja

RPM-osuma tai hyvältä näyttävä spektri ei todista, että tallenne on oikeaa moottorin värähtelyä. Tuloksen `engine_signal_accepted` pysyy epätotena, kunnes käyttäjä merkitsee signaalin erillisellä valinnalla todistetuksi ja automaattinen laatukynnys täyttyy. Knock-havainnot ovat tutkimusehdokkaita, eivät moottorin turvallisia säätökäskyjä.

## Ominaisuudet

- WAV, CSV, RAW/PCM ja ZIP -tuonti
- ZIP-polkujen tarkistus ja 512 MiB jäsenraja
- säädettävä high-pass/low-pass sekä knock-band-pass
- FFT, spektrogrammi ja aikatasosignaali samassa näkymässä
- RPM-arvio ja CSV:n `reference_rpm`-vertailu
- robustiin mediaani/MAD-kynnykseen perustuvat knock-/transienttiehdokkaat
- hiirellä maalattavat `NORMAL`, `KNOCK`, `MECHANICAL_HIT` ja `UNKNOWN` -merkinnät
- analyysin ja merkintöjen JSON/CSV-vienti
- kansiokohtainen batch-analyysi; yksi rikkinäinen tiedosto ei pysäytä erää
- deterministinen demoaineiston generaattori ja automaattitestit

## Asennus Windowsissa

Python 3.11 tai uudempi on suositeltu.

```powershell
cd tools\motolab_contact_analyzer
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python run_contact_analyzer.py
```

Matplotlib käyttää Tk-käyttöliittymää. Tavallinen python.orgin Windows-Python sisältää Tk:n.

## Tiedostomuodot

WAV tukee 8-, 16-, 24- ja 32-bittistä PCM-dataa sekä monikanavaisen tallenteen miksausta monoksi.

CSV tarvitsee yhden signaalisarakkeen nimellä `sample`, `value`, `amplitude`, `audio`, `signal` tai `contact`. Valinnaisia sarakkeita ovat `time_s`/`time` ja `reference_rpm`/`rpm`/`gps_rpm`. Aikasarakkeesta päätellään näytteenottotaajuus.

RAW/PCM tulkitaan oletuksena little-endian `int16`, 48 kHz. Käyttöliittymästä voi valita `int16`, `int32`, `float32` tai `float64` ja oikean näytteenottotaajuuden. RAW-tiedostossa ei ole metatietoa, joten arvot täytyy tietää tallennuslähteestä.

ZIP:stä valitaan deterministisesti ensimmäinen WAV, sitten CSV ja sitten RAW/PCM. Arkistoa ei pureta lähdekansioon.

## Käyttö

1. Avaa tiedosto.
2. Säädä suodatinrajat ja transientin z-kynnys.
3. Tarkista aikataso, FFT, spektrogrammi ja RPM rinnakkain.
4. Merkitse `Todistettu oikeaksi moottorin värähtelyksi` vain riippumattoman kenttätestin jälkeen.
5. Maalaa ylimmässä kuvaajassa aikaväli ja lisää ihmisen vahvistama luokka.
6. Vie analyysi ja merkinnät tulevia regressiotestejä varten.

Batch-ajon voi tehdä myös ilman käyttöliittymää:

```powershell
python run_contact_analyzer.py --batch C:\mittaukset --output C:\analyysi
```

`--verified-engine-signal` asetetaan vain, jos kaikki erän tiedostot ovat aidosti varmennettua moottorin kontaktisignaalia.

## Demo ja testit

```powershell
python scripts\generate_demo.py
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Demo luo `demo_data/demo_contact.wav`- ja `.csv`-tiedostot, joissa kierrosluku nousee ja mukana on kaksi synteettistä korkeataajuista transienttia.

## Tunnetut rajat

- RPM-arvio käyttää ikkunakohtaista vahvinta taajuutta; harmoninen voi voittaa perustaajuuden.
- Knock-taajuusalue riippuu moottorin geometriasta, anturista, kiinnityksestä ja näytteenottotaajuudesta.
- Bluetooth-koodekin automaattista tunnistusta ei tehdä; analyysi alkaa dekoodatusta PCM-signaalista.
- V1 ei opeta luokittelijaa eikä kirjoita tuotanto-MotoLabin dataan.

## Hakemistorakenne

- `motolab_contact_analyzer/io.py` — turvallinen tiedostotuonti
- `motolab_contact_analyzer/analysis.py` — suodatus, FFT, spektrogrammi, RPM ja transientit
- `motolab_contact_analyzer/annotations.py` — ihmisen tekemät luokat ja viennit
- `motolab_contact_analyzer/batch.py` — kansioanalyysi
- `motolab_contact_analyzer/app.py` — Tk/Matplotlib-käyttöliittymä
- `tests/` — regressiotestit
