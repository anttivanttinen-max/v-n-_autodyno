# VäNä AutoDyno v10 AutoRide

Pohjana on käyttäjän toimivaksi toteama v9 Blue Edition. V9:n mittaus- ja anturilogiikka on säilytetty ja sen päälle on lisätty jatkuva AUTO AJOT -tila.

## Uutta v10:ssä
- AUTO AJOT: jatkuva automaattinen kiihdytysten tunnistus normaalin ajon aikana
- Käynnistää anturit ja mikrofonin AUTO AJOT -painikkeesta
- Tunnistaa kiihdytyksen GPS-nopeuden + suodatetun kiihtyvyyden perusteella
- Oppii vaihteita mikrofonin RPM / GPS-nopeus -suhteesta
- Pyrkii korjaamaan mikrofonin 1/2x ja 2x harmonisia opittujen välityssuhteiden avulla
- Seuraa vaihteen vaihtumista saman vedon aikana
- Tallentaa käytetyt vaihteet (esim. 2→3→4)
- Laskee vedolle 0–100 % laatupisteet GPS-, mikrofoni-, kesto- ja nopeusmuutoksesta
- Hylkää liian lyhyet / heikot satunnaiset tapahtumat
- Jatkaa automaattista valvontaa cooldownin jälkeen ilman uutta painallusta
- Auto-ajon käynnistys- ja lopetusherkkyys säädettävissä
- Vedot-näkymässä näkyvät tila, vaihteet, laatupisteet ja huipputeho

## Testaus
Katso TEST_REPORT.txt.

## Huomio
Puhelimen oikeat GPS-, mikrofoni-, IMU- ja iOS-luvat voidaan lopullisesti varmistaa vain oikealla puhelimella liikkeessä. Sisäinen logiikka, painikesidonnat, DOM-viitteet, vaihteenoppiminen, laatuarvio ja automaattisen vedon käynnistysehto on testattu ohjelmallisesti.
