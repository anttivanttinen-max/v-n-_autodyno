# VÄNÄ MotoLab – Closed Beta Preparation

Tämä tiedosto kuvaa seuraavan beta-valmistelupäivityksen pohjatyöt. Tähän vaiheeseen ei kuulu dynokäyrän, GPS-masterin, RPM-ytimen tai nykyisen mittauslogiikan muuttaminen.

## Tavoite

Suljettu beta pienelle kutsutulle käyttäjäryhmälle. Käyttöliittymä pelkistetään normaalikäyttäjälle, mutta kehittäjätila ja RAW-data säilyvät taustalla.

## Beta-käyttäjän peruspolku

1. Ensimmäinen käynnistys näyttää kutsukoodin aktivoinnin.
2. Hyväksytyn kutsun jälkeen sovellus muistaa aktivoinnin tällä laitteella.
3. Ensimmäinen käyttö käynnistää yhden selkeän käyttöönoton, jossa pyydetään tarvittavat käyttöoikeudet käyttäjän eleen kautta.
4. GPS ja muut normaalikäytössä tarvittavat perustoiminnot käynnistetään automaattisesti aina kun selain/käyttöjärjestelmä sallii sen.
5. Käyttäjä valitsee pyörän tai käyttää valmiiksi valittua profiilia.
6. Ajoneuvohaussa on erillinen HAE-painike ja selkeä tila: HAETAAN / LÖYTYI / EI LÖYTYNYT / EI VERKKOA.
7. Jos mallia ei löydy paikallisesta katalogista, puuttuva hakupyyntö voidaan lähettää palvelimelle jatkokäsittelyä varten.
8. Verkosta saatavat tiedot voidaan näyttää heti luotettavuustilalla: Vahvistettu / Todennäköinen / Tarkistus kesken.
9. Käyttäjän omia käsin muutettuja pyöräkohtaisia arvoja ei koskaan ylikirjoiteta automaattisesti katalogipäivityksellä.
10. Varsinainen dynokäyttö pidetään mahdollisimman automaattisena: profiili, GPS/RPM, ARM/vedon tunnistus ja käyrän tallennus ilman tarpeetonta asetusten käyttöä.

## Beta-tilassa piilotettavat kehitysosiot

- RAW-kehitysnäkymät
- mikrofonin candidate/harmonic-säädöt
- käsin tehtävät GPS-kalibroinnin kehityssäädöt
- algoritmiversiot ja sisäiset diagnostiikat
- developer-testit ja muut kokeelliset säätimet

Piilotus ei saa poistaa toimintoja tai estää RAW-tallennusta. Kehittäjätila säilyttää pääsyn niihin.

## Ei muuteta tässä päivityksessä

- GPS-master / gpslearn -periaate
- rpmControlAuthority = gps oppimisvaiheessa
- dynokäyrän yhden vedon segmentointi
- kameran RPM (pysyy pois käytöstä)
- nykyinen RAW-tallennuksen periaate
- nykyinen väliaikainen GPS Power Calibration 1.07 ilman uutta testipäätöstä

## Toteutusjärjestys

1. Kutsuaktivoinnin palvelurajapinnan sopimus ja paikallinen tila
2. Beta/developer feature flag -rakenne
3. Ensikäynnistyksen onboarding ja lupaketju
4. Ajoneuvohaun HAE-painike + hakutilat
5. Missing vehicle request -rajapinnan sopimus
6. Ajoneuvokatalogin etäpäivityksen sopimus ja luotettavuusmetadata
7. Käyttäjän omien override-arvojen suojaus
8. Testit: uusi käyttäjä, vanha käyttäjä, offline, lupa estetty, kutsu poistettu, tuntematon pyörä, katalogipäivitys
9. Vasta tämän jälkeen beta-build

## Turvallisuusperiaate

Selainkoodiin ei sijoiteta yhteistä salaista pääsyavainta. Kutsu validoidaan palvelimella. Mahdolliset palvelimen salaisuudet ovat vain palvelinympäristössä.
