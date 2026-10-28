import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const flag = process.argv.includes('--write') ? '--write' : '--check';
const option = name => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index+1];
};
const base = fileURLToPath(new URL('../', import.meta.url));
const pagesDir = resolve(option('--pages') ?? join(base, 'templates/pages'));
const configPath = resolve(option('--config') ?? join(base, 'templates/PAGES-CMS-PAGE-BUILDER.yml'));
const paths = readdirSync(pagesDir).filter(name => name.endsWith('.json'));
const pages = paths.map(name => JSON.parse(readFileSync(join(pagesDir,name),'utf8')));
for(const page of pages) {
  if (typeof page.slug !== 'string' || !/^(?:home|[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?)$/.test(page.slug) || !page.seo?.title)
    throw new Error('Missing valid canonical slug/SEO title in page JSON');
}
if(new Set(pages.map(x=>x.slug)).size !== pages.length) throw new Error('Duplicate route slugs');
pages.sort((a,b)=>a.slug.localeCompare(b.slug,'nb'));
const template = readFileSync(configPath,'utf8');
const start = '# PAGE_BUILDER_CHOICES_BEGIN', end = '# PAGE_BUILDER_CHOICES_END';
if(template.split(start).length !== 2 || template.split(end).length !== 2) throw new Error('PageList markers missing or duplicated');
const rows = pages.map(page=>'        - { name: ' + JSON.stringify(page.slug) + ', label: ' + JSON.stringify(page.seo.title) + ' }').join('\n');
const pattern = new RegExp('('+start+'\\n)[\\s\\S]*?(\\n'+end+')');
if (!pattern.test(template)) throw new Error('Invalid select markers');
const expected = template.replace(pattern,(_,a,b)=>a+rows+b);
if(flag === '--write') {
  if(expected !== template) writeFileSync(configPath,expected);
  process.stdout.write('Updated ' + pages.length + ' canonical PageList page choices\n');
}else if(expected !== template) {
  process.stderr.write('PageList select is stale; run npm run sync:choices\n');
  process.exitCode = 1;
}else process.stdout.write('PageList select is current ('+pages.length+')\n');
