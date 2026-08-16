# MotoLab Remote Vehicle Lookup Spec

## Hakukäyttöliittymä

Hakukentän jälkeen näkyy aina erillinen `HAE`-painike. Painallus tuottaa yhden seuraavista tiloista:

- `HAETAAN…`
- `LÖYTYI`
- `EI LÖYTYNYT`
- `EI VERKKOA – paikallinen haku tehty`

## Hakujärjestys

1. Etsi paikallisesta `vehicle_catalog.json`-katalogista.
2. Jos löytyy, näytä osumat heti.
3. Jos ei löydy ja verkko toimii, kysy etähakupalvelulta.
4. Jos etähaku löytää tiedot, näytä ne heti luotettavuusmerkinnällä.
5. Jos mitään ei löydy, lähetä missing-vehicle request palvelimelle ja kerro käyttäjälle että haku vastaanotettiin.

## Luotettavuustilat

- `Vahvistettu` – tieto on varmennettu vahvoista/yhtenevistä lähteistä.
- `Todennäköinen` – useampi tuki tai vahva lähde, mutta ei vielä lopullisesti varmennettu.
- `Tarkistus kesken` – alustava tieto voidaan näyttää ja käyttää, mutta se on vielä uudelleentarkistettava.

Jokaisella etätiedolla voidaan säilyttää kenttäkohtainen metadata:

```json
{
  "value": 57,
  "confidence": "probable",
  "checkedAt": "2026-08-16T00:00:00Z",
  "sourceCount": 2,
  "catalogRevision": 12
}
```

## Missing vehicle request

Client -> POST /vehicle/missing

```json
{
  "query": "Derbi Senda 2008",
  "normalizedQuery": "derbi senda 2008",
  "appVersion": "32.4",
  "build": "...",
  "activeProfileId": "local-profile-id"
}
```

Palvelimen ei tarvitse saada käyttäjän RAW-dataa tai muita ajotietoja tämän pyynnön mukana.

## Etäkatalogin päivitys

Client voi kysyä katalogiversion esimerkiksi `/vehicle/catalog/version` ja hakea vain uudemman revision tarvittaessa. Viimeisin onnistunut katalogi säilytetään paikallisesti offline-käyttöä varten.

## Käyttäjän omat arvot

Tehdas-/katalogiarvot ja käyttäjän override-arvot on erotettava. Etäpäivitys saa päivittää katalogikerrosta, mutta ei käyttäjän itse muuttamia arvoja. UI voi näyttää esimerkiksi:

- Tehdas: 16/57
- Oma: 15/57

Jos katalogin arvo myöhemmin korjataan, käyttäjän oma arvo säilyy.

## Uudelleentarkistus

Palvelin voi myöhemmin muuttaa tiedon arvoa tai luotettavuustilaa. Seuraava katalogisynkronointi tuo korjauksen sovellukseen. Käyttäjälle ei tarvitse estää alustavan tiedon käyttöä, kunhan `Tarkistus kesken` näkyy selvästi.
