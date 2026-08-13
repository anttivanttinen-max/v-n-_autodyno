# VäNä AutoDyno v5 — RPM Priority

RPM-lähteiden prioriteetti on valittavissa suoraan sovelluksesta.

Oletus:
1. Nopeus / valitun vaihteen RPM-kalibrointi
2. Mikrofoni
3. Kamera

Mikrofoni:
- pyytää erillisen mikrofoniluvan
- käyttää reaaliaikaista autokorrelaatiota moottorin perustaajuuden arviointiin
- 1-sylinterisen 2T-moottorin lähtöoletus on yksi palotapahtumajakso / kampiakselikierros
- näyttää oman RPM:n ja luottamuksen
- verrataan nopeus-RPM:ään poikkeamien löytämiseksi

Kamera:
- kameran käyttöoikeus ja live-kuva ovat mukana
- kamera on valittavana prioriteettilistassa
- varsinainen analogisen kierroslukumittarin viisarin automaattinen tunnistus tarvitsee vielä mittarikohtaisen kalibroinnin, joten ilman kalibrointia kamera ohitetaan automaattisesti.

Muu v4/v3-toiminta säilyy: GPS, IMU, gyro, orientaatio, korkeus/kaltevuus, hv/Nm, automaattinen veto, vertailu ja Auto Tune -ehdotuspohja.
