# VäNä AutoDyno v12 RED AUTO PRO

Rakennettu v9/v11-toimivan pohjan päälle. Tavoite: hyväksytyn punaisen RED EDITION -mockupin tunnelma ilman että toimivaa mittauslogiikkaa korvataan pelkällä UI-demolla.

## Uutta v12
- RED EDITION -teema koko sovelluksessa
- AutoRide-herkkyys: Herkkä 0,18 g / Normaali 0,25 g / Tiukka 0,38 g + vapaa g-arvo
- erillinen lopetusviive ja cooldown säilyvät
- AutoRide-livekortti: tila, herkkyys, kynnys ja arvioitu vaihde
- projekti: 2T/4T, cc, pakoputki ja ilmanotto
- kaasarisäätö: koko, pääsuutin, tyhjäkäyntisuutin, neula, klipsi, seosruuvi, luisti, power jet
- kaasariasetukset tallentuvat jokaisen vedon metatietoihin
- teho (punainen) + vääntö (sininen) samaan dynokäyrään
- JSON-datan vienti, vaihdeoppimisen nollaus, asetusten palautus
- PWA manifest + service worker

## iPhone
GPS, mikrofoni ja liikeanturit on avattava HTTPS-osoitteesta Safarissa. Suora file:// / Tiedostot-esikatselu ei anna kaikkia anturioikeuksia.

## Turvallisuus
Älä käsittele puhelinta ajon aikana. AutoRide on tarkoitettu siihen, että sovellus jätetään valvomaan ajoa ilman ruudun koskettelua. Varsinaiset dynovedot vain turvallisessa testiympäristössä.
