# VÄNÄ MotoLab v31 Core Sprint

Tämä on v30-pohjan jatkokehitys ilman toimivien perusominaisuuksien poistamista.

## V31 ydinkorjaukset
- Korjattu AutoRide/Asetukset-näkymien päällekkäiset HTML-ID:t (`recordFrom`, `stopRpm`, `autoSensitivity`, `autoStopDelay`).
- Korjattu puuttuvan `demoBtn`-elementin aiheuttama mahdollinen käynnistysvirhe.
- Korjattu GPS-autokalibroinnin kahdentunut vakauslohko.
- Oppimisdatan flush on nyt lukittu, jotta päällekkäiset IndexedDB-tallennukset eivät pilko dataa turhaan.
- Lisätty Service Worker ja offline-kuori GitHub Pages/PWA-käyttöä varten.

## RPM Fusion v31
- Vanha fingerprint + autokorrelaatio + 0.5x/1x/2x harmonisten haku säilyy.
- Lisätty candidate-gap: paras RPM-ehdokas verrataan parhaaseen aidosti erilliseen kilpailijaan.
- Pieni candidate-gap laskee confidencea, jolloin harmoninen sekaannus ei näytä liian varmalta.
- `candidateGap` ja `runnerRpm` kulkevat mittausputken läpi ja tallentuvat oppimisdataan.

## Vehicle / Engine Knowledge Base
Jokaisella pyöräprofiililla on nyt versionoitu `vehicle_engine_kb_v1`-tietomalli:
- tilavuus, sylinterit, poraus, isku
- sylinteri/kit, squish, palotila
- kaasuttimen koko
- pakoputki ja sytytys/CDI
- etu-/takaratas ja renkaan ympärys
- setup-tagi ja vapaat muistiinpanot

Knowledge Base tallennetaan profiiliin. Jokainen uusi dynoveto ja oppimisdatasnapshot sisältää kokoonpanon sekä `setupSignature`-tunnisteen.

## Data / reprocessing
- Oppimisdata schema: `learning_raw_v2` / `learning_export_v2`.
- Jokainen chunk sisältää app- ja algoritmiversiot.
- Raw/source-specific RPM-arvot säilyvät erillään fused/derived-arvoista.
- Profiili + Knowledge Base voidaan viedä JSON-tiedostoksi.

## Säilytetyt toiminnot
GPS, IMU, BT-kuulokemikrofoni, GPS ONLY, BT MIC ONLY, AUTO FUSION, Auto Gear Learn, GPS/vaihdekalibrointi, AutoRide, manuaalivedot, dynokäyrät, vertailu, yhdistetty referenssi, kaasuttimen säätö, oppimisdata ja raw fingerprint säilyvät.

Legacy-localStorage-avaimet (`motolab_v26_*`, `motolab_v28_*`, `motolab_v29_*`) on jätetty tarkoituksella ennalleen, jotta käyttäjän nykyiset profiilit, kalibroinnit ja vedot eivät katoa versionvaihdossa.

## Developer-only ignition autotune
Kokeellinen sytytyksen AUTOTUNE ei näy normaalissa julkisessa käyttöliittymässä. Kehittäjätilan voi vaihtaa napauttamalla v31-versionumeroa 7 kertaa noin 3,5 sekunnin sisällä. Tila tallentuu paikallisesti avaimella `motolab_dev_mode`.
