import { Memory } from "../../types";

export type PaperSize = "A4" | "A3" | "A5" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "compact" | "normal" | "wide";
export type Density = "compact" | "comfortable" | "spacious";
export type HeaderStyle = "classic" | "minimal" | "executive";

export interface PrintSettingsState {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: MarginPreset;
  density: Density;
  headerStyle: HeaderStyle;
  fontSize: "small" | "medium" | "large";
  showHeader: boolean;
  showFooter: boolean;
  showSignature: boolean;
  showIssuingEntity: boolean;
  issuingEntityName: string;
  showMetadata: boolean;
  showCausalFactors: boolean;
  showOutcomes: boolean;
  showLessonsLearned: boolean;
  showTags: boolean;
  showRiskBadges: boolean;
  companyName: string;
  departmentName: string;
  reportTitle: string;
  docRefNumber: string;
  authorName: string;
  approverName: string;
  approvalDate: string;
  companyLogoImg: string | null;
  signatureImg: string | null;
  watermarkText: string;
  zoom: number; // visual scale in preview only (e.g. 0.75, 1, 1.25)
}

export interface PrintSystemProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  initialSelectedMemoryId?: string | null;
  lang: "ar" | "en" | "fr";
  companyName?: string;
  userName?: string;
  workspaceLogoUrl?: string;
}

export interface PrintDiagnostics {
  selectedCount: number;
  uniqueCount: number;
  renderedCount: number;
}
