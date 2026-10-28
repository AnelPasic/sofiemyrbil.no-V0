import { z } from 'astro/zod';
import { chromeThemeSchema, ctaVariants } from './site-chrome-theme.ts';

/** Brand-neutral site chrome: navigation links remain native anchors. */
const label = z.string().trim().min(1).max(120);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const internalHref = z.string().regex(/^\/(?![\\/])[^<>"\s]*$/, 'Use a same-site /path/');
const publicHref = z.string().refine(
  value => internalHref.safeParse(value).success || /^https:\/\/[a-z0-9.-]+(?:\/[^<>"\s]*)?$/i.test(value),
  'Use an internal URL or an HTTPS URL',
);
const contactHref = z.string().refine(
  value => publicHref.safeParse(value).success || /^(mailto:[^<>"\s@]+@[^<>"\s@]+|tel:\+?[0-9 -]+)$/.test(value),
  'Use a safe internal, HTTPS, mailto or tel link',
);
export const chromeLinkSchema = z.object({
  label, href: publicHref, description: z.string().trim().max(220).optional(),
}).strict();
const chromeMenuLinkSchema = chromeLinkSchema.extend({ href: internalHref });
const linkItem = z.object({ kind: z.literal('link'), id, label, href: publicHref }).strict();
const dropdownItem = z.object({
  kind: z.literal('dropdown'), id, label, href: internalHref, toggleLabel: label,
  links: z.array(chromeMenuLinkSchema).min(1).max(12),
}).strict();
const megaItem = z.object({
  kind: z.literal('mega'), id, label, href: internalHref, toggleLabel: label,
  columns: z.array(z.object({
    heading: label, links: z.array(chromeMenuLinkSchema).min(1).max(12),
  }).strict()).min(2).max(4),
  promo: z.object({
    eyebrow: label.optional(), heading: label,
    body: z.string().trim().min(1).max(260), cta: chromeMenuLinkSchema,
  }).strict().optional(),
}).strict();
export const chromeNavItemSchema = z.discriminatedUnion('kind', [linkItem, dropdownItem, megaItem]);
export const siteChromeSchema = z.object({
  brand: z.object({
    name: label, homeHref: internalHref,
    logoSrc: internalHref.optional(), logoAlt: label.optional(),
  }).strict(),
  logoLight: internalHref.optional(), logoDark: internalHref.optional(),
  mobileLogoLight: internalHref.optional(), mobileLogoDark: internalHref.optional(),
  footerLogoLight: internalHref.optional(), footerLogoDark: internalHref.optional(),
  skipLabel: label, navigationLabel: label, mobileNavigationLabel: label,
  openMenuLabel: label, closeMenuLabel: label,
  navigation: z.array(chromeNavItemSchema).min(1).max(12),
  headerOptions: z.object({
    sticky: z.boolean(), showLanguageSwitch: z.boolean(), showSearch: z.boolean(),
    showCta: z.boolean(), showThemeSwitch: z.boolean(),
  }).strict(),
  themes: chromeThemeSchema,
  primaryCta: chromeLinkSchema.extend({ variant: z.enum(ctaVariants) }).optional(),
  utilityLinks: z.array(chromeLinkSchema).max(3).default([]),
  search: z.object({
    label, href: publicHref.optional(),
    mode: z.enum(['link', 'pagefind']).default('link'),
  }).strict().superRefine((search, context) => {
    if (search.mode === 'link' && !search.href) context.addIssue({
      code: z.ZodIssueCode.custom, path: ['href'],
      message: 'A search link needs a real destination',
    });
  }).optional(),
  languages: z.array(z.object({
    label, locale: z.string().regex(/^[a-z]{2}(?:-[A-Za-z]{2})?$/),
    href: internalHref.optional(), current: z.boolean(),
  }).strict()).max(4).default([]),
  footer: z.object({
    about: z.string().trim().max(360),
    groups: z.array(z.object({
      heading: label,
      links: z.array(z.object({ label, href: contactHref }).strict()).min(1).max(12),
    }).strict()).min(1).max(4),
    copyright: label, note: z.string().trim().max(180).optional(),
    legalLinks: z.array(z.object({ label, href: internalHref }).strict()).max(5).default([]),
  }).strict(),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.navigation.forEach((item, index) => {
    if (seen.has(item.id)) context.addIssue({
      code: z.ZodIssueCode.custom, path: ['navigation', index, 'id'],
      message: 'Navigation IDs must be unique',
    });
    seen.add(item.id);
    if (item.kind !== 'link') {
      const hrefs = item.kind === 'dropdown'
        ? item.links.map(link => link.href)
        : item.columns.flatMap(column => column.links.map(link => link.href));
      if (hrefs.length !== new Set(hrefs).size) context.addIssue({
        code: z.ZodIssueCode.custom, path: ['navigation', index],
        message: 'Submenu URLs must be unique within one menu',
      });
    }
  });
  if (value.languages.filter(x => x.current).length > 1) context.addIssue({
    code: z.ZodIssueCode.custom, path: ['languages'],
    message: 'Only one language can be marked current',
  });
});
export type SiteChrome = z.infer<typeof siteChromeSchema>;
export type ChromeNavItem = z.infer<typeof chromeNavItemSchema>;
export function navigationActive(href: string, pathname: string): boolean {
  if (!href.startsWith('/')) return false;
  const normalize = (path: string) => path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return normalize(href) === normalize(pathname);
}
export function navContainsCurrent(item: ChromeNavItem, pathname: string): boolean {
  if (navigationActive(item.href, pathname)) return true;
  if (item.kind === 'dropdown') return item.links.some(l => navigationActive(l.href, pathname));
  if (item.kind === 'mega') return item.columns.some(c => c.links.some(l => navigationActive(l.href, pathname)));
  return false;
}
