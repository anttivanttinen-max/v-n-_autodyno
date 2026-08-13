# VäNä AutoDyno v17 Sensor Fix

Tämä versio korjaa iPhone-antureiden diagnosoinnin ja lupapyynnöt.

Muutokset:
- pyytää DeviceMotion-luvan käyttäjän ANTURIT-painalluksesta
- pyytää myös DeviceOrientation-luvan samasta painalluksesta
- rekisteröi devicemotion- ja deviceorientation-kuuntelijat
- LIVE ANTURIT -paneeli näyttää:
  - motion event count
  - motion Hz
  - acceleration X/Y/Z
  - acceleration magnitude
  - gyro alpha/beta/gamma
  - orientation beta/gamma
  - GPS speed, accuracy, update count
- top GPS/IMU/MIC indikatorit ovat oikeasti dynaamisia
- 3 sekunnin timeout kertoo jos devicemotion-eventtejä ei tule lainkaan
- kamera pysyy poistettuna
- info ON/OFF säilyy

GitHub:
1. korvaa index.html
2. pidä bike.png samassa juuressa
3. avaa ?v=17
4. paina ANTURIT
5. hyväksy mahdolliset Motion/Orientation- ja sijaintiluvat
6. liikuta puhelinta ja katso LIVE ANTURIT -paneelia
