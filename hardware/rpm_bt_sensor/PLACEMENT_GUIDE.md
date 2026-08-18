# Komponenttien sijoittelu koekytkentä- ja juotosreikälevylle

Näissä kuvissa oletetaan **74HC14 DIP-14**. Jos piirisi on SMD-kotelossa tai moduulina, älä seuraa DIP-jalkojen numeroita. Lähetä osasta kuva ennen rakentamista.

- [Koekytkentälevyn sijoittelukuva](diagrams/breadboard_74hc14.svg)
- [Juotosreikälevyn komponentti- ja kuparipuoli](diagrams/perfboard_74hc14.svg)

## 74HC14 DIP-14 – käytetyt jalat

| Jalka | Kytkentä |
|---:|---|
| 1 (1A) | SENSE-solmu |
| 2 (1Y) | R4 1 kΩ → ESP32 GPIO4 |
| 7 | GND |
| 14 | ESP32 3V3 |

Käyttämättömät tulot 3, 5, 9, 11 ja 13 kytketään GND:hen. Lähdöt 4, 6, 8, 10 ja 12 jätetään auki. Älä jätä CMOS-tuloja kellumaan.

## BAT54S SOT-23

Kuvat käyttävät tavallista BAT54S-sarjakytkentää:

- pinni 1 → GND
- pinni 2 → SENSE
- pinni 3 → 3V3

Tarkista silti oman valmistajasi datasheet ennen juottamista. Jos käytät breakout-levyä, varmista pinnien numerot yleismittarilla/dioditestillä.

## Rakennusjärjestys

1. Älä kytke pickupia tai ESP32:ta vielä.
2. Asenna 74HC14 lovi ylöspäin levyn keskiuran yli.
3. Kytke jalka 14 punaiselle 3V3-kiskolle ja jalka 7 siniselle GND-kiskolle.
4. Asenna 100 nF suoraan jalkojen 14 ja 7 väliin.
5. Tee SENSE-rivi: C1:n jälkeinen R1:n pää, R2:n yläpää, BAT54S pinni 2 ja 74HC14 jalka 1 ovat sama sähköinen piste.
6. Kytke R2 10 kΩ SENSEstä GND:hen. Kytke BAT54S pinnit 1/3 GND/3V3-kiskoihin.
7. Kytke 74HC14 jalka 2 R4 1 kΩ:n kautta OUT-liittimeen ja siitä ESP32 GPIO4:ään.
8. Kytke käyttämättömät tulot GND:hen.
9. Virrattomana tarkista jatkuvuus ja oikosulut. 3V3–GND ei saa olla oikosulussa.
10. Syötä 3.3 V, tarkista jännitteet ja kytke vasta sitten ESP32 sekä pickup.

## Liittimet

- J1: `PICKUP+`, `PICKUP-`
- J2: `3V3`, `GND`, `OUT`
- J2 OUT → ESP32 GPIO4
- J2 GND → ESP32 GND
- J2 3V3 → ESP32 3V3

Pickup− liittyy paikalliseen GND:hen vain tällä suojapiirilevyllä. Pickup-johtoa ei yhdistetä moottoriin, CDI:hin, puolan miinukseen tai tulpanjohtimen metalliin.

