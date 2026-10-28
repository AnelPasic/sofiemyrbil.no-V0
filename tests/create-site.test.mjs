import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

const script=fileURLToPath(new URL('../scripts/create-site.mjs',import.meta.url));
function exportSite(args){return execFileSync(process.execPath,[script,...args],{encoding:'utf8',timeout:20000});}
test('standalone root export rebrands all demo page titles, keeps CMS references and never overwrites',()=>{
 const root=mkdtempSync(join(tmpdir(),'mws-export-test-'));
 try{
  const target=join(root,'my-test');
  const output=exportSite(['--target',target,'--brand','Nytt Verksted']);
  assert.match(output,/CREATED/);
  for(const name of ['package.json','.pages.yml','AGENTS.md','src/pages/index.astro'])assert.ok(existsSync(join(target,name)));
  assert.ok(!existsSync(join(target,'node_modules')));
  const header=JSON.parse(readFileSync(join(target,'src/content/site-chrome/header.json'),'utf8'));
  const home=JSON.parse(readFileSync(join(target,'src/content/pages/home.json'),'utf8'));
  assert.equal(header.brand.name,'Nytt Verksted');
  assert.match(home.seo.title,/Nytt Verksted/);
  assert.ok(!home.seo.title.includes('Eksempelbedrift'));
  const cms=YAML.parseDocument(readFileSync(join(target,'.pages.yml'),'utf8'),{uniqueKeys:true});
  assert.equal(cms.errors.length,0);
  const config=cms.toJS();
  const group=config.content.find(x=>x.name==='globalContentGroup');
  assert.equal(group.items[0].type,'collection');
  assert.equal(group.items[0].path,'src/content/global-content');
  assert.equal(config.components.builderSharedPlacement.fields[0].options.collection,'sharedContent');
  for(const editor of config.content.filter(x=>x.type==='file'))assert.ok(existsSync(join(target,editor.path)),editor.path);
  assert.throws(()=>exportSite(['--target',target,'--brand','Overwrite']),/Command failed|EEXIST/);
  assert.equal(JSON.parse(readFileSync(join(target,'src/content/site-chrome/header.json'),'utf8')).brand.name,'Nytt Verksted');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('export refuses unsafe source overlap and preserves existing files',()=>{
 const root=mkdtempSync(join(tmpdir(),'mws-export-guard-'));
 try{
  const existing=join(root,'filled');
  mkdirSync(existing);
  writeFileSync(join(existing,'important.txt'),'NO OVERWRITE');
  assert.throws(()=>exportSite(['--target',existing]),/Command failed|EEXIST/);
  assert.equal(readFileSync(join(existing,'important.txt'),'utf8'),'NO OVERWRITE');
  assert.throws(()=>exportSite(['--target',fileURLToPath(new URL('../',import.meta.url))]),/Command failed|EEXIST/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
