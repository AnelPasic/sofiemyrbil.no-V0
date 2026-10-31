import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { surfaceChoices, semanticSurfaces, legacySurfaces } from '../src/lib/surface-catalog.ts';
import { builderPageSchema, publicPath, resolveSections, validateSharedContentEntries, ordinaryFields } from '../src/page-builder.ts';
import { resolveHeroProof } from '../src/lib/hero-proof.ts';
import { resolveBookingHero } from '../src/lib/booking-cta.ts';
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
  assert.equal(pages.length,16);
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

test('native shared source stays reusable on service while the homepage uses focused content',()=>{
 const sections=resolveSections(service,masters,pages,[],shared);
 const reuse=sections.find(x=>x.type==='content'&&x.section.id==='felles-eksempel');
 assert.ok(reuse);
 assert.equal(reuse.section.body.length,3);
 assert.equal(reuse.section.layout,'three-columns');
 const hidden={...service,sections:service.sections.map(x=>x._block==='sharedContent'?{...x,visibility:'hidden'}:x)};
 assert.ok(!resolveSections(hidden,masters,pages,[],shared).some(x=>x.type==='content'&&x.section.id==='felles-eksempel'));
 assert.ok(!resolveSections(home,masters,pages,[],shared).some(x=>x.type==='content'&&x.section.id==='felles-eksempel'));
});
test('invalid, duplicate and colliding shared sources fail before publication',()=>{
  const source=json('src/content/global-content/felles-eksempel.json');
  assert.throws(()=>validateSharedContentEntries({'different.json':source}),/filename\/ID mismatch/);
  assert.throws(()=>validateSharedContentEntries({'priser.json':{...source,id:'priser'}}));
  assert.throws(()=>validateSharedContentEntries({'x.json':{...source,id:'x'},'y.json':{...source,id:'y'}}),/Duplicate shared content identity/);
  const missing={...home,sections:[...home.sections,{_block:'sharedContent',entry:'does-not-exist'}]};
  assert.throws(()=>resolveSections(missing,masters,pages,[],shared),/Missing shared source/);
  const twice={...home,sections:[...home.sections,{_block:'sharedContent',entry:'felles-eksempel'}, {_block:'sharedContent',entry:'felles-eksempel',visibility:'hidden'}]};
  assert.throws(()=>resolveSections(twice,masters,pages,[],shared),/Duplicate shared placement/);
  const collision={...home,sections:[...home.sections,{_block:'content',id:'hovedtjenester',heading:'Collision',body:[]}]};
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
 assert.ok(service.items.every(c=>c.href && surfaces.includes(c.surface)),'CMS-chosen service colors must be valid and links remain');
 const renderer=read('src/components/RichContentSection.astro');
 for(const primitive of ['card-body','card-title','badge-primary','btn-outline','btn-primary'])assert.ok(renderer.includes(primitive),primitive);
 for(const color of ['primary','secondary','accent','neutral','info','success','warning','error'])assert.ok(renderer.includes('var(--color-'+color+'-content)'),color+' text contrast');
 assert.doesNotMatch(renderer,/String\(i\+1\)\.padStart/);
});

test('design-system lists every Pages CMS surface and previews actual section/card renderer',()=>{
 const cms=YAML.parse(read('.pages.yml'));
 const cmsValues=cms.components.richSurface.options.values.map(item=>item.name);
 assert.deepEqual(surfaceChoices.map(surface=>surface.value),cmsValues,'Design-system catalog must not drift from CMS choices');
 assert.equal(semanticSurfaces.length,12);
 assert.equal(legacySurfaces.length,5);
 const page=read('src/pages/design-system.astro');
 assert.match(page,/Alle overflater i Pages CMS/);
 assert.match(page,/semanticSurfaces\.map/);
 assert.match(page,/legacySurfaces\.map/);
 assert.match(page,/RichContentSection section=/);
 assert.match(page,/surface: choice\.value/g);
 assert.match(page,/Light og Dark/);
 const renderer=read('src/components/RichContentSection.astro');
 for(const choice of surfaceChoices){
  assert.ok(ordinaryFields.surface.safeParse(choice.value).success,'Invalid builder surface '+choice.value);
  if(choice.value!=='default')assert.ok(renderer.includes('data-surface="'+choice.value+'"'),'No actual renderer for '+choice.value);
 }
});

test('default RichContentSection has no section framing; explicit colored surfaces keep it',()=>{
 const component=read('src/components/RichContentSection.astro');
 assert.match(component,/\.mws-rich-section\{padding:0;border:0;border-radius:0;background:transparent;color:var\(--rich-fg\);\}/);
 assert.match(component,/\.mws-rich-section:not\(\[data-surface="default"\]\)\{padding:clamp\(2rem,4vw,3\.5rem\);border-radius:var\(--radius-box,1rem\);background:var\(--rich-bg\);border:1px solid var\(--color-base-300\);\}/);
 assert.match(component,/\.rich-card\.card\{[^\n]*background:var\(--rich-bg\)/,'Card backgrounds remain independent of section');
 const noSurface=home.sections.find(x=>x.id==='hovedtjenester');
 assert.ok(noSurface,'Homepage section remains CMS-controlled');
});

test('desktop Pagefind search button is centered and unboxed like the Oslo reference',()=>{
 const css=read('src/styles/site-chrome.css');
 const start=css.indexOf('/* Match the accepted Oslo icon-only action:');
 const end=css.indexOf('.mws-chrome-search:focus-visible',start);
 assert.ok(start>=0 && end>start,'Desktop-only Pagefind override is missing');
 const rule=css.slice(start,end);
 assert.match(rule,/pagefind-modal-trigger\.mws-chrome-search--desktop \.pf-trigger-btn/);
 for(const declaration of [
  'align-items: center !important','justify-content: center !important',
  'width: 44px !important','height: 44px !important',
  'padding: 0 !important','border: 0 !important',
  'background: transparent !important',
 ])assert.ok(rule.includes(declaration),'Missing centered icon-button style: '+declaration);
 assert.match(rule,/pagefind-modal-trigger\.mws-chrome-search--desktop :is\(\.pf-trigger-icon, \.trigger-icon\)/);
 assert.ok(css.includes('--pf-background: transparent;'));
 assert.ok(css.includes('--pf-border: transparent;'));
});

test('booking form uses Global Innhold and reuses one CMS source across pages',()=>{
 const cms=YAML.parse(read('.pages.yml'));
 const globalGroup=cms.content.find(x=>x.name==='globalContentGroup');
 const collection=globalGroup.items.find(x=>x.name==='sharedContent');
 const widget=collection.fields.find(x=>x.name==='widget');
 assert.ok(widget,'Global Innhold must expose a form type');
 assert.deepEqual(widget.options.values.map(x=>x.name),['content','bookingForm']);
 assert.equal(cms.components.builderSharedPlacement.fields[0].options.collection,'sharedContent');
 const booking=json('src/content/global-content/bestilling-skjema.json');
 assert.equal(booking.widget,'bookingForm');
 assert.equal(booking.id,'bestilling-skjema');
 assert.equal(shared['bestilling-skjema'].heading,booking.heading);
 const widgetValues=['content','bookingForm'];
 for(const widget of widgetValues){
  const parsed=validateSharedContentEntries({'test.json':{...booking,id:'test',widget}});
  assert.equal(parsed.test.widget,widget);
 }
 assert.throws(()=>validateSharedContentEntries({'test.json':{...booking,id:'test',widget:'unknown'}}));
 const secondary={...shared['bestilling-skjema'],id:'booking-alt'};
 const duplicated={...pages.find(x=>x.slug==='bestilling'),sections:[
  {_block:'sharedContent',entry:'bestilling-skjema'},
  {_block:'sharedContent',entry:'booking-alt'},
 ]};
 assert.throws(()=>resolveSections(duplicated,masters,pages,[],{...shared,'booking-alt':secondary}),/Only one booking form/);
 for(const slug of ['bestilling','kontakt']){
  const page=pages.find(x=>x.slug===slug);
  const placed=page.sections.filter(s=>s._block==='sharedContent'&&s.entry==='bestilling-skjema');
  assert.equal(placed.length,1,'One shared form reference on '+slug);
  const sections=resolveSections(page,masters,pages,[],shared);
  assert.equal(sections.filter(s=>s.type==='content'&&'widget' in s.section&&s.section.widget==='bookingForm').length,1);
 }
 const otherwiseUnconfigured=pages.find(page=>page.slug==='om');
 assert.ok(otherwiseUnconfigured,'Example page exists');
 const placedElsewhere={...otherwiseUnconfigured,sections:[...otherwiseUnconfigured.sections.filter(s=>s._block!=='sharedContent'||s.entry!=='bestilling-skjema'),{_block:'sharedContent',entry:'bestilling-skjema'}]};
 assert.equal(resolveSections(placedElsewhere,masters,pages,[],shared).filter(s=>s.type==='content'&&'widget' in s.section&&s.section.widget==='bookingForm').length,1,'Form may be placed anywhere through CMS');
 assert.doesNotMatch(read('src/components/PageView.astro'),/BookingForm/,'Hardcoded booking form removed');
 assert.match(read('src/components/PageSections.astro'),/item\.section\.widget === 'bookingForm'/);
 const form=read('src/components/BookingForm.astro');
 assert.match(form,/data-booking-unavailable/,'No-backend status visible');
 assert.match(form,/data-booking-submit disabled/,'Submit remains disabled in raw HTML until JS and approved endpoint are ready');
 assert.match(form,/PUBLIC_LEAD_ENDPOINT/,'Frontend endpoint must be explicit');
 assert.match(form,/PUBLIC_LEADS_ENABLED/,'Owner-controlled switch must gate real requests');
 assert.match(form,/receipt_status !== 'stored'/,'Success needs a durable D1 acknowledgement');
 assert.doesNotMatch(form,/Vi har mottatt opplysningene/,'Cannot claim a request was received');
 assert.match(form,/method="post" action="\/bestilling\/"/,'No GET submission with personal data');
 assert.match(form,/event\.preventDefault\(\)/,'Implicit Enter submit is blocked without a backend');
 assert.doesNotMatch(form,/Takk for din bestillingsforespørsel/,'No fake success message');
});


test('dedicated services have distinct SEO, CMS paths, links and one reusable booking form',()=>{
 const slugs=['service','diagnose','reparasjoner','bobilservice','flateavtale'];
 const cms=YAML.parse(read('.pages.yml'));
 const paths=new Set(pages.map(p=>publicPath(p.slug)));
 const seenSeo=new Set();
 const sharedRefs=new Set();
 for(const slug of slugs){
  const page=pages.find(p=>p.slug===slug);
  assert.ok(page,'Missing service page: '+slug);
  assert.equal(page.kind,'service');
  assert.ok(page.seo.title.includes('Sofiemyr Bil'));
  assert.ok(page.seo.description.length>=90 && page.seo.description.length<=170,'SEO description length: '+slug);
  assert.ok(!seenSeo.has(page.seo.title),'SEO title duplicated: '+slug);
  seenSeo.add(page.seo.title);
  assert.equal(page.hero.primaryCta?.href,'/bestilling/');
  assert.equal(page.faq.length,3,'No useful FAQ on '+slug);
  const component=resolveSections(page,masters,pages,[],shared);
  const widget=component.filter(x=>x.type==='content' && 'widget' in x.section && x.section.widget==='bookingForm');
  assert.equal(widget.length,1,'Exactly one global booking form on '+slug);
  const regular=page.sections.filter(x=>x._block==='content');
  assert.ok(regular.length>=2,'At least two unique content sections on '+slug);
  for(const sec of regular){
   assert.ok(sec.body.length>=1 && sec.items?.length>=2);
   for(const card of sec.items){
    if(card.href?.startsWith('/'))assert.ok(paths.has(card.href),'Broken card href '+card.href+' on '+slug);
   }
   for(const link of sec.links??[])assert.ok(paths.has(new URL(link.href,'https://sofiemyrbil.no').pathname),'Broken CTA '+link.href+' on '+slug);
  }
  assert.ok(paths.has(page.hero.secondaryCta?.href));
  const editor=cms.content.find(x=>x.path==='src/content/pages/'+slug+'.json');
  assert.ok(editor,'Missing native Pages CMS editor '+slug);
  assert.deepEqual(editor.fields.map(f=>f.name),['slug','seo','hero','sections','faq','listing','kind']);
  sharedRefs.add(widget[0].section.id);
 }
 assert.deepEqual([...sharedRefs],['bestilling-skjema']);
 const hub=pages.find(p=>p.slug==='tjeneste');
 const linkSet=new Set(hub.sections.filter(s=>s._block==='content').flatMap(s=>
   [...(s.items??[]).map(c=>c.href),...(s.links??[]).map(l=>l.href)]));
 for(const slug of slugs)assert.ok(linkSet.has('/'+slug+'/'),'Service hub missing '+slug);
 assert.ok(linkSet.has('/eu-kontroll/'));
 assert.ok(resolveSections(hub,masters,pages,[],shared).some(s=>s.type==='content' &&
   'widget' in s.section && s.section.widget==='bookingForm'),'Hub has booking form');
 // Header and brand navigation belong to the parallel homepage PR.
 // The existing Tjenester link reaches our hub; footer exposes each destination directly.
 const menu=chrome.navigation.find(n=>n.id==='tjenester');
 assert.equal(menu?.kind,'dropdown');
 assert.equal(menu.href,'/tjeneste/');
 const foot=new Set(chrome.footer.groups.flatMap(g=>g.links.map(l=>l.href)));
 for(const slug of slugs)assert.ok(foot.has('/'+slug+'/'),'Footer missing '+slug);
});

test('Sofiemyr homepage emphasizes Ford without excluding other brands and uses real brand images',()=>{
 const h=home.hero;
 assert.match(h.title,/Ford/);
 assert.match(h.title,/Alle bilmerker/);
 assert.equal(h.primaryCta.href,'/bestilling/');
 assert.equal(h.secondaryCta.href,'/eu-kontroll/');
 assert.match(h.support,/1 450/);
 assert.match(home.seo.description,/Ford/);
 const header=json('src/content/site-chrome/header.json');
 assert.equal(header.brand.name,'Sofiemyr Bil');
 assert.ok(!header.brand.name.includes('AS'));
 for(const asset of [header.logoLight,header.logoDark,'/images/brands/ford.svg']){
   assert.ok(asset.startsWith('/images/brands/'));
   assert.ok(existsSync(join(root,'public'+asset)),'Missing brand asset '+asset);
 }
 const heroMarkup=read('src/components/Hero.astro');
 assert.match(heroMarkup,/isHome && <aside class="mws-home-ford-note"/);
 assert.match(heroMarkup,/Ford-kompetanse/);
 assert.match(heroMarkup,/Follo Autoco/);
 const sections=resolveSections(home,masters,pages,[],shared);
 assert.equal(home.sections.filter(s=>s._block==='content').length,2,'Avoid duplicate pre-form CTAs');
 assert.equal(home.sections.filter(s=>s._block==='sharedContent'&&s.entry==='bestilling-skjema').length,1);
 assert.equal(home.sections.filter(s=>s._block==='sharedContent'&&s.entry==='felles-eksempel').length,0);
 const services=home.sections.find(x=>x.id==='hovedtjenester');
 assert.equal(services.items.length,6);
 assert.ok(services.items.every(x=>x.href && x.href.startsWith('/')));
 assert.ok(services.items.some(x=>/Ford/.test(x.badge??'')));
 const why=home.sections.find(x=>x.id==='hvorfor-sofiemyr-bil');
 assert.ok(why.items.some(x=>x.text.includes('Follo Autoco AS')));
 assert.ok(sections.some(x=>x.type==='content'&&'widget' in x.section&&x.section.widget==='bookingForm'));
});

test('Ford workshop landing targets relevant intent without inventing Ford brand authorization',()=>{
 const page=pages.find(x=>x.slug==='ford-verksted');
 assert.ok(page);
 assert.match(page.hero.title,/Ford-verksted/);
 assert.match(page.hero.title,/andre bilmerker/);
 assert.match(page.seo.title,/Ford-verksted Kolbotn/);
 assert.equal(page.hero.primaryCta.href,'/bestilling/');
 assert.ok(page.faq.some(q=>/autorisert Ford-verksted/.test(q.question)));
 assert.ok(!page.hero.support.includes('Ford-autorisert'));
 assert.ok(!page.seo.description.includes('Ford-autorisert'));
 const menu=chrome.navigation.find(x=>x.id==='tjenester');
 assert.ok(menu.kind==='dropdown'&&menu.links.some(x=>x.href==='/ford-verksted/'));
 assert.ok(chrome.footer.groups.some(g=>g.links.some(l=>l.href==='/ford-verksted/')));
 const homeFord=home.sections.find(x=>x.id==='hvorfor-sofiemyr-bil').items[0];
 assert.equal(homeFord.href,'/ford-verksted/');
 const s=pages.find(x=>x.slug==='service').sections.find(x=>x.id==='service-omfang');
 assert.ok(s.links.some(x=>x.href==='/ford-verksted/'));
 assert.ok(resolveSections(page,masters,pages,[],shared).some(x=>x.type==='content'&&'widget' in x.section&&x.section.widget==='bookingForm'));
 assert.ok(read('.pages.yml').includes('src/content/pages/ford-verksted.json'));
 const faq=home.faq.find(x=>x.question.includes('bobil'));
 assert.match(faq.answer,/bobil/);
});

test('EU-kontroll price CTA goes straight to the booking form and preselects that service',()=>{
 const ford=pages.find(page=>page.slug==='ford-verksted');
 const cta=ford.sections.flatMap(section=>section.links??[]).find(link=>link.label.startsWith('Bestill EU-kontroll'));
 assert.ok(cta,'Ford landing must have a conversion CTA');
 assert.equal(cta.label,'Bestill EU-kontroll – kr 1 450,-');
 const target=new URL(cta.href,'https://sofiemyrbil.no');
 assert.equal(target.pathname,'/bestilling/');
 assert.equal(target.searchParams.get('tjeneste'),'eu-kontroll');
 const booking=read('src/components/BookingForm.astro');
 assert.match(booking,/new URLSearchParams\(window\.location\.search\)\.get\('tjeneste'\) === 'eu-kontroll'/);
 assert.match(booking,/input\[name="services"\]\[value="EU-Kontroll"\]/);
 assert.match(booking,/euControl\.checked = true/);
});

test('service CTAs target the first visible booking section and never a hidden anchor',()=>{
 const slugs=['service','diagnose','reparasjoner','bobilservice','flateavtale','tjeneste','eu-kontroll','ford-verksted'];
 for(const slug of slugs){
  const page=pages.find(p=>p.slug===slug);
  assert.ok(page,'Missing service page: '+slug);
  assert.equal(page.kind,'service');
  assert.equal(page.sections[0]._block,'sharedContent','Booking must be the first section after hero: '+slug);
  assert.equal(page.sections[0].entry,'bestilling-skjema');
  assert.equal(page.sections[0].visibility,'visible');
  const visible=resolveSections(page,masters,pages,[],shared);
  assert.equal(visible[0].type,'content','First resolved section must render form on '+slug);
  assert.equal(visible[0].section.widget,'bookingForm','First visible section must be the booking widget on '+slug);
  assert.deepEqual(resolveBookingHero(page,shared).primaryCta,
   {label:'Bestill time',href:'#bestilling-skjema'},'Visible booking should receive a local hero CTA: '+slug);
  assert.deepEqual(page.hero.primaryCta,
   {label:'Bestill time',href:'/bestilling/'},'CMS should retain safe external fallback: '+slug);
  const hidden={...page,sections:page.sections.map(section=>section._block==='sharedContent' &&
   section.entry==='bestilling-skjema'?{...section,visibility:'hidden'}:section)};
  assert.deepEqual(resolveBookingHero(hidden,shared).primaryCta,
   {label:'Bestill time',href:'/bestilling/'},'Hidden booking must not create dead anchor on '+slug);
  const removed={...page,sections:page.sections.filter(section=>section._block!=='sharedContent' ||
   section.entry!=='bestilling-skjema')};
  assert.deepEqual(resolveBookingHero(removed,shared).primaryCta,
   {label:'Bestill time',href:'/bestilling/'},'Removed booking must fall back on '+slug);
 }
 // The homepage is owned by the parallel thread and must retain its exact current hero.
 assert.equal(resolveBookingHero(home,shared),home.hero);
 assert.equal(home.hero.primaryCta.href,'/bestilling/');
 const view=read('src/components/PageView.astro');
 assert.match(view,/resolveBookingHero\(page,sharedContent\)/);
 assert.match(view,/<Hero hero=\{hero\}/);
 assert.match(read('src/components/BookingForm.astro'),/<section id="bestilling-skjema"/);
});


test('removes footer source-measurement choice without disrupting booking and anonymous hit counts',()=>{
 const layout=read('src/components/BaseLayout.astro');
 assert.match(layout,/<Attribution \/>/);
 assert.doesNotMatch(layout,/<Attribution showChoice/);
 assert.match(layout,/sofiemyr_attribution_permission=; Max-Age=0/,'Previously granted choice cookie is retired');
 const site=json('lead-intake/site.config.json');
 assert.equal(site.attribution.mode,'off');
 const client=read('lead-intake/frontend-config.mjs');
 assert.match(client,/"ATTRIBUTION_MODE": "off"/);
 assert.match(client,/"HITCOUNT_ENABLED": "true"/,'Anonymous page counts remain on');
 const privacy=json('src/content/pages/personvern.json');
 const section=privacy.sections.find(x=>x.id==='informasjonskapsler');
 assert.equal(section.heading,'Sidevisninger og statistikk');
 assert.ok(!section.body.includes('Valg for kildemåling'));
 assert.ok(!section.body.includes('Du kan endre valget nederst på siden'));
 const booking=read('src/components/BookingForm.astro');
 assert.match(booking,/submitLead\(payload/,'Booking delivery stays connected');
});
