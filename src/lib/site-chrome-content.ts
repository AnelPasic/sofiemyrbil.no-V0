import { siteChromeSchema } from './site-chrome.ts';

/** Three separate stock Pages CMS files; one validated runtime config. */
function record(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(source + ' must be an object');
  return value as Record<string, unknown>;
}
export function composeSiteChrome(headerSource: unknown, footerSource: unknown, appearanceSource: unknown) {
  const header = record(headerSource, 'header');
  const footer = record(footerSource, 'footer');
  const appearance = record(appearanceSource, 'appearance');
  const options = record(header.headerOptions, 'headerOptions');
  if ('footer' in header || 'themes' in header || 'showThemeSwitch' in options)
    throw new Error('Header cannot own appearance or footer values');
  if (Object.keys(footer).some(k => !['footer','footerLogoLight','footerLogoDark'].includes(k)))
    throw new Error('Footer may only contain footer-owned fields');
  if (Object.keys(appearance).some(k => !['themes','showThemeSwitch'].includes(k)))
    throw new Error('Appearance may only contain appearance-owned fields');
  return siteChromeSchema.parse({
    ...header, ...footer,
    themes: appearance.themes,
    headerOptions: {...options, showThemeSwitch: appearance.showThemeSwitch},
  });
}
