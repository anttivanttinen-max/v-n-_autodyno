# VÄNÄ MOTOLAB v26 BT ONLY

Puhelimen oma mikrofoni on poistettu RPM-ketjusta kokonaan. Ainoa audio-RPM-lähde on BT-kuulokkeen/BT-headsetin mikrofoni.

Lisätty BT-vianhaku:
- actual input track label
- BT äänen taso
- havaittu f0
- raw fingerprint score
- automaattinen AirPods/Bluetooth/headset-tyyppisen audiotulon valinta, jos selain näyttää laitteen nimen
- audiolaitteen käsinvalinta Asetuksista

Jos BT taso näyttää EI PCM/TASOA, ongelma on audioreitityksessä eikä RPM-laskennassa.
Jos BT taso näkyy mutta f0/RPM ei, korjaus kohdistetaan pitch/fingerprint-algoritmiin.
