import { Memory, User } from "../../types";

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
  lineHeight?: number; // Custom line height multiplier (e.g. 1.2 to 2.2)
  headerStyle: HeaderStyle;
  fontSize: number; // Custom font size in px (e.g. 8 to 32)
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
  approverTitle?: string;
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
  currentUser?: User | null;
  onOpenProfileSettings?: () => void;
}

export interface PrintDiagnostics {
  selectedCount: number;
  uniqueCount: number;
  renderedCount: number;
}
