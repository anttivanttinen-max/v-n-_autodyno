# VäNä AutoDyno v16 Red Clean

Muutokset:
- Kamera poistettu kokonaan käyttöliittymästä ja koodista.
- RPM-lähteet ovat nyt nopeus/välitys ja mikrofoni.
- Asetuksiin lisätty ⓘ Info-napit PÄÄLLÄ/POIS.
- Info-asetus tallentuu localStorageen ja palautuu seuraavalla avauksella.
- Alavalikko, vedot, analyysi, AutoTune, asetukset, ARM, manuaali, STOP ja RPM-kalibrointi säilyvät.

Testaus:
- JavaScript-syntaksi tarkistettu.
- Selain avattu headless Chromiumilla.
- Alavalikon kaikki 5 näkymää testattu.
- Info-nappien PÄÄLLÄ/POIS testattu ja pysyvyys tarkistettu sivun uudelleenlatauksen jälkeen.
- Kameraan viittaavat UI-elementit ja JS-funktiot poistettu.
- Console/page-errorit tarkistettu.

GitHub:
1. korvaa `index.html`
2. pidä `bike.png` samassa juuressa
3. avaa `?v=16`
