import test from 'node:test';
import assert from 'node:assert/strict';
import {validate, configuration, HttpError} from '../src/domain.mjs';
import worker from '../src/worker.mjs';

const site='sofiemyrbil.no';
const origin='https://sofiemyrbil-no-v0.anel.workers.dev';
const ingress='https://sofiemyrbil-intake.anel.workers.dev';
const valid={
  site,form:'verksted-foresporsel',regnr:'EK 12345',telefon:'900 00 000',
  epost:'kunde@example.org',services:['EU-Kontroll','Service'],
  melding:'Ønsker time neste uke',source:{page:'/bestilling/',utm_source:'google'},
  website_confirmation:'',
};
function env(overrides={}) {
 const rows=new Map();
 const DB={prepare(sql) {let params=[];return {
  bind(...values){params=values;return this;},
  async run(){
   if(sql.startsWith('INSERT INTO receipts')){
    const [id,siteId,requestOrigin,key,intent,payload,now,due]=params;
    const index=siteId+'|'+key;
    if(rows.has(index))return {success:true,meta:{changes:0}};
    rows.set(index,{id,site_id:siteId,origin:requestOrigin,idempotency_key:key,
     intent,payload_json:payload,created_at_ms:now,due_at_ms:due});
    return {success:true,meta:{changes:1}};
   }
   throw new Error('unexpected write');
  },
  async first(){
   if(sql.startsWith('SELECT id,payload_json FROM receipts')){
    const [siteId,key]=params;return rows.get(siteId+'|'+key)??null;
   }
   throw new Error('unexpected read');
  }
 };}};
 return {SITE_ID:site,INGRESS_ORIGIN:ingress,ALLOWED_ORIGINS:origin,
   SITE_STAGE:'production',PRIVACY_APPROVED:'true',PUBLIC_LEADS_ENABLED:'true',
   SEND_NOTIFICATIONS:'false',DB,RATE_LIMITER:{limit:async()=>({success:true})}, ...overrides};
}
function request(payload=valid,headers={}) {
 return new Request(ingress+'/api/leads',{method:'POST',headers:{
 'Content-Type':'application/json',Origin:origin,'Idempotency-Key':'same-request-000001',
 'CF-Connecting-IP':'203.0.113.5',...headers},body:JSON.stringify(payload)});
}
const context={waitUntil(p){void p.catch(()=>{});}};
test('Sofiemyr fields and site are strictly validated',()=>{
 const v=validate(valid,site);
 assert.equal(v.regnr,'EK 12345');
 assert.deepEqual(v.services,['EU-Kontroll','Service']);
 assert.equal(v.source.utm_source,'google');
 for(const changes of [
  {regnr:''},{epost:'bad'},{telefon:'123'},{services:[]},
  {services:['EU-Kontroll','EU-Kontroll']},{services:['unknown']},
  {melding:'x'.repeat(2001)},{website_confirmation:'bot'},
  {source:{page:'https://example.org'}},
 ])assert.throws(()=>validate({...valid,...changes},site),HttpError);
 assert.throws(()=>validate({...valid,site:'different.no'},site),e=>e.status===403);
 assert.throws(()=>validate({...valid,unexpected:'data'},site),HttpError);
});
test('configuration does not accept non-https or wildcard origins',()=>{
 assert.ok(configuration(env()).origins.has(origin));
 assert.throws(()=>configuration(env({INGRESS_ORIGIN:'http://localhost:8787'})));
 assert.throws(()=>configuration(env({ALLOWED_ORIGINS:'*'})));
});
test('lead API stores before returning 201, retries same idempotency key as 200',async()=>{
 const environment=env();
 const first=await worker.fetch(request(),environment,context);
 assert.equal(first.status,201);
 const accepted=await first.json();
 assert.equal(accepted.ok,true);
 assert.equal(accepted.receipt_status,'stored');
 assert.match(accepted.id,/^[a-f0-9-]{36}$/);
 const repeat=await worker.fetch(request(),environment,context);
 assert.equal(repeat.status,200);
 assert.equal((await repeat.json()).id,accepted.id);
});
test('storage conflicts and unapproved state do not return fake success',async()=>{
 const environment=env();
 await worker.fetch(request(),environment,context);
 const collision=await worker.fetch(request({...valid,regnr:'AB 12345'}),environment,context);
 assert.equal(collision.status,409);
 const disabled=await worker.fetch(request(),env({PUBLIC_LEADS_ENABLED:'false'}),context);
 assert.equal(disabled.status,503);
 const denied=await worker.fetch(request(),env(),context);
 // A valid new test request to see another gated rejection.
 const noConsent=await worker.fetch(request(valid,{'Idempotency-Key':'new-request-00002'}),env({PRIVACY_APPROVED:'false'}),context);
 assert.equal(noConsent.status,503);
 assert.ok(denied.ok);
});
test('origin, honeypot and invalid payload are rejected',async()=>{
 const environment=env();
 const badOrigin=await worker.fetch(request(valid,{Origin:'https://evil.example.org'}),environment,context);
 assert.equal(badOrigin.status,403);
 const trap=await worker.fetch(request({...valid,website_confirmation:'spam'}, {'Idempotency-Key':'trap-request-00001'}),environment,context);
 assert.equal(trap.status,422);
 const wrongSite=await worker.fetch(request({...valid,site:'elsewhere.example'}, {'Idempotency-Key':'wrong-site-00001'}),environment,context);
 assert.equal(wrongSite.status,403);
});
test('private administration never exposes data without Access authorization',async()=>{
 const r=await worker.fetch(new Request(ingress+'/admin/receipts'),env(),context);
 assert.equal(r.status,403);
});
