import { Memory } from "../../types";

export type PaperSize = "A4" | "A3" | "A5" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "compact" | "standard" | "wide";
export type Density = "compact" | "standard" | "spacious";
export type FontSize = "small" | "medium" | "large";
export type HeaderStyle = "standard" | "centered" | "letterhead";
export type WatermarkType = "none" | "confidential" | "internal" | "official";
export type DocumentTheme = "blue" | "slate" | "emerald" | "rose";

export interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  marginMm: number;
  widthPx: number;
  heightPx: number;
  contentWidthMm: number;
  contentHeightMm: number;
}

export interface PrintSettingsState {
  pageSize: PaperSize;
  orientation: Orientation;
  marginPreset: MarginPreset;
  customMarginMm?: number;
  density: Density;
  fontSize: FontSize;
  fontScale: number; // percentage 75 - 140
  lineSpacing: number; // 1.0, 1.2, 1.5, 1.8
  columns: "1" | "2";
  headerStyle: HeaderStyle;
  logoSize: "small" | "medium" | "large";
  companyName: string;
  departmentName: string;
  documentRef: string;
  userName: string;
  displayDate: string;
  watermark: WatermarkType;
  
  // Section Visibility Toggles
  includeHeader: boolean;
  includeFooter: boolean;
  includeCausal: boolean;
  includeOutcomes: boolean;
  includeLessons: boolean;
  includeAuthor: boolean;
  includeTags: boolean;
  includeSignatureBlock: boolean;
  includeVerificationSeal: boolean;

  // Custom Uploads
  companyLogoImg: string | null;
  signatureImg: string | null;

  // Selection
  selectedMemoryIds: string[];
}

export interface PrintSystemProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  initialSelectedMemoryId?: string | null;
  lang: "en" | "ar" | "fr";
  companyName?: string;
  userName?: string;
  workspaceLogoUrl?: string;
}
