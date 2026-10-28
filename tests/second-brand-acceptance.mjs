/**
 * MWS-052 checkpoint 4: isolated SECOND BRAND porting test.
 *
 * This is intentionally NOT an authenticated Pages CMS session.
 * It models the same JSON→Git commit→build→reopen→revert data path,
 * using a disposable git checkout at the website root; never touches
 * the pilot, the shared starter's own content, or any real customer.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,symlinkSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import YAML from 'yaml';
import {chromium} from 'playwright';

const source=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sandbox=mkdtempSync(join(tmpdir(),'mws-second-brand-'));
const evidence=process.env.MWS_EVIDENCE_DIR||join(sandbox,'evidence');
const origin='http://127.0.0.1:4387';
const baseBrand='SykkelLab Demo';
const shareId='verksted-rad';
let child,browser;

const own=(path)=>join(sandbox,path);
const from=(path)=>join(source,path);
const read=(path)=>readFileSync(own(path),'utf8');
const readJson=(path)=>JSON.parse(read(path));
const writeJson=(path,data)=>writeFileSync(own(path),JSON.stringify(data,null,2)+'\n');
const run=(command,args,cwd=sandbox,env={})=>execFileSync(command,args,{
 cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180_000,
 env:{...process.env,SITE_URL:'https://sykkellab.invalid',...env},
});
function ensure(statement,reason){assert.ok(statement,reason);}
function inspectBuild(expected){
 const html=read('dist/index.html');
 const service=read('dist/tjeneste/index.html');
 const notFound=read('dist/404.html');
 for(const [name,doc] of [['home',html],['service',service],['404',notFound]]){
  ensure(/<meta name="robots" content="noindex,nofollow"/.test(doc),name+' is not noindex');
  ensure(doc.includes(baseBrand),name+' does not show second brand');
  ensure(!doc.includes('Eksempelbedrift')&&!doc.includes('Optimalisering Oslo'),name+' leaks another brand');
 }
 ensure(html.includes(expected)&&service.includes(expected),'shared content must render on both routes');
 for(const dir of ['kontakt','om','priser','innsikt/artikkel']){
  ensure(existsSync(own('dist/'+dir+'/index.html')),'missing route '+dir);
  ensure(read('dist/'+dir+'/index.html').includes('noindex,nofollow'),'indexed '+dir);
 }
}
async function awaitPreview(){
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw new Error('Astro preview terminated early: '+child.exitCode);
  try {const res=await fetch(origin+'/');if(res.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Preview did not start on '+origin);
}
async function inspectBrowser(expected){
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const desktop=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'light'});
 await desktop.goto(origin+'/',{waitUntil:'networkidle'});
 ensure(await desktop.locator('header').getByText(baseBrand).isVisible(),'desktop header brand');
 ensure(await desktop.locator('section#'+shareId).getByRole('heading',{name:expected}).isVisible(),'desktop shared section');
 ensure(await desktop.locator('meta[name="robots"]').getAttribute('content')==='noindex,nofollow','desktop robots');
 const desktopGrid=await desktop.locator('#'+shareId+' .rich-paragraphs').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 const desktopCards=await desktop.locator('#'+shareId+' .rich-items').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 assert.equal(desktopGrid,3,'desktop paragraphs must be three columns');
 assert.equal(desktopCards,3,'desktop cards must be three columns');
 ensure(await desktop.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'desktop horizontal overflow');
 mkdirSync(evidence,{recursive:true});
 await desktop.screenshot({path:join(evidence,'sykkellab-desktop.png'),fullPage:true});
 await desktop.goto(origin+'/tjeneste/',{waitUntil:'networkidle'});
 ensure(await desktop.locator('#'+shareId).getByRole('heading',{name:expected}).isVisible(),'second route shares content');
 await desktop.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,colorScheme:'light'});
 await mobile.goto(origin+'/',{waitUntil:'networkidle'});
 ensure(await mobile.locator('header').getByText(baseBrand).isVisible(),'mobile brand');
 ensure(await mobile.locator('#'+shareId).getByRole('heading',{name:expected}).isVisible(),'mobile global section');
 const mobileGrid=await mobile.locator('#'+shareId+' .rich-paragraphs').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 const mobileCards=await mobile.locator('#'+shareId+' .rich-items').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 assert.equal(mobileGrid,1,'mobile paragraphs must stack');
 assert.equal(mobileCards,1,'mobile cards must stack');
 ensure(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'mobile horizontal overflow');
 const menu=mobile.locator('[data-mws-mobile-toggle]');
 ensure(await menu.isVisible(),'mobile nav toggle not visible');
 await menu.click();
 ensure(await menu.getAttribute('aria-expanded')==='true','mobile navigation did not open');
 ensure(await mobile.locator('[data-mws-mobile-nav]').isVisible(),'mobile navigation panel hidden');
 ensure(await mobile.locator('[data-mws-mobile-nav] .mws-chrome-mobile-panel-cta').isVisible(),'CTA must remain reachable inside mobile menu');
 await mobile.screenshot({path:join(evidence,'sykkellab-mobile-menu.png'),fullPage:true});
 await mobile.close();
 await browser.close();browser=undefined;
 console.log('PASS browser: desktop 3-column paragraphs/cards, mobile stacking + nav, no overflow, 2 shared routes, screenshots');
}
async function main(){
 try{
  for(const item of ['astro.config.mjs','package.json','tsconfig.json','.pages.yml','.gitignore','src','scripts','coordination'])
   cpSync(from(item),own(item),{recursive:true});
  if(existsSync(from('public')))cpSync(from('public'),own('public'),{recursive:true});
  symlinkSync(from('node_modules'),own('node_modules'),'dir');
  // Different website and different id/UUID: NO parent project's URL or owned data.
  const header=readJson('src/content/site-chrome/header.json');
  header.brand.name=baseBrand;
  header.navigation[0].label='Sykkelservice';
  header.primaryCta={label:'Kontakt verkstedet (demo)',href:'/kontakt/',variant:'primary'};
  writeJson('src/content/site-chrome/header.json',header);
  const footer=readJson('src/content/site-chrome/footer.json');
  footer.footer.copyright=baseBrand;
  footer.footer.about='Fiktivt sykkelverksted laget for en isolert teknisk test. Ingen ekte tjenester eller avtaler.';
  footer.footer.note='TESTNETTSTED – ikke et virksomhetstilbud.';
  writeJson('src/content/site-chrome/footer.json',footer);
  const appearance=readJson('src/content/site-chrome/appearance.json');
  appearance.themes.lightCss=appearance.themes.lightCss.replace('sample-light','sykkellab-light').replace('oklch(40% 0.13 159)','oklch(48% 0.14 247)');
  appearance.themes.darkCss=appearance.themes.darkCss.replace('sample-dark','sykkellab-dark').replace('oklch(75% 0.17 157)','oklch(77% 0.15 250)');
  writeJson('src/content/site-chrome/appearance.json',appearance);
  for(const file of readdirSync(own('src/content/pages')).filter(x=>x.endsWith('.json'))){
   const data=readJson('src/content/pages/'+file);
   data.seo.title=data.seo.title.replaceAll('Eksempelbedrift',baseBrand);
   data.seo.description='Fiktivt innhold for '+baseBrand+' – ikke et ekte virksomhetstilbud.';
   if(data.slug==='home'){
    data.hero.title='Sykkelen klar til neste tur.';
    data.hero.support='Dette er et teknisk testnettsted for en oppdiktet sykkelservice.';
   }
   if(data.slug==='tjeneste'){
    data.hero.title='Service uten unødvendig venting (demo)';
    data.hero.support='Eksempel på en tjenesteside i en annen bransje.';
   }
   for(const section of data.sections)if(section._block==='sharedContent'&&section.entry==='felles-eksempel')section.entry=shareId;
   writeJson('src/content/pages/'+file,data);
  }
  const sourcePath='src/content/global-content/felles-eksempel.json';
  const renamed='src/content/global-content/'+shareId+'.json';
  const shared=readJson(sourcePath);
  shared.id=shareId;shared.name='Sykkelvedlikehold';shared.uid='aa301f6d-1bb6-49c1-92ed-519b2d8ecdd3';
  shared.heading='Sykkelservice for alle typer turer';
  shared.body=['Dette er demonstrasjonsinnhold.','Kun for en uavhengig nettstedtest.','Ingen dokumenterte kundeløfter.'];
  shared.items=[{title:'Råd',text:'Eksempeltekst for service.',surface:'mint',boxVariant:'plain'},
    {title:'Tilsyn',text:'Eksempeltekst for vedlikehold.',surface:'lavender',boxVariant:'card'},
    {title:'Kontroll',text:'Eksempeltekst for sikkerhetskontroll.',surface:'base',boxVariant:'plain'}];
  writeJson(renamed,shared);rmSync(own(sourcePath));
  const yaml=YAML.parseDocument(read('.pages.yml'),{uniqueKeys:true});
  assert.equal(yaml.errors.length,0,'Invalid CMS YAML in isolated project');
  const cms=yaml.toJS();
  ensure(cms.content[1].items.some(x=>x.name==='sharedContent'&&x.type==='collection'),'Native CMS collection missing');
  ensure(cms.components.builderSharedPlacement.fields[0].options.collection==='sharedContent','Reference binding lost');
  for(const editor of cms.content.slice(3))ensure(existsSync(own(editor.path)),'CMS editor path incorrect at repo root: '+editor.path);
  // Same repository-root layout Pages CMS expects; this is a dry-run of editor JSON commits, NOT Pages CMS login.
  run('git',['init','-q']);
  run('git',['config','user.email','acceptance@example.invalid']);
  run('git',['config','user.name','Second-brand CI fixture']);
  run('git',['add','.']);
  run('git',['commit','-qm','baseline: isolated SykkelLab Demo']);
  const baseContent=read(renamed);
  shared.heading='Vedlikeholdsråd – bekreftet etter Git-lagring';
  shared.body[0]='Oppdatert i testens redigeringsrunde.';
  writeJson(renamed,shared);
  run('git',['add',renamed]);
  run('git',['commit','-qm','simulated CMS edit: change shared content source']);
  ensure(run('git',['show','HEAD:'+renamed]).includes(shared.heading),'Git commit did not save edited content');
  const reloaded=readJson(renamed);
  assert.equal(reloaded.heading,shared.heading,'Reopen did not preserve edited value');
  run('npm',['run','build']);
  inspectBuild(shared.heading);
  child=spawn(join(source,'node_modules','.bin','astro'),['preview','--host','127.0.0.1','--port','4387'],{cwd:sandbox,env:{...process.env,SITE_URL:'https://sykkellab.invalid'},stdio:'ignore'});
  await awaitPreview();
  await inspectBrowser(shared.heading);
  child.kill('SIGTERM');child=undefined;
  run('git',['revert','--no-edit','HEAD']);
  ensure(read(renamed)===baseContent,'Revert did not restore original content exactly');
  run('npm',['run','build']);
  inspectBuild('Sykkelservice for alle typer turer');
  ensure(!read('dist/index.html').includes(shared.heading),'Edited content persists after revert');
  ensure(run('git',['status','--porcelain']).trim()==='','Fixture git worktree not clean after revert');
  console.log('PASS second brand: independent root install, CMS config paths, distinct theme/brand/IDs, save/commit/reopen/revert, 7 noindex routes');
 }finally{
  if(browser)await browser.close().catch(()=>{});
  if(child)child.kill('SIGTERM');
  rmSync(sandbox,{recursive:true,force:true,maxRetries:3,retryDelay:250});
 }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
