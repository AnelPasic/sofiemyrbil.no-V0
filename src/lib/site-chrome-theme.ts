import { z } from 'astro/zod';

export const ctaVariants = [
  'primary', 'secondary', 'accent', 'neutral',
  'info', 'success', 'warning', 'error',
] as const;
export type ThemeMode = 'light' | 'dark';

const colorKeys = [
  '--color-base-100', '--color-base-200', '--color-base-300', '--color-base-content',
  '--color-primary', '--color-primary-content', '--color-secondary',
  '--color-secondary-content', '--color-accent', '--color-accent-content',
  '--color-neutral', '--color-neutral-content', '--color-info', '--color-info-content',
  '--color-success', '--color-success-content', '--color-warning',
  '--color-warning-content', '--color-error', '--color-error-content',
] as const;
const numericKeys = [
  '--radius-selector', '--radius-field', '--radius-box', '--size-selector',
  '--size-field', '--border', '--depth', '--noise',
] as const;
const allowedKeys = new Set<string>([...colorKeys, ...numericKeys, 'name', 'default', 'prefersdark', 'color-scheme']);
const color = /^(?:oklch\(\s*\d+(?:\.\d+)?%?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?%?)?\s*\)|#[0-9a-fA-F]{3,8})$/;
const length = /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$/;
const number = /^(?:0|1|0\.\d+)$/;
const directive = /^@plugin\s+["']daisyui\/theme["']\s*\{([\s\S]*?)\}\s*;?\s*$/;

export interface ParsedTheme {
  name: string;
  scheme: ThemeMode;
  variables: Record<string, string>;
}

/**
 * Paste-in parser for the exact block exported by daisyUI Theme Generator.
 * Treat CMS content as data: no raw CSS, @import, JS, selectors or arbitrary
 * declarations are ever passed through to the generated page.
 */
export function parseDaisyTheme(source: string, expectedMode: ThemeMode): ParsedTheme {
  if (typeof source !== 'string' || source.length > 12000) throw new Error('Tema må være tekst på maks 12 000 tegn.');
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const match = directive.exec(withoutComments);
  if (!match) throw new Error('Lim inn én komplett @plugin "daisyui/theme" { ... }-blokk.');
  const fields = new Map<string, string>();
  for (const piece of match[1].split(';')) {
    const declaration = piece.trim();
    if (!declaration) continue;
    const colon = declaration.indexOf(':');
    if (colon < 0) throw new Error('Ugyldig temaerklæring: ' + declaration.slice(0, 50));
    const key = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!allowedKeys.has(key)) throw new Error('Ikke tillatt temaegenskap: ' + key);
    if (fields.has(key)) throw new Error('Duplisert temaegenskap: ' + key);
    if (!value) throw new Error('Mangler verdi for ' + key);
    fields.set(key, value);
  }

  const originalName = fields.get('name') ?? '';
  const name = originalName.replace(/^["']|["']$/g, '');
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) throw new Error('Ugyldig daisyUI-temanavn.');
  for (const flag of ['default', 'prefersdark']) {
    if (fields.has(flag) && !/^(true|false)$/.test(fields.get(flag)!)) {
      throw new Error(flag + ' må være true eller false.');
    }
  }
  const scheme = fields.get('color-scheme')?.replace(/^["']|["']$/g, '');
  if (scheme !== expectedMode) {
    throw new Error('Bruk et ' + expectedMode + '-tema med color-scheme: ' + expectedMode + ';');
  }
  const variables: Record<string, string> = {};
  for (const key of colorKeys) {
    const value = fields.get(key);
    if (!value || !color.test(value)) throw new Error('Mangler eller ugyldig ' + key + '.');
    variables[key] = value;
  }
  for (const key of numericKeys) {
    const value = fields.get(key);
    if (!value) throw new Error('Mangler ' + key + '.');
    if (!(key === '--depth' || key === '--noise' ? number : length).test(value)) {
      throw new Error('Ugyldig verdi for ' + key + '.');
    }
    variables[key] = value;
  }
  return { name, scheme: expectedMode, variables };
}

const validated = (mode: ThemeMode) => z.string().min(100).max(12000).superRefine((raw, context) => {
  try { parseDaisyTheme(raw, mode); }
  catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : 'Ugyldig tema' });
  }
});
export const chromeThemeSchema = z.object({
  defaultMode: z.enum(['light', 'dark']),
  lightCss: validated('light'),
  darkCss: validated('dark'),
  lightLabel: z.string().trim().min(1).max(24),
  darkLabel: z.string().trim().min(1).max(24),
}).strict().superRefine((theme, context) => {
  try {
    if (parseDaisyTheme(theme.lightCss, 'light').name === parseDaisyTheme(theme.darkCss, 'dark').name) {
      context.addIssue({code: z.ZodIssueCode.custom, message: 'Light og Dark må ha ulike name-verdier i daisyUI-blokkene.'});
    }
  } catch { /* Individual field validators report the parse errors. */ }
});
export type ChromeThemes = z.infer<typeof chromeThemeSchema>;

export function themeOverridesCss(themes: ChromeThemes): string {
  return (['light', 'dark'] as const).map(mode => {
    const theme = parseDaisyTheme(themes[mode + 'Css' as 'lightCss' | 'darkCss'], mode);
    const declarations = Object.entries(theme.variables).map(([key, value]) => key + ':' + value + ';').join('');
    return 'html[data-theme="' + theme.name + '"]{color-scheme:' + mode + ';' + declarations + '}';
  }).join('\n');
}
