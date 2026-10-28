# PROJECT DNA – Sofiemyr Bil AS

Project: Sofiemyr Bil AS
Site / domain: sofiemyrbil.no
Mode: MIGRATION
Site ownership: CLIENT_OWNED
Workflow: STANDARD
Primary language(s): Norsk (bokmål)
Region / compliance context: Norge (GDPR, Ekomloven, Forbrukertilsynet, Vegvesen godkjenning)

## Business truth (not final copy)
- **Hva bedriften faktisk selger:** Offentlig godkjent bilverksted (kjøretøy inntil 3 500 kg). Spesialkompetanse på Ford, men utfører full service, EU-kontroll (PKK), mekaniske reparasjoner, feilsøking/diagnose, elbil/hybrid-service, bobilservice (opptil 3,5t) og flåteavtaler for alle bilmerker.
- **Hovedkjøper:** Privatpersoner og næringsdrivende/flåtekunder i Kolbotn, Sofiemyr, Oppegård, Nordre Follo og Oslo Syd, samt Ford-eiere i et utvidet omland.
- **Hva brukeren prøver å oppnå:**
  1. Bestille EU-kontroll raskt.
  2. Bestille periodisk service eller feilsøking/reparasjon med henvendelse/reg.nr.
  3. Få rask kontakt (telefon +47 66 81 37 00) og finne frem til verkstedet i Skiveien 42.
  4. Finne ut om verkstedet tar deres spesifikke bilmerke, elbil, varebil eller bobil.
- **Primær konverteringshandling:** BOOK / QUOTE / CONTACT – Direkte oppringning (+47 66 81 37 00) eller innsending av timebestilling/forespørsel med reg.nr og bilinfo.
- **Sekundære handlinger:** Veibeskrivelse/kart til Skiveien 42, sjekk av kontrollmåned for EU-kontroll, henvendelse om flåteavtale.
- **Kjente begrensninger:** Ingen oppdiktede priser eller garantier (gammel side oppga EU-kontroll til kr 1450,- som må verifiseres før publisering som gjeldende). Ingen falske anmeldelser.
- **Ekte bevis/fakta:** Etablert i mai 1997 (over 27 års drift). Flyttet til moderne lokaler i Skiveien 42 i 2012. 5 faste erfarne mekanikere (bl.a. Mateusz Okon, Jon Andreas Nilsen, Fredrik Landmark, Erik). Autorisert verksted hos Statens vegvesen.

## Page archetypes & URL-kart (med bevaring/omdirigering)
- **Forside (`/`):** Tydelig verdiforslag ("Ditt lokale bilverksted på Kolbotn – spesialist på Ford, godkjent for alle merker"), direkte handlinger, tillitsfaktorer, åpningstider og nøkkelinformasjon.
- **EU-kontroll (`/eu-kontroll`):** Bevarer eksisterende URL (`/eu-kontroll` og redirect fra `/verkstedtjenester/eu-kontroll`). Informasjon om kontroll, frister og bestilling.
- **Service (`/service`):** Bevarer eksisterende URL (`/service` og redirect fra `/verkstedtjenester/service`). Dekning for Ford, elbil, hybrid og andre merker.
- **Verkstedtjenester / Reparasjoner (`/verkstedtjenester` og `/reparasjoner`):** Bevarer oversikt og mekaniske tjenester (feilsøking, bremser, motor, understell).
- **Bobilservice (`/bobilservice`):** Bevarer eksisterende URL. Service og reparasjoner for bobiler og campingbiler opptil 3,5t.
- **Flåteavtale (`/flateavtale`):** Redirect fra gammel URL `/flateavtale-service-og-vedlikehol`. Bedriftskunder og serviceavtaler.
- **Om oss (`/om-oss`):** Bevarer eksisterende URL. Historikk siden 1997, flyttingen i 2012, teamet og lokal forankring.
- **Kontakt & Bestilling (`/kontakt` og `/bestilling`):** Skiveien 42, telefon, åpningstider (Man–Tor 07:30–16:30, Fre 07:30–16:00), kart og bestillingsskjema med reg.nr.
- **Personvern (`/personvern`):** Lovpålagt iht. GDPR og MWS-037.

## Visual direction
- **Merkevare:** Norsk, sobert, troverdig, ryddig bilverksted med høy kontrast og tydelig typografi.
- **DaisyUI tema:** Mørkeblå tillitsfarge (primær), dyp skifer/stål (nøytral), frisk aksent for CTA, klar hvit/lys bakgrunn for lesbarhet. Full støtte for Light/Dark mode via standard `SiteChromeThemeHead`.
- **Anti-patterns:** Ingen generiske "amerikanske stock-fotos" med feil bilskilt, ingen uleselige skrifttyper, ingen skjulte telefonnumre eller komplekse flertrinns-skjemaer uten reg.nr-felt.

## Phase 1 infrastructure
- **Git repo:** `https://github.com/AnelPasic/sofiemyrbil.no-V0.git` (branch: `main`)
- **Rammeverk:** Astro 7.3.7 + Tailwind CSS 4 + daisyUI 5.7.50
- **CMS:** Pages CMS (`.pages.yml`) med Git-backed JSON-innhold i `src/content/`
- **Hosting/Preview:** Cloudflare Pages (eller tilsvarende valgt av eier)
- **Skjemahåndtering:** Inntakskontrakt iht. MWS-036/037 (deaktivert med tydelig DEMO-markering i Phase 1, klar for backend-kobling i Phase 4).
- **Status:** Phase 1 teknisk fundament opprettet fra `AnelPasic/MedonWebSystem/main` starter. `npm run verify` bestått 100%.
