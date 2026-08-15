# VÄNÄ MOTOLAB v25 RAW Fingerprint

Tässä versiossa kerätty raakadata on ensimmäistä kertaa osa live-RPM-mittausta.

Mitä raakadatasta käytetään
- rpm_reference = oikea referenssi-RPM / opetustieto
- f0-havainnot
- 1.–6. harmonisten suhteelliset voimakkuudet
- eri mikrofonipaikkojen näytteet

Tärkeä ero:
Testidatan oman RPM-algoritmin arvioita EI käytetä totuusarvoina. Totuutena käytetään rpm_reference-kenttää.

Live RPM -ketju
1. AudioWorker lähettää PCM-palan RPM Workerille.
2. Worker etsii useita taajuusehdokkaita.
3. Ehdokkaat muunnetaan raakadatasta opitulla f0→RPM-suhteella.
4. 1/2x, 1x ja 2x vaihtoehdot pisteytetään raakadatasta johdettua harmonista fingerprintiä vasten.
5. Heikko fingerprint-osuma laskee confidencea tai hylkää havainnon.
6. MIC Calibration tekee pyörä-/mikrofonikohtaisen lisäkorjauksen.
7. RPM Fusion yhdistää hyväksytyn audio-RPM:n nopeus-RPM:ään ja Auto Gear Learn -tietoon.
8. Kytkinluistossa nopeus ei saa pakottaa RPM:ää.

Mukana oleva raw_audio_fingerprint.json on auditointia varten.
