# Tjenestesider – URL-overgang ved lansering

Kundeprosjektet har fått egne redigerbare tjenestesider. **Ikke rør prod-domenet eller sett opp redirects nå.** Denne listen brukes ved senere migrering fra eksisterende Concrete-nettside til nye Workers-ruter.

| Eksisterende URL-sti på sofiemyrbil.no | Planlagt ny URL-sti | Handling ved migrering |
| --- | --- | --- |
| `/service` | `/service/` | Samme kanoniske sti (trailing slash normaliseres) |
| `/verkstedtjenester/service` | `/service/` | HTTP 301 |
| `/verkstedtjenester/reparasjoner` | `/reparasjoner/` | HTTP 301 |
| `/verkstedtjenester` | `/tjeneste/` | HTTP 301 |

Nye kategorier: `/diagnose/`, `/bobilservice/`, `/flateavtale/`. Eksisterende nye V0-side `/eu-kontroll/` beholdes.

Ved lansering må alle tidligere publiserte tjeneste-URL-er kartlegges og kontrolleres mot aktuell live-url i Concrete, slik at 301-omdirigeringene ikke skaper kjeder eller feil. Implementer i **faktisk Workers/Cloudflare-ruting** for produksjonsdomenet, ikke med HTML meta-refresh. Test statuskode og Location med curl før DNS-bytte.

Arbeidsdeling: en annen tråd eier **forsiden**, ikke rediger `src/content/pages/home.json` fra denne oppgaven. Forsiden peker foreløpig til `/tjeneste/` og skal få direkte tjenestelenker når den tråden velger det. MedonWebSystem-systemrepo er urørt.
