import { Memory, User } from "../../types";

export type PaperSize = "A4" | "A3" | "A5" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "compact" | "normal" | "wide";
export type Density = "compact" | "comfortable" | "spacious";
export type HeaderStyle = "classic" | "minimal" | "executive";
export type FrameStyle = "full" | "double" | "executive" | "minimal";
export type InnerBorderStyle = "solid" | "double" | "dashed" | "wavy" | "decorative";
export type WavySideStyle = "calligraphic" | "wavy" | "double-wave" | "arabesque" | "geometric";
export type WavySidePosition = "right" | "left" | "both";

export interface PrintSettingsState {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: MarginPreset;
  density: Density;
  lineHeight?: number; // Custom line height multiplier (e.g. 1.2 to 2.2)
  headerStyle: HeaderStyle;
  frameStyle: FrameStyle; // 4-sided outer frame border as sketched in hand-drawn diagram

  // High-Fidelity Dual-Frame & Border Controls
  showOuterBorder: boolean; // Outer thick border
  outerBorderThickness: number; // Outer border thickness in px (1 - 8)
  outerBorderColor: string; // Outer border color
  outerBorderRadius: number; // Corner radius in px (0 - 12)
  
  whiteMarginMm: number; // White blank margin between outer and inner border in mm (4 - 24)
  
  showInnerBorder: boolean; // Inner content border
  innerBorderStyle: InnerBorderStyle; // Solid, Double, Dashed, etc.
  innerBorderThickness: number; // Inner border thickness in px (1 - 4)
  innerBorderColor: string; // Inner border color

  // Right-Side / Left-Side Decorative Wavy Flourish (نّي ~~~~~~ نّي)
  showWavySideBorder: boolean; // Decorative side border toggle
  wavyBorderStyle: WavySideStyle; // Calligraphic ('نّي ~~~ نّي'), Wavy, etc.
  wavyBorderSide: WavySidePosition; // Right (as in diagram), Left, Both
  wavyBorderColor: string; // Decorative border color
  wavyBorderThickness: number; // Line thickness in px (1 - 3)

  showCornerPageMarkers: boolean; // Bottom corner page markers "P1", "P2" as sketched
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
  showThumbnailsSidebar?: boolean; // Left pages thumbnail panel toggle
  previewTheme?: "light-gray" | "canvas-dark" | "pure-white"; // Preview workspace canvas background
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
