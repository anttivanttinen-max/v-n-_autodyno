# MotoLab Beta Invite / Activation Spec

## Tavoite

Rajattu beta ilman kaikille jaettavaa yhteistä avainta. Jokaisella testaajalla on henkilökohtainen kutsu. Puhelimen/laiteinstanssin tunniste on lisäsuoja, ei varsinainen käyttäjätunnus.

## Ensimmäinen aktivointi

Client -> POST /beta/activate

```json
{
  "inviteCode": "USER-SPECIFIC-CODE",
  "deviceInstallId": "random-local-install-id",
  "appVersion": "32.4",
  "build": "..."
}
```

Server response:

```json
{
  "ok": true,
  "activationToken": "opaque-random-token",
  "userId": "beta-user-id",
  "maxDevices": 2,
  "features": ["dyno","profiles","vehicle_lookup"]
}
```

`activationToken` tallennetaan paikallisesti. Se ei ole palvelimen master secret eikä kutsukoodia tarvitse säilyttää aktivoinnin jälkeen.

## Normaali käynnistys

Client -> POST /beta/session/validate

```json
{
  "activationToken": "opaque-random-token",
  "deviceInstallId": "random-local-install-id",
  "appVersion": "32.4",
  "build": "..."
}
```

Palvelin voi palauttaa `ok`, feature flags, beta-tilan ja mahdollisen `revoked`-tilan.

## Laitetunniste

`deviceInstallId` tehdään ensimmäisellä käyttökerralla satunnaisesti ja tallennetaan selaimen paikalliseen tallennukseen. Sitä ei väitetä pysyväksi fyysisen puhelimen ID:ksi. Jos selaindata tyhjennetään, laite voidaan joutua aktivoimaan uudelleen.

## Peruutus

Kutsu tai käyttäjä voidaan estää palvelimelta ilman että muiden testaajien käyttö lakkaa. Aktivointitokenit voidaan peruuttaa käyttäjä- tai laitekohtaisesti.

## Offline

Jo aktivoitu käyttäjä voi saada lyhyen offline grace periodin, jotta hetkellinen verkkokatko ei estä mittausta. Uusi aktivointi vaatii verkkoyhteyden.

## Ei koskaan clienttiin

- palvelimen master API key
- tietokannan ylläpitoavain
- kutsujen generointisalaisuus
- kolmannen osapuolen salaiset API-avaimet

## Tietosuoja beta-vaiheessa

Aktivointipalvelimelle tarvitaan vain beta-käytön kannalta välttämätön tieto. RAW- tai vetotiedostoja ei lähetetä automaattisesti tämän ominaisuuden vuoksi. Jos myöhemmin lisätään vapaaehtoinen RAW-palautus, sille tehdään erillinen suostumus ja rajapinta.
