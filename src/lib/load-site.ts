import { builderPageSchema, publicPath, validateSharedContentEntries, resolveSections, type GlobalMasters } from '../page-builder';
import header from '../content/site-chrome/header.json';
import footer from '../content/site-chrome/footer.json';
import appearance from '../content/site-chrome/appearance.json';
import mastersSource from '../content/global-masters.json';
import proofCasesSource from '../content/proof-cases.json';
import { heroProofCasesSchema, resolveHeroProof } from './hero-proof';
import { composeSiteChrome } from './site-chrome-content';

const entries = Object.values(import.meta.glob('../content/pages/*.json', { eager: true, import: 'default' }));
export const pages = entries.map((entry) => builderPageSchema.parse(entry));
const bySlug = new Map(pages.map(page => [page.slug, page]));
if (bySlug.size !== pages.length) throw new Error('Duplicate page slugs');
const byPath = new Set<string>();
for (const page of pages) {
  const path = publicPath(page.slug);
  if (byPath.has(path)) throw new Error('Duplicate public path: ' + path);
  byPath.add(path);
}
export const chrome = composeSiteChrome(header, footer, appearance);
export const masters = mastersSource as GlobalMasters;
export const sharedContent=validateSharedContentEntries(import.meta.glob('../content/global-content/*.json',{eager:true,import:'default'}));
export const heroProofCases=heroProofCasesSchema.parse(proofCasesSource);
for(const page of pages){
 resolveSections(page,masters,pages,[],sharedContent);
 resolveHeroProof(page.hero,masters,heroProofCases);
}
export function getPage(slug: string) {
  const page = bySlug.get(slug);
  if (!page) throw new Error('Missing page: ' + slug);
  return page;
}
