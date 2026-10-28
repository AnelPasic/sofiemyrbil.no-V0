import type {SharedContent} from '../page-builder';

export type SurfaceChoice = {
  value: SharedContent['surface'];
  label: string;
  description: string;
  backgroundToken: string;
  foregroundToken: string;
  kind: 'semantic' | 'legacy';
};

// Reference list mirrors the stored surface values in stock Pages CMS.
// The catalog is deliberately display-only; actual colors are rendered by RichContentSection.
export const surfaceChoices = [
  {
    "value": "default",
    "label": "Standard (arver)",
    "description": "Ingen egen flate. Seksjon og kort bruker vanlig grunnbakgrunn.",
    "backgroundToken": "base-100",
    "foregroundToken": "base-content",
    "kind": "semantic"
  },
  {
    "value": "base-100",
    "label": "base-100",
    "description": "Nettstedets grunnflate. Temaavhengig lys/mørk bakgrunn.",
    "backgroundToken": "base-100",
    "foregroundToken": "base-content",
    "kind": "semantic"
  },
  {
    "value": "base-200",
    "label": "base-200",
    "description": "En rolig kontrastflate for innhold og kort.",
    "backgroundToken": "base-200",
    "foregroundToken": "base-content",
    "kind": "semantic"
  },
  {
    "value": "base-300",
    "label": "base-300",
    "description": "Tydeligere nivå av nøytral kontrast.",
    "backgroundToken": "base-300",
    "foregroundToken": "base-content",
    "kind": "semantic"
  },
  {
    "value": "primary",
    "label": "primary",
    "description": "Profilens hovedfarge med tilsvarende lesbar tekstfarge.",
    "backgroundToken": "primary",
    "foregroundToken": "primary-content",
    "kind": "semantic"
  },
  {
    "value": "secondary",
    "label": "secondary",
    "description": "Profilens sekundærfarge med tilpasset tekst.",
    "backgroundToken": "secondary",
    "foregroundToken": "secondary-content",
    "kind": "semantic"
  },
  {
    "value": "accent",
    "label": "accent",
    "description": "Profilens aksentfarge for ekstra oppmerksomhet.",
    "backgroundToken": "accent",
    "foregroundToken": "accent-content",
    "kind": "semantic"
  },
  {
    "value": "neutral",
    "label": "neutral",
    "description": "Nøytral kontrastflate med tilpasset tekst.",
    "backgroundToken": "neutral",
    "foregroundToken": "neutral-content",
    "kind": "semantic"
  },
  {
    "value": "info",
    "label": "info",
    "description": "Semantisk informasjonsflate.",
    "backgroundToken": "info",
    "foregroundToken": "info-content",
    "kind": "semantic"
  },
  {
    "value": "success",
    "label": "success",
    "description": "Semantisk flate for positive statusbudskap.",
    "backgroundToken": "success",
    "foregroundToken": "success-content",
    "kind": "semantic"
  },
  {
    "value": "warning",
    "label": "warning",
    "description": "Semantisk varselflate.",
    "backgroundToken": "warning",
    "foregroundToken": "warning-content",
    "kind": "semantic"
  },
  {
    "value": "error",
    "label": "error",
    "description": "Semantisk flate for feil eller kritiske meldinger.",
    "backgroundToken": "error",
    "foregroundToken": "error-content",
    "kind": "semantic"
  },
  {
    "value": "base",
    "label": "Eldre: Hvit",
    "description": "Kompatibilitetsvalg. Tilsvarer i dag base-100.",
    "backgroundToken": "base-100",
    "foregroundToken": "base-content",
    "kind": "legacy"
  },
  {
    "value": "soft",
    "label": "Eldre: Lys",
    "description": "Kompatibilitetsvalg. Tilsvarer i dag base-200.",
    "backgroundToken": "base-200",
    "foregroundToken": "base-content",
    "kind": "legacy"
  },
  {
    "value": "mint",
    "label": "Eldre: Mint",
    "description": "Kompatibilitetsvalg med en svak grønnblandet flate.",
    "backgroundToken": "base-100",
    "foregroundToken": "base-content",
    "kind": "legacy"
  },
  {
    "value": "lavender",
    "label": "Eldre: Lavendel",
    "description": "Kompatibilitetsvalg med en svak sekundærfargeblanding.",
    "backgroundToken": "base-100",
    "foregroundToken": "base-content",
    "kind": "legacy"
  },
  {
    "value": "dark",
    "label": "Eldre: Mørk",
    "description": "Kompatibilitetsvalg. Tilsvarer i dag neutral.",
    "backgroundToken": "neutral",
    "foregroundToken": "neutral-content",
    "kind": "legacy"
  }
] as const satisfies readonly SurfaceChoice[];

export const semanticSurfaces = surfaceChoices.filter((surface) => surface.kind === 'semantic');
export const legacySurfaces = surfaceChoices.filter((surface) => surface.kind === 'legacy');
