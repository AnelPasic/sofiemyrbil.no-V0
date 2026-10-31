import type { BuilderPage, SharedContentRegistry } from '../page-builder';

/**
 * Service pages link to the embedded booking form only while its
 * CMS placement is visible and resolves to a real booking widget.
 * The authored /bestilling/ link remains the fallback when hidden.
 * The homepage is owned by another thread and is deliberately unchanged.
 */
export function resolveBookingHero(page: BuilderPage, shared: SharedContentRegistry): BuilderPage['hero'] {
  if (page.kind !== 'service' || !page.hero.primaryCta) return page.hero;
  const visibleForm = page.sections.some(section =>
    section._block === 'sharedContent' &&
    section.visibility !== 'hidden' &&
    shared[section.entry]?.widget === 'bookingForm'
  );
  return visibleForm
    ? { ...page.hero, primaryCta: { label: 'Bestill time', href: '#bestilling-skjema' } }
    : page.hero;
}
