# MWS intake installation - 2026-10-29

State (2026-10-30): deployed on existing preview. Gmail delivery is verified; OWNER confirmed actual authenticated dashboard/export/reporting. Final correction CI and complete acceptance are still tracked below.

The existing preview remains `https://sofiemyrbil-no-v0.anel.workers.dev/`, noindex preserved. Existing booking and contact pages still use the one `bestilling-skjema` CMS source. Field layout, all six service choices and EU inspection price 1 450 NOK remain unchanged. Submission is an enquiry; the workshop confirms time and price.

Frontend adapters only are installed from immutable MWS source `4025e49c7041f6657a7c90d99b5f4a9e1dabfd77`. Backend, dashboard and migrations are central in MedonWebSystem, with a dedicated customer registry entry. The old, never deployed customer-specific intake implementation is removed.

Dedicated resources: Worker `sofiemyrbil-intake`, EU D1 `sofiemyrbil-mws-leads` (`9a2534a3-b0cf-4481-abc8-0c4a0c29efe7`). Access protects the private `/admin/` area for the approved operator. Provider credentials remain Secrets. The website uses same-origin `/api/leads` and one service binding, with explicit frontend and backend activation flags.

OWNER approved installation and a narrowly scoped operator rollout after GitHub422 unsupported required-reviewer rules. This retains the same central exact-source/CI/resource/migration/rollback checks. No global workflow approval guard is removed. No other clients, public DNS or production pages are in scope.

Internal operating procedures and parameters are intentionally excluded from all public site/privacy copy.

Source delivery: [PR #8](https://github.com/AnelPasic/sofiemyrbil.no-V0/pull/8) merged with green final-head CI at `953c4155a2b6380c201db25a0a39031f270d4fd0`. Native Cloudflare build `0accbcf4-8efd-4c15-8aa2-c9d9c3d25c5f` succeeded from that exact main and deployed frontend version `10b0f4f7-0240-477d-850d-b6d513e8a5d8`. `INTAKE` binds to the dedicated Worker's `IntakeService`; endpoint is `https://sofiemyrbil-no-v0.anel.workers.dev/api/leads`.

Actual checks: clearly synthetic preview form submission returned201 after D1 storage, preserving two selected services and observed campaign attribution. Replaying the same request/key returned200 with the same receipt. Central disable made the endpoint return503; explicit configuration rollback restored intake without changing the stored payload hash. This is recovery within the first compatible source release, not proof of rollback to an older release. Anonymous admin access redirects to Cloudflare Access; the backend accepts no public direct lead POST. Live `/bestilling/` and `/kontakt/` each contain one form; all three checked pages including privacy remain noindex.

Local source checks passed before source merge: strict Astro, booking transport, preserved site tests and Astro/Pagefind build. This follow-up reran only the2 affected transport/boundary tests. The public customer configuration now contains identity/form data only; private operating policy is managed centrally and is absent from current customer files and public site/privacy output. Earlier Git history is not rewritten. Runtime configuration and pinned adapter files are unchanged.

OWNER confirmed the new Resend key is stored and the old key revoked. Central recovery deployed intake version `2d3d57c6-b9fb-41a6-8ca2-5988e872c660` from the same pinned source with lead and notification flags restored, retaining the new Secrets. The queued synthetic receipt was accepted by Resend on its first send attempt. Actual Gmail INBOX receipt was verified at2026-10-30T08:55:59Z with matching receipt reference and synthetic marker. Headers include both approved recipients; independent delivery to the second mailbox is not claimed.

OWNER confirmed actual Access login and dashboard, synthetic campaign receipt, JSON/CSV, 30d/90d/6m/1y, week/month and comparison controls. These checks are OWNER-confirmed in their authenticated session; anonymous denial was separately tool-verified. Two further clearly synthetic actual preview submissions prove estimated IP-match attribution and unknown attribution after explicit denial. Both returned201/stored, with the expected D1 classification and one accepted send attempt. No denied measurement was recovered from campaign memory.

Follow-up CI/merge is tracked in customer PR #9 and MWS PR #67. Overall owner release acceptance of the generic kit remains separate; MWS is not marked READY_OUT_OF_BOX. Internal evidence and provider details are maintained in the private MWS repository.
