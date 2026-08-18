# Tee näin — lyhyt rakennusohje

1. Käytä jo dokumentoitua ESP32-S3 N16R8 -korttia ja Partcon osalistaa lähtötietona. Kortin silkkipainatus ratkaisee fyysisen pinnin; ohjeissa käytetään GPIO-numeroita.
2. Rakenna suojattu induktiivinen tulopiiri `PLACEMENT_GUIDE.md`:n mukaan. Nykyinen sijoittelukuva esittää DIP-14-kotelon; jos Partcon listan tarkka 74HC14 on eri kotelossa, käytä sille tehtyä kotelokohtaista sijoittelua. Älä koskaan yhdistä CDI:tä, puolan miinusta tai sytytysjohtoa suoraan ESP32:een.
3. Kytke tulopiirin `OUT` GPIO4:ään, painike GPIO0–GND ja valinnainen LED GPIO48:aan 1 kΩ vastuksen kautta. Syötä kortille 5 V vain USB:stä tai hyväksytystä 5 V buck-muuntimesta.
4. Kierrä eristetty pickup-johto aluksi 3 kierrosta tulpanjohdon ympärille. Kytke pickup-pari vain suojapiirin `PICKUP+`/`PICKUP-`-liittimiin. Säädä kierrosmäärää testissä 1–8; älä kuori tulpanjohtoa.
5. Asenna Arduino IDE 2.x, Boards Managerista `esp32 by Espressif Systems 3.3.11` ja avaa `firmware/rpm_bt_sensor/rpm_bt_sensor.ino`.
6. Valitse oma ESP32-S3-korttisi, USB CDC On Boot = Enabled, Flash 16 MB ja oikea portti. Flashaa. Jos lataus ei ala, pidä BOOT painettuna, napauta RESET, vapauta BOOT ja yritä uudelleen.
7. Windowsissa avaa `tools/windows` ja kaksoisnapsauta `INSTALL.bat` kerran. Sen jälkeen käynnistä aina `RUN_RPM_BT.bat`.
8. Tee `TEST_PROTOCOL.md`:n bench- ja engine-off-testit ennen ajoa. Pidä GPS vertailun auktoriteettina.
9. Kiinnitä kotelo runkoon viileään kohtaan, ei sylinteriin. Tee vedonpoisto pickup- ja virtajohdoille. Kontaktireferenssi kiinnitetään erikseen jatkomutteriin tiukalla alumiinishimmillä.
10. Lähetä testin jälkeen koko `sessions`-kansio sekä tiedot: moottori, 2T/4T, sylinterit, kipinää/kierros -oletus, pickup-kierrokset ja käytetty virtalähde.

## Osat

Käyttäjän jo toimittama Partcon osalista ja aiemmat osakuvat ovat ensisijainen varastotieto. `HARDWARE.md`:n v1-BOMia verrataan niihin; vain todellinen erotus merkitään hankittavaksi. ESP32-S3 N16R8 sekä kontaktireferenssin jatkomutteri/alumiinishimmi ovat projektissa dokumentoituja lähtötietoja.
