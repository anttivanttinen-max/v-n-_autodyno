# VäNä AutoDyno v11 Reliable

Tämä versio on tehty suoraan v9/v10-pohjan päälle ja korjaa käyttäjän raportoimat kolme ongelmaa:

1. RPM-lähteen voi vaihtaa suoraan Mittaus-näkymästä.
2. GPS käyttää oikeaa geolocation-watchia ja laskee nopeuden myös sijaintipisteistä, jos iPhone ei anna coords.speed-arvoa.
3. Mikrofonissa on oikea äänitason mittari, joten reagointi ääneen näkyy heti vaikka RPM-lukitus ei vielä olisi hyvä.

Lisäksi:
- AUTO AJOT pyytää GPS- ja mikrofoniluvat rinnakkain samasta napinpainalluksesta (iOS-yhteensopivuus).
- Järjestelmätesti näyttää secure context / GPS / media / WebAudio / DeviceMotion -tuen.
- localStorage käsitellään virheenkestävästi.

TÄRKEÄÄ iPhonella:
GPS ja mikrofoni eivät toimi normaalisti, jos index.html avataan suoraan Tiedostot-esikatselusta (file://).
Aja sovellus HTTPS-osoitteesta (esim. GitHub Pages / Railway) ja avaa se Safarissa.
