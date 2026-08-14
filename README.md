# VÄNÄ MOTOLAB v21 Unified

Yhdistetty master-versio kahden aiemman AutoDyno-pohjan parhaista osista.

## Tärkein periaate
Mittausputki on prioriteetti #1. Teho/RPM/AutoRide/tallennuslogiikka ajetaan Web Workerissa 20 Hz:n sisäisellä näytteenotolla. UI saa Workerilta vain noin 10 päivitystä sekunnissa. Mikrofonin raskas RPM-laskenta ajetaan omassa RPM Workerissa ja AudioWorklet kerää audion.

## Anturien toggle
- GPS-painike: päälle / toinen painallus pois (clearWatch)
- IMU-painike: päälle / toinen painallus pois (removeEventListener)
- PUHELIN MIC: päälle / toinen painallus pois (stream tracks stop + AudioContext close)
- BT / EXT MIC: sama, valittava audioinput asetuksista
- ANTURIT: GPS + IMU yhdessä päälle/pois

## Mukana
- hyväksytty Red-racing ulkoasu, oma pyörä taustalla
- akkupalkkia ei ole
- RPM-mittarin neula reagoi RPM-arvoon
- nykyisen vedon dynokäyrä pyörän päällä
- GPS + IMU
- Phone mic kokeellisena (ei oleteta toimivaksi ennen fyysistä testiä)
- BT / EXT MIC kokeellisena ulkoisena RPM-lähteenä
- RPM Fusion
- Auto Gear Learn
- Smart Bike Profiles
- Gear Auto -näyttö
- AutoRide / ARM AUTO
- manuaaliveto, joka päättyy vain STOPista
- vedon laatu
- delta edelliseen
- avattavat yksittäiset vedot
- hylätyt vedot voidaan ottaa vertailuun
- usean vedon päällekkäisvertailu
- usean vedon yhdistetty referenssikäyrä
- täysruudun dynokäyrä, zoom + pistearvon luku
- kaasuttimen säätö ja suutin-ehdotus
- AutoTune-testiehdotus
- IndexedDB vetodatalle, localStorage fallback
- Wake Lock
- demo/stress-testitila

## iPhone / selain
GitHub Pages HTTPS tarvitaan GPS:lle, mikrofonille, Wake Lockille ja sensoreille. iOS pyytää Motion-luvan käyttäjän painalluksesta.

Huom: fyysisiä GPS/IMU/Phone Mic/BT Mic signaaleja ei voida täysin validoida automaattisessa työpöytäselaimessa. V21 sisältää kuitenkin virheenkestävät fallbackit ja kaikki sensorit vapautetaan oikeasti OFF-tilassa.
