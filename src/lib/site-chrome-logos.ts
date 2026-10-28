import type { SiteChrome } from './site-chrome.ts';

/** Footer inherits desktop logos, not mobile artwork. Missing images fall back to brand. */
export function resolveSiteChromeLogos(config: SiteChrome) {
  const desktopLight = config.logoLight ?? config.logoDark ?? config.brand.logoSrc;
  const desktopDark = config.logoDark ?? config.logoLight ?? config.brand.logoSrc;
  return {
    desktopLight, desktopDark,
    mobileLight: config.mobileLogoLight ?? config.mobileLogoDark ?? desktopLight,
    mobileDark: config.mobileLogoDark ?? config.mobileLogoLight ?? desktopDark,
    footerLight: config.footerLogoLight ?? desktopLight ?? config.footerLogoDark ?? desktopDark,
    footerDark: config.footerLogoDark ?? desktopDark ?? config.footerLogoLight ?? desktopLight,
  };
}
