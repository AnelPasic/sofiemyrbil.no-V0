# Sofiemyr Bil – skjemamottak (Cloudflare D1 + Resend)

**Status:** Kode er klargjort, men mottaket er **IKKE aktivert eller verifisert**.
Arbeidet bygger på den godkjente D-129-kjernen i Optimalisering Oslo og følger
MedonWebSystem \`docs/STANDARD-ASTRO-CLOUDFLARE-RESEND-INTAKE.md\`.
Det generelle MWS-036/037-kitet er fremdeles ikke utgitt. Denne kundetilpasningen
inneholder det prøvde grunnmønsteret, ikke et ferdig dashboard.

## Slik virker det

- Én egen Worker, \`sofiemyrbil-intake\`, og én separat D1-database.
- \`POST /api/leads\` validerer registreringsnummer, e-post, telefon, minst én
  av seks tjenester, melding og begrensede UTM-felt.
- Opprinnelse, idempotens, rate limiting og honeypot sjekkes før D1.
- Kvittering med \`receipt_status=stored\` sendes **etter** varig D1-lagring.
  Tidsbestilling er fortsatt en **forespørsel**, verkstedet bekrefter tid.
- Resend-varsel sendes i bakgrunnen med outbox og tidsbegrensede retry-jobber.
  D1-kvittering er ikke i seg selv bevis på e-postleveranse.
- \`/admin/receipts\`, \`/admin/export\` og \`/admin/retry\` er beskyttet
  med Cloudflare Access-signatur og eksplisitte tilgangstildelinger per nettsted.
- Begge sidene \`/bestilling/\` og \`/kontakt/\` bruker den samme globale kilden.

## Engangsoppsett i riktig Cloudflare-konto (ikke kjør mot Oslo)

1. Kontroller med kunden at **Sofiemyr Bil AS** er behandlingsansvarlig,
   hvilken innboks som skal få varsel (foreslått \`firma@sofiemyrbil.no\`),
   korrekt org.nr., personverntekst, retention/sletting og at Resend/Cloudflare
   er akseptable databehandlere. **Sett ikke \`PRIVACY_APPROVED=true\` før dette.**
2. Logg på Cloudflare med riktig konto. Opprett én D1 med EU-jurisdiksjon:
   \`npx wrangler@4.148.0 d1 create sofiemyrbil-leads --jurisdiction eu\`.
   Ikke gjenbruk databasen fra Optimalisering Oslo.
3. Kopier \`wrangler.jsonc.example\` til \`wrangler.jsonc\` lokalt, og erstatt
   database-ID-en med **den faktiske Sofiemyr D1-ID-en**. Bekreft konto,
   \`INGRESS_ORIGIN\` og nøyaktig \`ALLOWED_ORIGINS\` før deploy. Ikke bruk
   andre klienters Access-audience eller Worker-ID.
4. Fra \`intake-worker/\`: Kjør
   \`npx wrangler@4.148.0 d1 migrations apply DB --remote\`, og
   \`npx wrangler@4.148.0 deploy\`. Kontroller at Worker-URL faktisk stemmer
   med \`INGRESS_ORIGIN\`.
5. Verifiser et Resend-avsenderdomene. Legg følgende inn som **Cloudflare
   Worker Secrets** (aldri i kildekode, ChatGPT eller GitHub):
   \`RESEND_API_KEY\`, \`RESEND_FROM\`, \`LEAD_TO_EMAIL\`,
   \`ADMIN_GRANTS_JSON\`. Grant-format er en JSON-map med e-post til
   \`[{ "site": "sofiemyrbil.no", "permissions": ["read", "retry"] }]\`.
6. Konfigurer en Cloudflare Access-applikasjon for Workers
   \`/admin/*\`, kun godkjente administratorer. Legg inn faktisk
   \`ACCESS_ISSUER\` og \`ACCESS_AUD\` fra denne applikasjonen. **Ikke**
   legg Access på offentlig \`/api/leads\`. Test at anonymt adminkall
   får 403; beskytt også inngangen til Access-policyen med MFA etter
   organisasjonens praksis.
7. Etter kundens godkjenning og ferdig kontroll, endre Worker-vars
   \`SITE_STAGE=production\`, \`PRIVACY_APPROVED=true\`,
   \`PUBLIC_LEADS_ENABLED=true\`, \`SEND_NOTIFICATIONS=true\`.
   Dette er **backendstatus**, ikke publisering av sofiemyrbil.no.
8. På **eksisterende** Cloudflare Worker-prosjekt for selve Sofiemyr-nettsiden:
   sett byggevariablene \`PUBLIC_LEAD_ENDPOINT\` til den *faktisk deployede*
   \`https://<intake-worker>/api/leads\`-adressen og
   \`PUBLIC_LEADS_ENABLED=true\`, og la Git-deploy bygge siden på nytt.
   Uten **begge** disse verdiene er knappen fortsatt deaktivert i koden.
   Preview kan fortsatt være \`noindex\`.
9. Kjør én tillatt test med syntetiske kontaktdata: sjekk HTTP 201 og
   \`receipt_status=stored\`, riktig D1-kvittering, mottatt Resend-varsel
   i **riktig innboks**, 403 på anonym \`/admin\`, og at en repetisjon med
   samme \`Idempotency-Key\` ikke skaper duplikat. Først da kan skjemaet
   beskrives som operativt. Avklar backup/eksport og sletting i D1.

## Sikker rollback

- Sett Worker \`PUBLIC_LEADS_ENABLED=false\` (gir 503 uten lagring).
- Sett nettstedets \`PUBLIC_LEADS_ENABLED=false\` og bygg på nytt, slik at
  knappen deaktiveres og telefonalternativet vises.
- Ikke slett D1-data eller kutt tilgangen til historiske mottak automatisk.
- \`SEND_NOTIFICATIONS=false\` alene stopper e-post, **ikke** D1-mottak:
  bruk riktig flagg ved total stopp.

## Tester og begrensninger

Kjør \`node --test intake-worker/tests/*.test.mjs\` fra repo-roten.
Disse bruker mock av D1 og verifiserer regler/kvitteringer, **ikke** ekte
Cloudflare-ressurser, e-postlevering eller Access login.
Ekte deploy og innboks-test krever operatorhandling og bekreftelse.
\`wrangler.jsonc\` holdes lokalt under førstegangsoppsettet til faktisk D1-ID
og miljø er kjent; ingen generisk Cloudflare-konto eller hemmeligheter er i repoet.
