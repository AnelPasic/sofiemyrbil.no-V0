# Integrated MedonWebSystem Astro starter — MWS-052

**Status (2026-10-28):** The full integrated starter is in **MedonWebSystem `main`**, squash-merged in [PR #18](https://github.com/AnelPasic/MedonWebSystem/pull/18). All checks passed, including 11 integration/export tests, Astro typecheck/build, Linux + Windows system source checks, and an independent **fictional SykkelLab Demo** Chrome/Git dry run. **Real authenticated Pages CMS edits in a separately connected GitHub repository, preview deployment and OWNER visual acceptance remain unverified.** This is ready for agent-assisted testing, not a live customer release.

## Run immediately from a MedonWebSystem clone

Requires Node >=24.12, npm.

```sh
cd starter/astro
npm install
npm run verify
npm run dev
```

The site contains seven neutral demo pages. All responses intentionally include `noindex,nofollow`. No price promises, functioning lead intake, public search index, customer proof or actual sales forms are bundled.

## Create a standalone website root (recommended for Antigravity/Codex)

From the **MedonWebSystem repository root**:

```sh
node starter/astro/scripts/create-site.mjs --target ../mws-demo-test --brand "Testverksted Demo"
cd ../mws-demo-test
npm install
npm run verify
npm run dev
```

The exporter creates a **new directory** and refuses to overwrite anything. It copies all source/configuration to repository root, rewrites demo brand names in JSON and synchronizes Pages CMS PageList labels. It never pushes code, connects CMS or deploys. The resulting root includes `.pages.yml`, `AGENTS.md`, `package.json`, `src/` and `coordination/`.

An Antigravity or Codex run should read `AGENTS.md` in the exported project, verify the site at desktop/mobile widths and report build/test/screenshots. For a full copy-paste instruction see [upstream test handoff](../TEST-WITH-AGENT.md).

## CMS architecture

- Stock Pages CMS: **one** `.pages.yml`, a readonly root URL-slug followed by SEO → single editable Hero → ordered content sections → FAQ → listing.
- Independent global editors for header, appearance and footer, with shared responsive Site Chrome.
- Native **Global Innhold** collection at `src/content/global-content/*.json`; pages select a stable `sharedContent` reference, never copy/promo GitHub Actions. Validate IDs/UUIDs, missing sources, collision and publication.
- Local and global rich content use a common shape: headings, paragraphs, cards, links, 1–3 column layouts, surfaces and alignment.
- Shared Hero has layout, optional first-sentence emphasis and proof cards. Proof **requires independent verified permission and approval**; none is turned on in demo.
- PageList, FAQ and Content Voice are installed; prices/proof/forms/calculators are protected, inert or approval-gated.

## Test and approval boundaries

`npm run verify`: validate synchronized CMS selects, 11 unit/integration/export tests, Astro typecheck and static build.

`npm run verify:second-brand`: on Linux with Google Chrome, run the isolated fictional SykkelLab root install, local Git content commit/reopen/revert, responsive Chromium preview assertions and 7-route noindex checks. [Last passing workflow](https://github.com/AnelPasic/MedonWebSystem/actions/runs/40614127585) demonstrates earlier 9-test baseline; PR #18's final CI includes the 11-test exporter as well.

Neither command proves an actual Pages CMS OAuth/login, native `reference` selection and authenticated GitHub commit, nor an independently deployed preview. For these, create a separate temporary GitHub repository from the exported site, connect it to Pages CMS and test create → select on two pages → save → reopen → edit → preview both → hide on one → revert. Review mobile/desktop visually before acceptance. Never remove noindex or enable forms/release without owner approval.

**Safety:** Do not copy any Optimalisering Oslo pilot content/brand/colors, real customer case, prices, Resend/D1/lead credentials, `sunset` theme, or production domains. Never call a local simulation a real CMS acceptance.
