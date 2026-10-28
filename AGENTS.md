# AGENTS.md — MedonWebSystem independent Astro project

This directory is a **reusable Astro test starter**, not a deployable customer site.

1. Read `README.md` and, for the upstream system, `../starter/TEST-WITH-AGENT.md` if available. `src/content/site-chrome` is the sole header/footer/appearance authority. `src/content/pages/*.json` is the sole per-page content/SEO/Hero authority. `src/content/global-content/*.json` is the native shared-source collection. `.pages.yml` is one integrated stock Pages CMS schema.
2. Do not replace the canonical shared Site Chrome/Hero/Page Builder with custom components unless an actual defect is reproduced and documented. Do not bring over Optimalisering Oslo/Medon client copy, themes, logos, contacts, prices or production infrastructure.
3. Treat the included neutral examples as **fictional**. Commercial pricing, contact form, proof and calculator remain disabled until the owner supplies authoritative data and independently approves the feature. No real leads or transactions.
4. Preserve `noindex,nofollow`; never set up a public deploy, analytics/ads, Resend/D1, real CMS repository connection, or GitHub push without specific approval. The user first wants a local technology/UX test.
5. Use Node >=24.12: `npm install` -> `npm run verify` -> `npm run dev`. On Linux with Google Chrome, `npm run verify:second-brand` also runs a fictional, isolated Git + browser acceptance test.
6. Verify mobile menu tap/click, 390/768/1440px, 1–3 columns, shared section on 2 routes, FAQ/PageList, accessible focus/navigation, and SEO head values. For any change, report exact file/commit, failing scenario and test evidence. Never claim a simulated CMS data roundtrip is a real authenticated Pages CMS save.
7. Before writing customer material lock services, offers, brand, lead conversion, legal/privacy and proof. Show owner nav/Hero/contact/package/footer Visual Shell before fleshing out other pages.
