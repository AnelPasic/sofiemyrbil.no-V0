# MWS intake installation - 2026-10-29

State: source prepared; actual provider acceptance not yet completed. Do not describe mail delivery, authenticated dashboard or rollback as verified until recorded below.

The existing preview remains `https://sofiemyrbil-no-v0.anel.workers.dev/`, noindex preserved. Existing booking and contact pages still use the one `bestilling-skjema` CMS source. Field layout, all six service choices and EU inspection price 1 450 NOK remain unchanged. Submission is an enquiry; the workshop confirms time and price.

Frontend adapters only are installed from immutable MWS source `4025e49c7041f6657a7c90d99b5f4a9e1dabfd77`. Backend, dashboard and migrations are central in MedonWebSystem, with a dedicated customer registry entry. The old, never deployed customer-specific intake implementation is removed.

Dedicated resources: Worker `sofiemyrbil-intake`, EU D1 `sofiemyrbil-mws-leads` (`9a2534a3-b0cf-4481-abc8-0c4a0c29efe7`). Access protects the private `/admin/` area for the approved operator. Provider credentials remain Secrets. The website uses same-origin `/api/leads` and one service binding, with explicit frontend and backend activation flags.

OWNER approved installation and a narrowly scoped operator rollout after GitHub422 unsupported required-reviewer rules. This retains the same central exact-source/CI/resource/migration/rollback checks. No global workflow approval guard is removed. No other clients, public DNS or production pages are in scope.

Internal operating procedures and parameters are intentionally excluded from all public site/privacy copy.

Local evidence: field transport contract and strict Astro check pass; Astro/Pagefind build passes (Pagefind needed normal host permissions). Real receipt/mailbox/Access/CSV/attribution/disable/rollback evidence is pending deployment.
