// Site field names stay unchanged. Only the transport maps to the shared MWS schema.
export function bookingPayload(fields: FormData) {
  return {
    form: 'verksted-foresporsel',
    regnr: String(fields.get('regnr') ?? '').trim(),
    phone: String(fields.get('telefon') ?? '').trim(),
    email: String(fields.get('epost') ?? '').trim(),
    services: fields.getAll('services').map(String),
    message: String(fields.get('melding') ?? '').trim(),
    website_confirmation: String(fields.get('website_confirmation') ?? ''),
  };
}
