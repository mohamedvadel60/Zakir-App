import { PaperSize, Orientation, MarginPreset } from "./printTypes";

export interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  widthPx: number;  // at 96 DPI
  heightPx: number; // at 96 DPI
  paddingMm: number;
  paddingPx: number;
}

// Physical dimensions in mm (Width x Height in portrait)
const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

const MARGIN_MM: Record<MarginPreset, number> = {
  compact: 10,
  normal: 18,
  wide: 25,
};

// Convert mm to pixels at standard 96 DPI (1 inch = 25.4mm, 1 inch = 96px)
export function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 96);
}

export function getPaperGeometry(
  size: PaperSize,
  orientation: Orientation,
  margins: MarginPreset
): PaperDimensions {
  const base = PAPER_MM[size] || PAPER_MM.A4;
  
  let widthMm = base.w;
  let heightMm = base.h;

  if (orientation === "landscape") {
    widthMm = base.h;
    heightMm = base.w;
  }

  const paddingMm = MARGIN_MM[margins] || MARGIN_MM.normal;

  return {
    widthMm,
    heightMm,
    widthPx: mmToPx(widthMm),
    heightPx: mmToPx(heightMm),
    paddingMm,
    paddingPx: mmToPx(paddingMm),
  };
}
