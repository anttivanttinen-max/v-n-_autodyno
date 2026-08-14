# VÄNÄ MOTOLAB v22 RPM Fusion

Päivityksen pääasia on RPM Fusion:

- Audio RPM hyväksytään vasta valitun minimi-RPM:n ja luottamuksen jälkeen.
- Hyvä audio-RPM hallitsee mittausta.
- Keskitasoinen audio yhdistetään GPS-nopeudesta + opitusta vaihdesuhteesta laskettuun RPM:ään.
- Heikko audio korvataan nopeus-RPM:llä, jos vaihde on luotettavasti tunnistettu.
- Audio- ja nopeus-RPM:n suuri ero tulkitaan mahdolliseksi kytkinluistoksi; silloin nopeus ei saa väkisin korjata audio-RPM:ää.
- Jos kumpikaan lähde ei ole riittävän luotettava, Fusion hylkää RPM:n.
- Run-dataan tallennetaan audioRpm, speedRpm, fusionRpm, source, confidence, fusionMode, slip ja agreement.
- Kamera-RPM ei ole mukana.

Laitekohtaiset testit on tehtävä HTTPS-osoitteessa iPhonella: GPS, DeviceMotion, puhelinmic, BT/EXT mic ja oikea maantie-/rullatesti turvallisessa ympäristössä.
