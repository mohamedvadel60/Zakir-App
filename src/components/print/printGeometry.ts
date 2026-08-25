import { PaperSize, Orientation, MarginPreset, PaperDimensions } from "./printTypes";

// Base dimensions in mm for Portrait orientation
const BASE_PAPER_DIMENSIONS_MM: Record<PaperSize, { shortMm: number; longMm: number }> = {
  A5: { shortMm: 148, longMm: 210 },
  A4: { shortMm: 210, longMm: 297 },
  A3: { shortMm: 297, longMm: 420 },
  Letter: { shortMm: 215.9, longMm: 279.4 },
  Legal: { shortMm: 215.9, longMm: 355.6 },
};

const MARGIN_PRESETS_MM: Record<MarginPreset, number> = {
  compact: 10,
  standard: 18,
  wide: 25,
};

// 1mm is approx 3.7795275591 px at 96 DPI
const MM_TO_PX = 3.7795275591;

export function getPaperGeometry(
  pageSize: PaperSize,
  orientation: Orientation,
  marginPreset: MarginPreset,
  customMarginMm?: number
): PaperDimensions {
  const base = BASE_PAPER_DIMENSIONS_MM[pageSize] || BASE_PAPER_DIMENSIONS_MM.A4;
  const isLandscape = orientation === "landscape";

  const widthMm = isLandscape ? base.longMm : base.shortMm;
  const heightMm = isLandscape ? base.shortMm : base.longMm;

  const marginMm = customMarginMm !== undefined ? customMarginMm : (MARGIN_PRESETS_MM[marginPreset] || 18);

  const widthPx = Math.round(widthMm * MM_TO_PX);
  const heightPx = Math.round(heightMm * MM_TO_PX);

  const contentWidthMm = Math.max(10, widthMm - 2 * marginMm);
  const contentHeightMm = Math.max(10, heightMm - 2 * marginMm);

  return {
    widthMm,
    heightMm,
    marginMm,
    widthPx,
    heightPx,
    contentWidthMm,
    contentHeightMm,
  };
}

export function generateDynamicPageStyle(pageSize: PaperSize, orientation: Orientation): string {
  // Generates CSS @page rule for browser native print
  return `@page { size: ${pageSize} ${orientation} !important; margin: 0 !important; }`;
}
