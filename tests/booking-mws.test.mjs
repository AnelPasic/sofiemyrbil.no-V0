import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {bookingPayload} from '../src/lib/booking-intake.ts';

test('existing booking fields map to the installed generic schema without losing selected services',async()=>{
  const fields=new FormData();
  for(const [key,value] of Object.entries({regnr:' TEST123 ',telefon:'+4700000000',epost:'synthetic@example.com',melding:'SYNTHETIC TEST'}))fields.append(key,value);
  fields.append('services','EU-Kontroll');fields.append('services','Service');
  const payload=bookingPayload(fields);
  assert.deepEqual(payload.services,['EU-Kontroll','Service']);assert.equal(payload.regnr,'TEST123');
  assert.equal(payload.email,'synthetic@example.com');assert.equal(payload.phone,'+4700000000');
  const {configuration,validate}=await import('../lead-intake/src/domain.mjs');
  const config=JSON.parse(readFileSync(new URL('../lead-intake/site.config.json',import.meta.url),'utf8'));
  const canonical=configuration({SITE_ID:config.siteId,SITE_ORIGIN:config.siteOrigin,INGRESS_ORIGIN:config.ingressOrigin,TIMEZONE:config.timezone,FORMS_JSON:JSON.stringify(config.forms),PACKAGES_JSON:'[]'});
  assert.deepEqual(validate(payload,canonical).services,['EU-Kontroll','Service']);
  assert.throws(()=>validate({...payload,services:['unavailable']},canonical));
});
test('customer install has no copied backend, dashboard or D1 migrations',()=>{
  const config=JSON.parse(readFileSync(new URL('../lead-intake/site.config.json',import.meta.url),'utf8'));
  assert.equal(config.privacy,undefined,'Internal operating policy belongs in the private central registry');
  assert.equal(config.access,undefined,'Private operator configuration must not be published in this repository');
  const {files}=JSON.parse(readFileSync(new URL('../lead-intake/kit-lock.json',import.meta.url),'utf8'));
  assert.equal(existsSync(new URL('../intake-worker/src/worker.mjs',import.meta.url)),false,'Old customer backend must be removed');
  for(const path of Object.keys(files))assert.doesNotMatch(path,/^src\/worker\.mjs$|admin\.|migrations|notify\.mjs/);
});
