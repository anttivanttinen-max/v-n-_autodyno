# VÄNÄ MOTOLAB v23 MIC Calibration

Lisätty 3-pisteinen mikrofonin RPM-kalibrointi.

Käyttö:
1. Kytke PHONE MIC tai BT/EXT MIC päälle.
2. Pidä moottori tasaisella tunnetulla kierrosluvulla.
3. Syötä oikea kierrosluku (esim. 3000 rpm) ja paina TALLENNA.
4. Tee sama mieluiten kolmessa pisteessä, esimerkiksi 3000 / 6000 / 9000 rpm.

V23 tallentaa jokaisessa pisteessä äänen raakaa RPM-arvoa ja käyttäjän antaman oikean RPM:n.
Yhdellä pisteellä käytetään suhdekorjausta.
Kahdella tai kolmella pisteellä käytetään pisteiden välistä lineaarista interpolointia.
Korjaus tehdään ennen RPM Fusionia.

V22:n RPM Fusion säilyy mukana: audio + nopeus-RPM, Auto Gear Learn ja kytkinluiston tunnistus.
