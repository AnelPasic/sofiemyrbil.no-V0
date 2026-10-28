import { z } from 'astro/zod';

const slug = z.string().regex(/^(?:home|[a-z0-9]+(?:[a-z0-9/-]*[a-z0-9])?)$/).refine(value => !value.includes('//'));
const anchor = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const internalHref = z.string().regex(/^\/(?![\/\\])[^<>"\s]*$/);
const safeHref = z.string().trim().min(1).refine(value => {
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\');
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Root-relative or HTTP(S) URLs only');

export const faqItemSchema = z.object({ question: text, answer: text }).strict();
export const listingVisualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('icon'), icon: z.enum(['search', 'conversion', 'analytics', 'trend', 'page', 'route']) }).strict(),
  z.object({
    kind: z.literal('image'),
    src: z.string().regex(/^\/images\/listing\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g|avif)$/),
    alt: text,
    positionX: z.number().min(0).max(100).default(50),
    positionY: z.number().min(0).max(100).default(50),
  }).strict(),
]);
export type ListingVisual = Exclude<z.infer<typeof listingVisualSchema>, { kind: 'none' }>;
const listingVisualField = z.union([listingVisualSchema, z.array(listingVisualSchema).max(1)])
  .optional().transform(value => Array.isArray(value) ? value[0] : value);
export const listingMetadataSchema = z.object({
  title: text.optional(), summary: text.optional(), label: text.optional(),
  order: z.number().int().optional(), visible: z.boolean().default(true),
  visual: listingVisualField,
}).strict();

const pageEntry = z.object({ _block: z.literal('page'), slug }).strict();
const caseEntry = z.object({ _block: z.literal('case'), caseId: anchor }).strict();
const urlEntry = z.object({ _block: z.literal('url'), href: safeHref, title: text, summary: z.string().default(''), label: z.string().default('Les mer') }).strict();
const manualEntry = z.discriminatedUnion('_block', [pageEntry, caseEntry, urlEntry]);
export const pageListSchema = z.object({
  source: z.enum(['articles', 'pages', 'cases']).default('articles'),
  mode: z.enum(['automatic', 'manual']).default('automatic'),
  sort: z.enum(['editorial', 'title']).default('editorial'),
  limit: z.number().int().min(1).max(12).default(6),
  layout: z.enum(['cards', 'mediaCards', 'alternating', 'compact', 'links']).default('cards'),
  entries: z.array(manualEntry).max(9).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'manual' && value.entries.length < 2) ctx.addIssue({ code: 'custom', path: ['entries'], message: 'Velg 2–9 elementer' });
  const ids = value.entries.map(x => x._block === 'page' ? 'page:' + x.slug : x._block === 'case' ? 'case:' + x.caseId : 'url:' + x.href);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['entries'], message: 'Duplicate selected items' });
});
export type PageListConfig = z.infer<typeof pageListSchema>;

const visibility=z.enum(['visible','hidden']).default('visible');
const sharedVisibility=z.enum(['visible','hidden']).optional();
// Semantic daisyUI v5 surfaces; retain legacy options so saved Pages CMS content roundtrips.
const surface=z.enum(['default','base-100','base-200','base-300','primary','secondary','accent','neutral','info','success','warning','error','base','soft','mint','lavender','dark']).default('default');
const layout=z.enum(['default','two-columns','three-columns','stacked']).default('default');
const alignment=z.enum(['center','left']).default('center');
const variant=z.enum(['default','plain','card']).default('default');
const bodySchema=z.union([z.string(),z.array(z.string())]).default([]);
const contentItem=z.object({title:text,badge:z.string().trim().max(80).optional(),price:z.string().trim().max(120).optional(),text:z.string(),href:internalHref.optional(),label:z.string().optional(),surface,boxVariant:variant}).strict();
const contentLink=z.object({label:text,href:internalHref}).strict();
/** Same authored fields for local and global ordinary content; not commercial masters. */
export const ordinaryFields={eyebrow:z.string().optional(),heading:text,body:bodySchema,headingAlign:alignment,layout,surface,items:z.array(contentItem).optional(),links:z.array(contentLink).optional()};
const reserved=new Set(['behov','regneeksempel','sjekk','priser','resultater','mekanisme','passer','sporsmal','skjema','main','mobile-menu','site-menu','order-package','website','email','message']);
const isReserved=(id:string)=>reserved.has(id)||/^(?:calc-|scenario-|package-home-|term-|header-(?:desktop|mobile)-submenu-)/.test(id);
export const sharedContentSchema=z.object({_block:z.literal('content'),uid:z.string().uuid(),id:anchor,name:text,...ordinaryFields}).strict().superRefine((value,ctx)=>{
 if(isReserved(value.id))ctx.addIssue({code:'custom',path:['id'],message:'Reserved shared content anchor'});
});
export type SharedContent=z.infer<typeof sharedContentSchema>;
export type SharedContentRegistry=Readonly<Record<string,SharedContent>>;
export function validateSharedContentEntries(files:Readonly<Record<string,unknown>>):SharedContentRegistry {
 const found:Record<string,SharedContent>={},uids=new Set<string>();
 for(const [path,value] of Object.entries(files)){
  const file=path.split('/').at(-1)??'';
  if(!file.endsWith('.json'))throw new Error('Invalid shared content filename: '+path);
  const id=file.slice(0,-5);
  if(!anchor.safeParse(id).success)throw new Error('Invalid shared content ID: '+id);
  const content=sharedContentSchema.parse(value);
  if(content.id!==id)throw new Error('Shared content filename/ID mismatch: '+path);
  if(found[id]||uids.has(content.uid.toLowerCase()))throw new Error('Duplicate shared content identity: '+id);
  uids.add(content.uid.toLowerCase());found[id]=content;
 }
 return found;
}
export const sectionSchema=z.discriminatedUnion('_block',[
 z.object({_block:z.literal('content'),id:anchor,...ordinaryFields,visibility}).strict(),
 z.object({_block:z.literal('sharedContent'),entry:anchor,visibility:sharedVisibility}).strict(),
 z.object({_block:z.literal('global'),id:anchor,element:anchor,visibility}).strict(),
 z.object({_block:z.literal('pageList'),id:anchor,heading:text,visibility,pageList:pageListSchema}).strict(),
]);
const heroImage = z.object({
  src: z.string().regex(/^\/images\/pages\/[a-zA-Z0-9_./-]+\.(?:svg|png|webp|jpe?g|avif)$/),
  alt: z.string(), positionX: z.number().min(0).max(100).default(50), positionY: z.number().min(0).max(100).default(50),
}).strict();
const cta = z.object({ label: text, href: internalHref }).strict();
// None may retain a previously authored image under Pages CMS content.merge=true.
export const heroVisualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), image: heroImage.optional() }).strict(),
  z.object({ kind: z.literal('image'), image: heroImage }).strict(),
]);
export const builderPageSchema = z.object({
  slug,
  kind: z.enum(['home', 'service', 'article', 'utility', 'index']),
  seo: z.object({ title: text, description: text }).strict(),
  hero: z.object({
    layout: z.enum(['split-right', 'split-left', 'centered', 'centered-none']),
    eyebrow: z.string().optional(), title: text, support: text,
    primaryCta: cta.optional(), secondaryCta: cta.optional(), visual: heroVisualSchema,
    titleEmphasis:z.enum(['none','first-sentence']).default('none'), featuredProofCaseId:anchor.optional(),
  }).strict(),
  listing: listingMetadataSchema.optional(),
  faq: z.array(faqItemSchema).default([]),
  sections: z.array(sectionSchema).default([]),
}).strict().superRefine((page, ctx) => {
  const visible = page.sections.filter(s => s.visibility !== 'hidden');
  const ids = visible.flatMap(s => 'id' in s ? [s.id] : []);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Duplicate section anchors' });
  const globals = visible.filter(s => s._block === 'global').map(s => s.element);
  if (new Set(globals).size !== globals.length) ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Duplicate global placement' });
  if (visible.some(s => s._block === 'global' && s.element === 'faq' && s.id !== 'sporsmal'))
    ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Global FAQ uses stable section anchor sporsmal' });
  if (page.faq.length && !globals.includes('faq') && ids.includes('sporsmal'))
    ctx.addIssue({ code: 'custom', path: ['sections'], message: 'sporsmal is reserved for the page FAQ fallback' });
  if (page.kind === 'home' && page.slug !== 'home') ctx.addIssue({ code: 'custom', path: ['slug'], message: 'Home uses root slug home' });
});
export type BuilderPage = z.infer<typeof builderPageSchema>;
export type Section = z.infer<typeof sectionSchema>;

export type GlobalMaster =
  | { type: 'faq'; items: readonly z.infer<typeof faqItemSchema>[] }
  | { type: 'content'; heading: string; body: string }
  | { type: 'protected'; renderKey: string; publicationApproved: boolean };
export type GlobalMasters = Readonly<Record<string, GlobalMaster>>;

export interface CaseReference {
  id: string; displayName: string; summary: string;
  publicationApproved: boolean; namePermission: boolean;
}
export interface PageListItem {
  slug: string; title: string; summary: string; label: string; href?: string; visual?: ListingVisual;
}
const collator = new Intl.Collator('nb', { sensitivity: 'variant' });
export function publicPath(value: string): string { const s = slug.parse(value); return s === 'home' ? '/' : '/' + s + '/'; }
export function combineFaq(globalItems: readonly z.infer<typeof faqItemSchema>[], localItems: readonly z.infer<typeof faqItemSchema>[] = []) {
  const seen = new Set<string>();
  return [...globalItems, ...localItems].filter(row => {
    const key = row.question.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb-NO');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function asPageListItem(page: BuilderPage): PageListItem {
  const visual = page.listing?.visual;
  return {
    slug: page.slug, title: page.listing?.title ?? page.hero.title,
    summary: page.listing?.summary ?? page.hero.support,
    label: page.listing?.label ?? 'Les mer', href: publicPath(page.slug),
    ...(visual && visual.kind !== 'none' ? { visual } : {}),
  };
}
export function resolvePageList(input: unknown, pages: readonly BuilderPage[], cases: readonly CaseReference[] = []): PageListItem[] {
  const cfg = pageListSchema.parse(input);
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  if (bySlug.size !== pages.length) throw new Error('Duplicate canonical page slug');
  const availableCases = new Map(cases.filter(c => c.publicationApproved && c.namePermission)
    .map(c => [c.id, { slug: 'case:' + c.id, title: c.displayName, summary: c.summary, label: '' }]));
  if (cfg.mode === 'manual') return cfg.entries.flatMap(entry => {
    if (entry._block === 'url') return [{ slug: 'url:' + entry.href, title: entry.title, summary: entry.summary, label: entry.label, href: entry.href }];
    if (entry._block === 'case') return availableCases.has(entry.caseId) ? [availableCases.get(entry.caseId)!] : [];
    const page = bySlug.get(entry.slug);
    if (!page) throw new Error('Missing PageList page: ' + entry.slug);
    return page.listing?.visible === false ? [] : [asPageListItem(page)];
  });
  if (cfg.source === 'cases') return [...availableCases.values()].sort((a,b) => collator.compare(a.title,b.title)).slice(0,cfg.limit);
  const candidates = pages.filter(p => p.listing?.visible !== false &&
    (cfg.source === 'articles' ? p.kind === 'article' : p.kind !== 'home' && p.kind !== 'utility'));
  const sorted = [...candidates].sort((a,b) => {
    if (cfg.sort === 'editorial') {
      const ax = a.listing?.order ?? Infinity, bx = b.listing?.order ?? Infinity;
      if (ax !== bx) return ax - bx;
    }
    return collator.compare(a.listing?.title ?? a.hero.title, b.listing?.title ?? b.hero.title) || collator.compare(a.slug,b.slug);
  });
  return sorted.slice(0,cfg.limit).map(asPageListItem);
}
// A source image belongs to its original page. Fallback exists only in the display projection.
export function presentationVisual(item: PageListItem, layout: PageListConfig['layout']): ListingVisual | undefined {
  return layout === 'alternating' ? (item.visual ?? { kind: 'icon', icon: 'page' }) : item.visual;
}
export function resolveSections(page:BuilderPage,masters:GlobalMasters,pages:readonly BuilderPage[],cases:readonly CaseReference[]=[],shared:SharedContentRegistry={}) {
 const placed=new Set<string>();
 for(const section of page.sections){
  if(section._block!=='sharedContent')continue;
  if(placed.has(section.entry))throw new Error('Duplicate shared placement: '+section.entry);
  placed.add(section.entry);
  if(!shared[section.entry])throw new Error('Missing shared source: '+section.entry);
 }
 const visible=page.sections.filter(s=>s.visibility!=='hidden');
 const ids=new Set<string>();
 for(const s of visible){
  const id=s._block==='sharedContent'?shared[s.entry].id:s.id;
  if(ids.has(id))throw new Error('Duplicate rendered anchor: '+id);
  ids.add(id);
 }
 let hasGlobalFaq=false;
 const content=visible.map(section=>{
  if(section._block==='content')return {type:'content' as const,section};
  if(section._block==='sharedContent')return {type:'content' as const,section:shared[section.entry]};
  if(section._block==='pageList')return {type:'pageList' as const,section,items:resolvePageList(section.pageList,pages,cases)};
  const master=masters[section.element];
  if(!master)throw new Error('Missing global master: '+section.element);
  if(master.type==='protected'&&!master.publicationApproved)throw new Error('Global master not approved: '+section.element);
  if(master.type==='faq'){hasGlobalFaq=true;return {type:'faq' as const,section,items:combineFaq(master.items,page.faq)};}
  return {type:'global' as const,section,master};
 });
 if(!hasGlobalFaq&&page.faq.length){
  if(ids.has('sporsmal'))throw new Error('FAQ anchor collision: sporsmal');
  content.push({type:'faq',section:{_block:'global',id:'sporsmal',element:'faq',visibility:'visible'},items:[...page.faq]} as any);
 }
 return content;
}
