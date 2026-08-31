# Tarkka kytkentä

Katso myös `diagrams/wiring.svg`.

## Pickup ja suojaus

1. Tee W1:stä 3–6 tiukkaa mutta tulpanjohtoa vahingoittamatonta kierrosta tulpanjohdon **eristeen päälle**. W1 ei koskaan kosketa johdinta.
2. W1:n toinen pää on `PICKUP`, toinen `PICKUP_RETURN`. Jatka ne suojatulla kierretyllä parilla J1:lle. Kytke kaapelin suojavaippa vain elektroniikkakotelon GND:hen; jätä moottoripää kelluvaksi.
3. J1-1 `PICKUP` -> R1 100 kΩ -> solmu `CLAMP`.
4. J1-2 `PICKUP_RETURN` -> GND.
5. D2 SMBJ5.0CA `CLAMP` <-> GND. Kaksisuuntainen, suunta vapaa.
6. D1 BAV99 clamp: yksi diodipolku `CLAMP` -> 3V3 (anodi CLAMP, katodi 3V3) ja toinen GND -> `CLAMP` (anodi GND, katodi CLAMP). BAV99:n tarkka kotelopinout tarkistetaan valitun valmistajan datasheetistä ennen juottamista.
7. `CLAMP` -> R2 10 kΩ -> solmu `FILTER`.
8. `FILTER` -> R3 1 MΩ -> GND.
9. `FILTER` -> C1 1 nF -> GND.
10. `FILTER` -> U2 pin 1/A. U2 pin 5/VCC -> 3V3; U2 pin 3/GND -> GND; U2 pin 4/Y -> R4 100 Ω -> ESP32-S3 GPIO4. Jos valitun 74LVC1G17:n pinout poikkeaa, datasheet on auktoriteetti.
11. C2 100 nF ja C3 10 µF rinnakkain U2 VCC:n ja GND:n väliin. C2 alle 5 mm U2:n jaloista.

## ESP32-S3 N16R8

| Kortin pinni | Kohde | Huomio |
|---|---|---|
| GPIO4 | R4:n ESP32-pää | Pulssitulo, `INPUT_PULLDOWN`, nousevan reunan interrupt |
| 3V3 | U2 VCC, yläclamp, C2/C3 | Vain 3,3 V |
| GND | J1-2, D2, alaclamp, R3, C1, U2, C2/C3 | Yksi tähtimaa kotelossa |
| USB | 5 V virtapankki/läppäri | Ensitestissä eristetty/akkukäyttöinen syöttö |

GPIO4 on valittu, koska se on yleinen vapaa digitaalitulo ESP32-S3 DevKit -korteissa. **Tarkista oman N16R8-korttisi silkkipainatus/schematic:** älä käytä flash/PSRAM-, USB D+/D−-, boot- tai muuten varattua pinniä. Jos GPIO4 on varattu, muuta vain firmwaren `PULSE_PIN` ja dokumentoi muutos.

## Miksi nämä arvot

R1 rajoittaa transienttivirtaa; TVS ottaa suuren energian; BAV99 rajoittaa CLAMP-solmun kiskoihin; R2/C1 vaimentaa erittäin nopeaa RF-soittoa (10 µs aikavakio) ja Schmitt-trigger palauttaa jyrkän reunan. R3 purkaa solmun. Tämä on prototyyppisuojaus, ei sertifioitu automotive front-end. Jos oskilloskoopilla CLAMP ylittää jatkuvasti kiskot tai U2 kuumenee, testi keskeytetään ja pickup-kierroksia vähennetään.


