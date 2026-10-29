# Sofiemyr intake is maintained centrally in MWS

The old customer-specific backend was never deployed and has been removed. No backend, dashboard, outbox or migration is copied into this website.

- Frontend adapter: `../lead-intake/`, installed from the exact MWS commit recorded in `kit-lock.json`.
- Form: existing `BookingForm.astro`, shared by `/bestilling/` and `/kontakt/` through the existing global CMS source. This sends an enquiry, never confirms an appointment.
- Receiver/dashboard: `sofiemyrbil-intake.anel.workers.dev/admin/`, with Cloudflare Access for the approved operator.
- Dedicated database: `sofiemyrbil-mws-leads`, EU jurisdiction, independent of all other customers.
- Backend source, migrations and controlled upgrades: `AnelPasic/MedonWebSystem/kits/lead-intake/` and its deployment registry.

Keep frontend submission gated by its explicit HTTPS same-origin endpoint and activation flag until real acceptance is recorded. Provider credentials remain Worker Secrets. Internal operational details are not public website content.

No public DNS, production-domain or indexing changes are authorized by this installation. Exact test/deployment status is recorded in `../coordination/INTAKE-ACCEPTANCE.md`.
