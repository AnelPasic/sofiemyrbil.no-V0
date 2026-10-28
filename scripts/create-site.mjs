#!/usr/bin/env node
/**
 * Safely export a standalone, brand-neutral copy of starter/astro as a site
 * repository ROOT. No overwrite, no GitHub actions, no CMS credentials.
 */
import {cpSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const source=resolve(fileURLToPath(new URL('../',import.meta.url)));
const flag=name=>{
 const index=process.argv.indexOf(name);
 return index<0?undefined:process.argv[index+1];
};
const targetArg=flag('--target');
const brand=(flag('--brand')??'Testverksted Demo').trim();
const inside=(child,parent)=>{const rel=relative(parent,child);return child===parent||(!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep)&&!/^[a-zA-Z]:/.test(rel));};
if(!targetArg||targetArg.startsWith('--'))throw new Error('Usage: node starter/astro/scripts/create-site.mjs --target ../new-site --brand "Testverksted Demo"');
if(!brand||brand.length>80||/[<>&\r\n\u0000-\u001f]/.test(brand))throw new Error('Invalid brand name; choose 1–80 normal printable characters.');
const destination=resolve(process.cwd(),targetArg);
if(inside(destination,source)||inside(source,destination))throw new Error('Target must be outside the starter source tree and must not contain it.');
if(existsSync(destination))throw new Error('Target already exists. Choose a NEW directory; never overwrite.');
mkdirSync(dirname(destination),{recursive:true});
const staging=mkdtempSync(join(dirname(destination),'.mws-export-'));
const exclude=new Set(['node_modules','dist','.astro','.git','test-evidence','.DS_Store']);
function permitted(path){
 const rel=relative(source,path);
 if(!rel)return true;
 if(rel.split(sep).some(part=>exclude.has(part)||part==='.env'||part.startsWith('.env.')))return false;
 return !lstatSync(path).isSymbolicLink();
}
function rebrand(value){
 const currentBrand=JSON.parse(readFileSync(join(source,'src/content/site-chrome/header.json'),'utf8')).brand?.name||'Eksempelbedrift';
 if(typeof value==='string')return value.replaceAll('Eksempelbedrift',brand).replaceAll(currentBrand,brand);
 if(Array.isArray(value))return value.map(rebrand);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rebrand(v)]));
 return value;
}
function jsonFiles(directory){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const item=join(directory,entry.name);
  return entry.isDirectory()?jsonFiles(item):entry.isFile()&&entry.name.endsWith('.json')?[item]:[];
 });
}
let committed=false;
try{
 cpSync(source,staging,{recursive:true,filter:permitted});
 for(const file of jsonFiles(join(staging,'src','content'))){
  const content=JSON.parse(readFileSync(file,'utf8'));
  writeFileSync(file,JSON.stringify(rebrand(content),null,2)+'\n');
 }
 // Pages CMS reference select labels must reflect rebranded page titles.
 execFileSync(process.execPath,['scripts/sync-page-options.mjs','--pages','src/content/pages','--config','.pages.yml','--write'],{cwd:staging,stdio:'pipe'});
 for(const item of ['package.json','.pages.yml','AGENTS.md','src/pages/index.astro'])if(!existsSync(join(staging,item)))throw new Error('Export incomplete: '+item);
 if(existsSync(destination))throw new Error('Target appeared during export; refusing overwrite');
 renameSync(staging,destination);committed=true;
 process.stdout.write('CREATED '+destination+'\nBrand: '+brand+'\nNext: cd "'+destination+'" && npm install && npm run verify && npm run dev\n');
}finally{if(!committed)rmSync(staging,{recursive:true,force:true});}
