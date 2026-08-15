# VÄNÄ MOTOLAB v27 – GPS calibration + BT tester route

Muutokset:
- RPM-lähde: GPS ONLY / BT MIC ONLY / AUTO FUSION.
- GPS ONLY käyttää valitun vaihteen omaa RPM/km/h-kalibrointia.
- Vaihde/RPM/GPS-kalibrointi: automaattinen vakaa nopeus, manuaalinen RPM+km/h, Auto Gear Learn.
- Automaattinen kalibrointi: esim. G3 + 3000 rpm + 3 s vakaa GPS-nopeus -> tallennus.
- BT audio avataan samalla yksinkertaisella getUserMedia-reitillä kuin toimivassa testerissä, ilman pakotettua deviceId:tä.
- Audio-RPM yli asetetun max RPM:n hylätään ennen Fusionia.
- Dynokäyrän ristikko on valittavissa Asetuksista; akselimerkintöjä lisätty.
- Puhelimen omaa MIC-painiketta/RPM-lähdettä ei ole.

Huom: selain/iOS päättää fyysisen audioreitin. BT-testipainike näyttää selaimen ilmoittaman audiotulon nimen.
