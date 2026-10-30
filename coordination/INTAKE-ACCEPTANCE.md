# MWS intake installation - 2026-10-29

State (2026-10-30): deployed on existing preview; real acceptance is incomplete. Mail delivery and authenticated dashboard/export are not yet verified.

The existing preview remains `https://sofiemyrbil-no-v0.anel.workers.dev/`, noindex preserved. Existing booking and contact pages still use the one `bestilling-skjema` CMS source. Field layout, all six service choices and EU inspection price 1 450 NOK remain unchanged. Submission is an enquiry; the workshop confirms time and price.

Frontend adapters only are installed from immutable MWS source `4025e49c7041f6657a7c90d99b5f4a9e1dabfd77`. Backend, dashboard and migrations are central in MedonWebSystem, with a dedicated customer registry entry. The old, never deployed customer-specific intake implementation is removed.

Dedicated resources: Worker `sofiemyrbil-intake`, EU D1 `sofiemyrbil-mws-leads` (`9a2534a3-b0cf-4481-abc8-0c4a0c29efe7`). Access protects the private `/admin/` area for the approved operator. Provider credentials remain Secrets. The website uses same-origin `/api/leads` and one service binding, with explicit frontend and backend activation flags.

OWNER approved installation and a narrowly scoped operator rollout after GitHub422 unsupported required-reviewer rules. This retains the same central exact-source/CI/resource/migration/rollback checks. No global workflow approval guard is removed. No other clients, public DNS or production pages are in scope.

Internal operating procedures and parameters are intentionally excluded from all public site/privacy copy.

Source delivery: [PR #8](https://github.com/AnelPasic/sofiemyrbil.no-V0/pull/8) merged with green final-head CI at `953c4155a2b6380c201db25a0a39031f270d4fd0`. Native Cloudflare build `0accbcf4-8efd-4c15-8aa2-c9d9c3d25c5f` succeeded from that exact main and deployed frontend version `10b0f4f7-0240-477d-850d-b6d513e8a5d8`. `INTAKE` binds to the dedicated Worker's `IntakeService`; endpoint is `https://sofiemyrbil-no-v0.anel.workers.dev/api/leads`.

Actual checks: clearly synthetic preview form submission returned201 after D1 storage, preserving two selected services and observed campaign attribution. Replaying the same request/key returned200 with the same receipt. Central disable made the endpoint return503; explicit configuration rollback restored intake without changing the stored payload hash. This is recovery within the first compatible source release, not proof of rollback to an older release. Anonymous admin access redirects to Cloudflare Access; the backend accepts no public direct lead POST. Live `/bestilling/` and `/kontakt/` each contain one form; all three checked pages including privacy remain noindex.

Local source checks passed before source merge: strict Astro, booking transport, preserved site tests and Astro/Pagefind build. This follow-up reran only the2 affected transport/boundary tests. The public customer configuration now contains identity/form data only; private operating policy is managed centrally and is absent from current customer files and public site/privacy output. Earlier Git history is not rewritten. Runtime configuration and pinned adapter files are unchanged.

Remaining: owner must rotate/revoke the old Resend credential and complete actual Access login. Notifications remain deliberately paused; the synthetic receipt is pending with zero send attempts. No actual email delivery is claimed. Authenticated dashboard/CSV/JSON, period controls, live estimated/unknown attribution and final owner acceptance remain open. MWS is not marked READY_OUT_OF_BOX. Internal evidence and provider details are maintained in the private MWS repository.
