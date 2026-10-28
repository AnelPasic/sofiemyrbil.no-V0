import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { builderPageSchema, publicPath, resolveSections, validateSharedContentEntries } from '../src/page-builder.ts';
import { resolveHeroProof } from '../src/lib/hero-proof.ts';
import { composeSiteChrome } from '../src/lib/site-chrome-content.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(join(root,p),'utf8');
const json = p => JSON.parse(read(p));
const dir = 'src/content/pages';
const filenames = readdirSync(join(root,dir)).filter(x => x.endsWith('.json'));
const pages = filenames.map(x => builderPageSchema.parse(json(dir+'/'+x)));
const masters = json('src/content/global-masters.json');
const shared=validateSharedContentEntries(Object.fromEntries(readdirSync(join(root,'src/content/global-content')).filter(f=>f.endsWith('.json')).map(f=>[f,json('src/content/global-content/'+f)])));
const home=pages.find(p=>p.slug==='home'),service=pages.find(p=>p.slug==='tjeneste');
const chrome = composeSiteChrome(json('src/content/site-chrome/header.json'),json('src/content/site-chrome/footer.json'),json('src/content/site-chrome/appearance.json'));
test('one canonical page per actual route, no missing component', () => {
  assert.equal(new Set(pages.map(p=>publicPath(p.slug))).size,pages.length);
  assert.equal(pages.length,10);
  assert.equal(pages.find(p=>p.slug==='home')?.kind,'home');
  assert.equal(pages.find(p=>p.slug==='404')?.kind,'utility');
  for(const path of ['src/components/BaseLayout.astro','src/components/PageView.astro','src/components/Hero.astro','src/components/SiteChromeHeader.astro','src/components/PageSections.astro']) assert.ok(existsSync(join(root,path)),path);
});
test('native CMS exposes the one shared editorial hierarchy across all pages', () => {
  const source = read('.pages.yml');
  const parsed = YAML.parseDocument(source,{uniqueKeys:true});
  assert.equal(parsed.errors.length,0,parsed.errors.map(e=>e.message).join('\n'));
  const cms=parsed.toJS();
  const names=cms.content.map(x=>x.name);
  assert.deepEqual(names.slice(0,3),['globalUi','globalContentGroup','contentTone']);
  assert.equal(cms.content[1].items[0].type,'collection');
  assert.equal(cms.content[1].items[0].name,'sharedContent');
  assert.equal(cms.components.builderSharedPlacement.fields[0].type,'reference');
  const entries=cms.content.slice(3);
  assert.equal(entries.length,pages.length);
  for(const entry of entries){
    assert.ok(existsSync(join(root,entry.path)),entry.path);
    assert.deepEqual(entry.fields.map(f=>f.name),['slug','seo','hero','sections','faq','listing','kind']);
    assert.equal(entry.fields[0].readonly,true);
    assert.equal(entry.fields[2].component,'standardPageHero');
    assert.equal(entry.fields[3].component,'builderSections');
  }
  assert.ok(cms.components.builderSections);
  assert.ok(cms.components.standardPageHero);
  assert.equal(cms.settings.content.merge,true);
});
test('neutral navigation routes exist and search/languages are not fake', () => {
  if(chrome.headerOptions.showSearch) assert.ok(chrome.search);
  if(chrome.headerOptions.showLanguageSwitch) assert.ok(chrome.languages.length >= 1);
  const paths=new Set(pages.map(p=>publicPath(p.slug)));
  const all=[...chrome.navigation.flatMap(n=>[n.href,...(n.kind==='dropdown'?n.links.map(x=>x.href):n.kind==='mega'?n.columns.flatMap(c=>c.links.map(x=>x.href)):[])]),chrome.primaryCta?.href,...chrome.footer.groups.flatMap(g=>g.links.map(x=>x.href)),...chrome.footer.legalLinks.map(x=>x.href)];
  for(const path of all)if(path?.startsWith('/'))assert.ok(paths.has(path),'Broken demo route '+path);
});
test('no invented active offer, protected source or lead submission', () => {
  assert.ok(read('src/components/BaseLayout.astro').includes('noindex,nofollow'));
  assert.ok(!existsSync(join(root,'src/pages/api/leads.ts')));
  for(const master of Object.values(masters))if(master.type==='protected')assert.equal(master.publicationApproved,false);
  for(const p of pages){
    assert.ok(p.hero.visual.kind==='none' || p.hero.visual.kind==='image');
    assert.ok(resolveSections(p,masters,pages,[],shared).every(s=>s.type!=='global'||s.master.type!=='protected'));
  }
});
test('tone is default neutral and one CMS source', () => {
  assert.equal(json('coordination/CONTENT-TONE.json').defaultPreset,'balansert');
  assert.equal((read('.pages.yml').match(/name: contentTone/g)||[]).length,1);
});

test('native shared source reuses one JSON on two pages, local hide is independent',()=>{
  const h=resolveSections(home,masters,pages,[],shared),s=resolveSections(service,masters,pages,[],shared);
  const a=h.find(x=>x.type==='content'&&x.section.id==='felles-eksempel');
  const b=s.find(x=>x.type==='content'&&x.section.id==='felles-eksempel');
  assert.deepEqual(a?.section,b?.section);
  assert.equal(a.section.body.length,3);
  assert.equal(a.section.items.length,3);
  assert.equal(a.section.layout,'three-columns');
  const hidden={...service,sections:service.sections.map(x=>x._block==='sharedContent'?{...x,visibility:'hidden'}:x)};
  assert.ok(!resolveSections(hidden,masters,pages,[],shared).some(x=>x.type==='content'&&x.section.id==='felles-eksempel'));
  assert.ok(resolveSections(home,masters,pages,[],shared).some(x=>x.type==='content'&&x.section.id==='felles-eksempel'));
});
test('invalid, duplicate and colliding shared sources fail before publication',()=>{
  const source=json('src/content/global-content/felles-eksempel.json');
  assert.throws(()=>validateSharedContentEntries({'different.json':source}),/filename\/ID mismatch/);
  assert.throws(()=>validateSharedContentEntries({'priser.json':{...source,id:'priser'}}));
  assert.throws(()=>validateSharedContentEntries({'x.json':{...source,id:'x'},'y.json':{...source,id:'y'}}),/Duplicate shared content identity/);
  const missing={...home,sections:[...home.sections,{_block:'sharedContent',entry:'does-not-exist'}]};
  assert.throws(()=>resolveSections(missing,masters,pages,[],shared),/Missing shared source/);
  const twice={...home,sections:[...home.sections,{_block:'sharedContent',entry:'felles-eksempel',visibility:'hidden'}]};
  assert.throws(()=>resolveSections(twice,masters,pages,[],shared),/Duplicate shared placement/);
  const collision={...home,sections:[...home.sections,{_block:'content',id:'felles-eksempel',heading:'Collision',body:[]}]};
  assert.throws(()=>resolveSections(collision,masters,pages,[],shared),/Duplicate rendered anchor/);
});
test('featured Hero proof cannot bypass shared approval, named permission or evidence',()=>{
  const featured={...home.hero,visual:{kind:'image',image:{src:'/images/pages/example.webp',alt:'Example',positionX:50,positionY:50}},featuredProofCaseId:'documented'};
  const data={id:'documented',displayName:'Example',metric:'Verified',context:'Example',publicationApproved:true,namePermission:true,evidenceVerified:true};
  assert.throws(()=>resolveHeroProof(featured,masters,[data]),/approved proof slot/);
  const approved={...masters,proof:{type:'protected',renderKey:'proof',publicationApproved:true}};
  assert.deepEqual(resolveHeroProof(featured,approved,[data]),data);
  assert.throws(()=>resolveHeroProof(featured,approved,[{...data,evidenceVerified:false}]),/evidence/);
  assert.throws(()=>resolveHeroProof({...featured,visual:{kind:'none'}},approved,[data]),/visible image/);
});
test('single CMS section fields retain local/global rich shape, independent paragraph/card grid',()=>{
 const cms=YAML.parse(read('.pages.yml'));
 const r=cms.components;
 const local=r.builderRichLocal.fields.map(x=>x.name);
 const sharedFields=cms.content[1].items[0].fields.map(x=>x.name);
 for(const field of ['heading','body','items','links','layout','surface','headingAlign'])assert.ok(local.includes(field)&&sharedFields.includes(field),field);
 assert.ok(r.builderSections.blocks.some(x=>x.name==='sharedContent'&&x.component==='builderSharedPlacement'));
 assert.match(read('src/components/RichContentSection.astro'),/rich-paragraphs\[data-layout="three-columns"\]/);
 assert.match(read('src/components/RichContentSection.astro'),/rich-items\[data-layout="three-columns"\]/);
});

test('Sofiemyr issue #28 semantic design-system cards, Pages CMS and existing content stay compatible',()=>{
 const cms=YAML.parse(read('.pages.yml'));
 const surfaces=cms.components.richSurface.options.values.map(v=>v.name);
 for(const token of ['default','base-100','base-200','base-300','primary','secondary','accent','neutral','info','success','warning','error'])assert.ok(surfaces.includes(token),token);
 for(const token of ['base','soft','mint','lavender','dark'])assert.ok(surfaces.includes(token),'Legacy CMS value '+token);
 const richFields=cms.components.richItems.fields.map(f=>f.name);
 for(const name of ['title','badge','price','text','surface','boxVariant'])assert.ok(richFields.includes(name),name);
 const service=home.sections.find(x=>x.id==='hovedtjenester');
 assert.equal(service.items.length,6);
 assert.equal(service.items[0].badge,'Fastpris');
 assert.equal(service.items[0].price,'kr 1 450,-');
 assert.ok(service.items.every(c=>c.href && c.surface.startsWith('base-')));
 const renderer=read('src/components/RichContentSection.astro');
 for(const primitive of ['card-body','card-title','badge-primary','btn-outline','btn-primary'])assert.ok(renderer.includes(primitive),primitive);
 for(const color of ['primary','secondary','accent','neutral','info','success','warning','error'])assert.ok(renderer.includes('var(--color-'+color+'-content)'),color+' text contrast');
 assert.doesNotMatch(renderer,/String\(i\+1\)\.padStart/);
});
