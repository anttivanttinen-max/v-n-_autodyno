# VäNä AutoDyno v18 — GPS + Mic + Priority Fix

Korjattu käyttäjän testin perusteella:
- kiihtyvyys toimi jo
- GPS: lisätty lupa-/sijainti-/päivitysdiagnostiikka
- mikrofoni: AudioContext-tila näkyviin, FFT-koko 8192, herkempi autokorrelaatio, live RPM ja luottamus
- mikrofonin min/max RPM asetettavissa
- RPM-prioriteetti asetuksista vaikuttaa nyt heti päämittarin lähteeseen
- päämittarin RPM-lähde näyttää dynaamisesti NOPEUS tai MIKROFONI
- mikrofoni voi toimia prioriteetti 1:nä myös ennen nopeuskalibrointia
- kamera pysyy poistettuna
- JavaScript-syntaksi tarkistettu

Testaa näin:
1. GitHubiin index.html + bike.png
2. avaa ?v=18
3. ANTURIT → katso GPS lupa / sijainti / päivitykset
4. MIKROFONI → katso Audio tila, Mic RPM, Mic luottamus
5. Asetukset → RPM prioriteetti 1 = Mikrofoni
6. palaa Mittaus-näkymään: päämittarin `RPM lähde` muuttuu MIKROFONIksi heti kun mic-RPM on kelvollinen.
