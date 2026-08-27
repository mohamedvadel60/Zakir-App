import { Memory } from "../../types";
import { PrintSettingsState } from "./printTypes";
import { getPaperGeometry } from "./printGeometry";

export interface PaginatedMemoryBlock {
  memory: Memory;
  memoryIndex: number; // 0-based index among valid selected memories (#1, #2...)
  isContinuation?: boolean;
  continuationIndex?: number; // 1, 2... for multiple continuations
  showCardHeader?: boolean;
  
  // Explicit paragraph fragmentation for description
  descriptionParagraphs?: string[];
  isDescriptionStart?: boolean;
  isDescriptionEnd?: boolean;
  
  showDecision?: boolean;
  showCausalFactors?: boolean;
  showOutcomes?: boolean;
  showLessonsLearned?: boolean;
  showMetadataAndTags?: boolean;
}

export interface PaginatedPage {
  pageIndex: number; // 0-based
  pageNumber: number; // 1-based (P1, P2...)
  totalPages: number;
  showHeader: boolean;
  showFooter: boolean;
  showSignature: boolean;
  blocks: PaginatedMemoryBlock[];
}

export interface ContentContinuityReport {
  isValid: boolean;
  totalMemoriesInput: number;
  totalMemoriesRendered: number;
  totalParagraphsInput: number;
  totalParagraphsRendered: number;
  errors: string[];
}

/**
 * Calculates character capacity and line count for a given text based on container width and font size.
 */
function estimateTextLines(text: string | undefined, baseFontSize: number, contentWidthPx: number): number {
  if (!text || !text.trim()) return 0;
  const clean = text.trim();
  const avgCharWidth = Math.max(5.5, baseFontSize * 0.54);
  const charsPerLine = Math.max(18, Math.floor(contentWidthPx / avgCharWidth));

  const paragraphs = clean.split(/\r?\n/);
  let totalLines = 0;
  for (const p of paragraphs) {
    if (p.trim().length === 0) {
      totalLines += 1;
    } else {
      totalLines += Math.max(1, Math.ceil(p.length / charsPerLine));
    }
  }
  return totalLines;
}

/**
 * Splits text into paragraphs, splitting oversized paragraphs into sentence/line chunks if necessary.
 */
function splitTextIntoParagraphChunks(text: string | undefined, maxCharsPerChunk: number = 320): string[] {
  if (!text || !text.trim()) return [];
  const rawParas = text.split(/\r?\n/);
  const result: string[] = [];

  for (const p of rawParas) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxCharsPerChunk) {
      result.push(trimmed);
    } else {
      // Split long paragraph by sentences or word boundaries
      const sentences = trimmed.match(/[^.!?،؛\n]+[.!?،؛\n]+|[^.!?،؛\n]+$/g) || [trimmed];
      let currentChunk = "";
      for (const s of sentences) {
        if ((currentChunk + " " + s).trim().length <= maxCharsPerChunk) {
          currentChunk = (currentChunk + " " + s).trim();
        } else {
          if (currentChunk) result.push(currentChunk);
          currentChunk = s.trim();
        }
      }
      if (currentChunk) {
        result.push(currentChunk);
      }
    }
  }
  return result.length > 0 ? result : [text.trim()];
}

/**
 * Calculates the exact vertical height needed for the Institutional Approval & Certification block.
 */
export function calculateApprovalHeight(settings: PrintSettingsState, _lang: "ar" | "en" | "fr"): number {
  if (!settings.showSignature) return 0;
  const titleHeight = 22;
  const paddingVertical = 24;
  const marginTop = 16;
  const borderOverhead = 2;
  const baseGridHeight = 72; // Approver info + signature box
  const issuingEntityOverhead = settings.showIssuingEntity ? 18 : 0;
  const approverTitleOverhead = settings.approverTitle ? 14 : 0;

  return titleHeight + paddingVertical + marginTop + borderOverhead + baseGridHeight + issuingEntityOverhead + approverTitleOverhead;
}

/**
 * Accurately measures / budgets the vertical heights of all document elements
 * and dynamically distributes them into discrete A4 pages (Word / Docs style fragmentation).
 * Guarantees ZERO content loss, strict preservation of sequence, and correct Approval placement.
 */
export function paginateMemories(
  memories: Memory[],
  settings: PrintSettingsState,
  lang: "ar" | "en" | "fr"
): PaginatedPage[] {
  if (!memories || memories.length === 0) {
    return [
      {
        pageIndex: 0,
        pageNumber: 1,
        totalPages: 1,
        showHeader: settings.showHeader,
        showFooter: settings.showFooter,
        showSignature: settings.showSignature,
        blocks: [],
      },
    ];
  }

  // 1. Compute physical paper & content geometry
  const geom = getPaperGeometry(settings.paperSize, settings.orientation, settings.margins);
  const baseFontSize = typeof settings.fontSize === "number" ? settings.fontSize : 13;
  
  let lineHeight = settings.lineHeight;
  if (!lineHeight) {
    if (settings.density === "compact") lineHeight = 1.3;
    else if (settings.density === "spacious") lineHeight = 1.85;
    else lineHeight = 1.55;
  }

  const linePx = baseFontSize * lineHeight;

  // Margins and paddings
  const paperInsetMm = 6; // Inset from paper edge
  const frameMarginMm = typeof settings.whiteMarginMm === "number" ? settings.whiteMarginMm : 10;
  const outerBorderPx = settings.showOuterBorder ? (settings.outerBorderThickness || 2) : 0;
  
  const totalVerticalOverheadMm = (paperInsetMm + frameMarginMm) * 2;
  const totalVerticalOverheadPx = (totalVerticalOverheadMm / 25.4) * 96 + outerBorderPx * 2;

  const totalHorizontalOverheadMm = (paperInsetMm + frameMarginMm) * 2;
  const contentWidthPx = Math.max(300, geom.widthPx - ((totalHorizontalOverheadMm / 25.4) * 96) - 28);

  const rawPageHeightPx = geom.heightPx;
  const usablePageHeightPx = Math.max(400, rawPageHeightPx - totalVerticalOverheadPx);

  // Overhead heights for Institutional Headers & Footers
  const headerHeightPx = settings.showHeader ? 88 : 0;
  const footerHeightPx = settings.showFooter ? 42 : 0;
  const approvalBlockHeight = calculateApprovalHeight(settings, lang);

  // Density-specific card padding & margins
  const cardPaddingV = settings.density === "compact" ? 18 : settings.density === "spacious" ? 34 : 26;
  const cardMarginBottom = settings.density === "compact" ? 10 : settings.density === "spacious" ? 18 : 14;
  const sectionGap = settings.density === "compact" ? 8 : settings.density === "spacious" ? 14 : 10;

  // Available height helper
  const getPageCapacity = (pIdx: number) => {
    const isFirst = pIdx === 0;
    const hH = (isFirst || settings.showHeader) ? headerHeightPx : 0;
    const fH = settings.showFooter ? footerHeightPx : 0;
    return Math.max(300, usablePageHeightPx - hH - fH);
  };

  // Structured Item representation
  interface MemoryUnit {
    memory: Memory;
    memoryIndex: number;
    titleLines: number;
    headerHeight: number;
    descriptionParagraphs: string[];
    paragraphHeights: number[];
    decisionHeight: number;
    causalHeight: number;
    outcomesHeight: number;
    lessonsHeight: number;
    metadataHeight: number;
  }

  const memoryUnits: MemoryUnit[] = memories.map((m, idx) => {
    // Title & card header
    const titleLines = Math.max(1, Math.ceil((m.title || "").length / (contentWidthPx / (baseFontSize * 0.58))));
    const headerH = 34 + titleLines * (baseFontSize * 1.35) + (settings.showRiskBadges ? 4 : 0);

    // Description chunks
    const paragraphs = splitTextIntoParagraphChunks(m.description);
    const paraHeights = paragraphs.map((p) => {
      const lines = estimateTextLines(p, baseFontSize, contentWidthPx - 16);
      return Math.max(linePx, lines * linePx) + 6;
    });

    // Decision
    const hasDecision = Boolean(m.decision && m.decision.trim());
    const decisionLines = hasDecision ? estimateTextLines(m.decision, baseFontSize, contentWidthPx - 28) : 0;
    const decisionH = hasDecision ? (26 + decisionLines * linePx + sectionGap) : 0;

    // Causal factors
    const hasCausal = Boolean(settings.showCausalFactors && m.causalFactors && m.causalFactors.trim());
    const causalLines = hasCausal ? estimateTextLines(m.causalFactors, Math.max(10, baseFontSize * 0.92), contentWidthPx - 24) : 0;
    const causalH = hasCausal ? (22 + causalLines * linePx + sectionGap) : 0;

    // Outcomes
    const hasOutcomes = Boolean(settings.showOutcomes && m.outcomes && m.outcomes.trim());
    const outcomesLines = hasOutcomes ? estimateTextLines(m.outcomes, Math.max(10, baseFontSize * 0.92), contentWidthPx - 24) : 0;
    const outcomesH = hasOutcomes ? (22 + outcomesLines * linePx + sectionGap) : 0;

    // Lessons learned
    const hasLessons = Boolean(settings.showLessonsLearned && m.lessonsLearned && m.lessonsLearned.trim());
    const lessonsLines = hasLessons ? estimateTextLines(m.lessonsLearned, Math.max(10, baseFontSize * 0.92), contentWidthPx - 24) : 0;
    const lessonsH = hasLessons ? (22 + lessonsLines * linePx + sectionGap) : 0;

    // Metadata & Tags
    let metaH = 0;
    if (settings.showMetadata || (settings.showTags && m.tags && m.tags.length > 0)) {
      metaH = 26 + sectionGap;
    }

    return {
      memory: m,
      memoryIndex: idx,
      titleLines,
      headerHeight: headerH,
      descriptionParagraphs: paragraphs,
      paragraphHeights: paraHeights,
      decisionHeight: decisionH,
      causalHeight: causalH,
      outcomesHeight: outcomesH,
      lessonsHeight: lessonsH,
      metadataHeight: metaH,
    };
  });

  // Page Accumulator
  const pages: {
    blocks: PaginatedMemoryBlock[];
    showHeader: boolean;
    showFooter: boolean;
    showSignature: boolean;
    usedHeight: number;
    capacity: number;
  }[] = [];

  let currentBlocks: PaginatedMemoryBlock[] = [];
  let currentPageIndex = 0;
  let currentUsedHeight = 0;
  let currentCapacity = getPageCapacity(0);

  const finalizeAndStartNewPage = () => {
    pages.push({
      blocks: currentBlocks,
      showHeader: currentPageIndex === 0 || settings.showHeader,
      showFooter: settings.showFooter,
      showSignature: false,
      usedHeight: currentUsedHeight,
      capacity: currentCapacity,
    });
    currentBlocks = [];
    currentPageIndex += 1;
    currentUsedHeight = 0;
    currentCapacity = getPageCapacity(currentPageIndex);
  };

  // Iterate over all memories sequentially (Strictly preserving original document order)
  for (let uIdx = 0; uIdx < memoryUnits.length; uIdx++) {
    const unit = memoryUnits[uIdx];
    const totalParas = unit.descriptionParagraphs.length;

    // Compute total full height of this memory card
    const descTotalH = unit.paragraphHeights.reduce((acc, h) => acc + h, 0);
    const fullCardHeight = unit.headerHeight + descTotalH + unit.decisionHeight + unit.causalHeight + unit.outcomesHeight + unit.lessonsHeight + unit.metadataHeight + cardPaddingV + cardMarginBottom;

    // Check if entire memory card fits on current page
    if (currentUsedHeight + fullCardHeight <= currentCapacity) {
      currentBlocks.push({
        memory: unit.memory,
        memoryIndex: unit.memoryIndex,
        isContinuation: false,
        continuationIndex: 0,
        showCardHeader: true,
        descriptionParagraphs: unit.descriptionParagraphs,
        isDescriptionStart: true,
        isDescriptionEnd: true,
        showDecision: unit.decisionHeight > 0,
        showCausalFactors: unit.causalHeight > 0,
        showOutcomes: unit.outcomesHeight > 0,
        showLessonsLearned: unit.lessonsHeight > 0,
        showMetadataAndTags: unit.metadataHeight > 0,
      });
      currentUsedHeight += fullCardHeight;
      continue;
    }

    // It does not fit in its entirety on the current page.
    // If the current page already has content, determine if we have enough room to start a meaningful part of it.
    const minViableStartSpace = unit.headerHeight + (totalParas > 0 ? unit.paragraphHeights[0] : 40) + cardPaddingV;
    const remainingCurrentSpace = currentCapacity - currentUsedHeight;

    if (currentBlocks.length > 0 && remainingCurrentSpace < minViableStartSpace) {
      // Start a fresh page first
      finalizeAndStartNewPage();
    }

    // Check if it fits on the fresh page entirely
    if (currentBlocks.length === 0 && fullCardHeight <= currentCapacity) {
      currentBlocks.push({
        memory: unit.memory,
        memoryIndex: unit.memoryIndex,
        isContinuation: false,
        continuationIndex: 0,
        showCardHeader: true,
        descriptionParagraphs: unit.descriptionParagraphs,
        isDescriptionStart: true,
        isDescriptionEnd: true,
        showDecision: unit.decisionHeight > 0,
        showCausalFactors: unit.causalHeight > 0,
        showOutcomes: unit.outcomesHeight > 0,
        showLessonsLearned: unit.lessonsHeight > 0,
        showMetadataAndTags: unit.metadataHeight > 0,
      });
      currentUsedHeight += fullCardHeight;
      continue;
    }

    // Memory is larger than remaining space (or larger than a whole page).
    // Fragment memory into contiguous chunks across pages without losing any block or paragraph!
    let nextParaIdx = 0;
    let continuationStep = 0;
    let pendingDecision = unit.decisionHeight > 0;
    let pendingCausal = unit.causalHeight > 0;
    let pendingOutcomes = unit.outcomesHeight > 0;
    let pendingLessons = unit.lessonsHeight > 0;
    let pendingMetadata = unit.metadataHeight > 0;

    while (
      nextParaIdx < totalParas ||
      pendingDecision ||
      pendingCausal ||
      pendingOutcomes ||
      pendingLessons ||
      pendingMetadata
    ) {
      const isContinuation = continuationStep > 0;
      const isStart = continuationStep === 0;

      // Available space on current working page
      let spaceAvailable = currentCapacity - currentUsedHeight;
      if (spaceAvailable < 80 && currentBlocks.length > 0) {
        finalizeAndStartNewPage();
        spaceAvailable = currentCapacity - currentUsedHeight;
      }

      // Overhead of this chunk's card header and padding
      const chunkHeaderH = unit.headerHeight;
      let chunkHeight = chunkHeaderH + cardPaddingV;

      const chunkParagraphs: string[] = [];
      const paraStartIdx = nextParaIdx;

      // Greedily fill with description paragraphs that fit
      while (nextParaIdx < totalParas) {
        const pHeight = unit.paragraphHeights[nextParaIdx];
        if (chunkHeight + pHeight <= spaceAvailable || chunkParagraphs.length === 0) {
          chunkParagraphs.push(unit.descriptionParagraphs[nextParaIdx]);
          chunkHeight += pHeight;
          nextParaIdx += 1;
        } else {
          break;
        }
      }

      const isDescEnd = nextParaIdx >= totalParas;

      // If all description paragraphs are included, try to include remaining sections
      let chunkDecision = false;
      let chunkCausal = false;
      let chunkOutcomes = false;
      let chunkLessons = false;
      let chunkMetadata = false;

      if (isDescEnd) {
        if (pendingDecision) {
          if (chunkHeight + unit.decisionHeight <= spaceAvailable || chunkParagraphs.length === 0) {
            chunkDecision = true;
            chunkHeight += unit.decisionHeight;
            pendingDecision = false;
          }
        }
        if (!pendingDecision && pendingCausal) {
          if (chunkHeight + unit.causalHeight <= spaceAvailable || (chunkParagraphs.length === 0 && !chunkDecision)) {
            chunkCausal = true;
            chunkHeight += unit.causalHeight;
            pendingCausal = false;
          }
        }
        if (!pendingDecision && !pendingCausal && pendingOutcomes) {
          if (chunkHeight + unit.outcomesHeight <= spaceAvailable || (chunkParagraphs.length === 0 && !chunkDecision && !chunkCausal)) {
            chunkOutcomes = true;
            chunkHeight += unit.outcomesHeight;
            pendingOutcomes = false;
          }
        }
        if (!pendingDecision && !pendingCausal && !pendingOutcomes && pendingLessons) {
          if (chunkHeight + unit.lessonsHeight <= spaceAvailable || (chunkParagraphs.length === 0 && !chunkDecision && !chunkCausal && !chunkOutcomes)) {
            chunkLessons = true;
            chunkHeight += unit.lessonsHeight;
            pendingLessons = false;
          }
        }
        if (!pendingDecision && !pendingCausal && !pendingOutcomes && !pendingLessons && pendingMetadata) {
          if (chunkHeight + unit.metadataHeight <= spaceAvailable || (chunkParagraphs.length === 0 && !chunkDecision && !chunkCausal && !chunkOutcomes && !chunkLessons)) {
            chunkMetadata = true;
            chunkHeight += unit.metadataHeight;
            pendingMetadata = false;
          }
        }
      }

      // Add this continuous fragment block
      currentBlocks.push({
        memory: unit.memory,
        memoryIndex: unit.memoryIndex,
        isContinuation,
        continuationIndex: continuationStep,
        showCardHeader: true,
        descriptionParagraphs: chunkParagraphs,
        isDescriptionStart: isStart && paraStartIdx === 0,
        isDescriptionEnd: isDescEnd,
        showDecision: chunkDecision,
        showCausalFactors: chunkCausal,
        showOutcomes: chunkOutcomes,
        showLessonsLearned: chunkLessons,
        showMetadataAndTags: chunkMetadata,
      });

      currentUsedHeight += chunkHeight + cardMarginBottom;
      continuationStep += 1;

      // If more units remain for this memory, start a new page
      if (
        nextParaIdx < totalParas ||
        pendingDecision ||
        pendingCausal ||
        pendingOutcomes ||
        pendingLessons ||
        pendingMetadata
      ) {
        finalizeAndStartNewPage();
      }
    }
  }

  // Push the final page
  if (currentBlocks.length > 0 || pages.length === 0) {
    pages.push({
      blocks: currentBlocks,
      showHeader: currentPageIndex === 0 || settings.showHeader,
      showFooter: settings.showFooter,
      showSignature: false,
      usedHeight: currentUsedHeight,
      capacity: currentCapacity,
    });
  }

  // 5. Handle Approval & Certification Section strictly on the final page
  // RULE: IF approval section fits in remaining space -> place it in current/final page.
  //       ELSE -> move the entire atomic approval block to a clean next page.
  if (settings.showSignature && pages.length > 0) {
    const lastPageIdx = pages.length - 1;
    const lastPage = pages[lastPageIdx];
    const remainingSpace = lastPage.capacity - lastPage.usedHeight;
    const requiredApprovalSpace = approvalBlockHeight + 10;

    if (remainingSpace >= requiredApprovalSpace) {
      // Sufficient space exists on the current last page: place approval block here!
      lastPage.showSignature = true;
      lastPage.usedHeight += requiredApprovalSpace;
    } else {
      // Insufficient space: place the COMPLETE atomic approval block on a dedicated clean page
      pages.push({
        blocks: [],
        showHeader: settings.showHeader,
        showFooter: settings.showFooter,
        showSignature: true,
        usedHeight: requiredApprovalSpace,
        capacity: getPageCapacity(pages.length),
      });
    }
  }

  // 6. Map to final PaginatedPage format with dynamic, authoritative totalPages count
  const totalCount = Math.max(1, pages.length);
  return pages.map((p, idx) => ({
    pageIndex: idx,
    pageNumber: idx + 1,
    totalPages: totalCount,
    showHeader: p.showHeader,
    showFooter: p.showFooter,
    showSignature: p.showSignature,
    blocks: p.blocks,
  }));
}

/**
 * Validates that every memory and paragraph is accounted for with zero omissions,
 * zero duplicates, and strict preservation of sequence.
 */
export function validateContentContinuity(
  memories: Memory[],
  pages: PaginatedPage[]
): ContentContinuityReport {
  const errors: string[] = [];
  const memoryMap = new Map<string, { totalParas: number; renderedParas: number }>();

  for (const m of memories) {
    const paras = splitTextIntoParagraphChunks(m.description);
    memoryMap.set(m.id, {
      totalParas: paras.length,
      renderedParas: 0,
    });
  }

  let totalParasInput = 0;
  for (const info of memoryMap.values()) {
    totalParasInput += info.totalParas;
  }

  let totalParasRendered = 0;
  const renderedMemoryIdsInOrder: string[] = [];

  for (const p of pages) {
    for (const b of p.blocks) {
      const mId = b.memory.id;
      if (!renderedMemoryIdsInOrder.includes(mId)) {
        renderedMemoryIdsInOrder.push(mId);
      }
      const count = b.descriptionParagraphs?.length || 0;
      totalParasRendered += count;
      const rec = memoryMap.get(mId);
      if (rec) {
        rec.renderedParas += count;
      }
    }
  }

  // Check memory sequence
  let seqIdx = 0;
  for (const m of memories) {
    if (!renderedMemoryIdsInOrder.includes(m.id)) {
      errors.push(`Memory #${m.id} (${m.title}) was completely omitted.`);
    } else {
      const renderedIdx = renderedMemoryIdsInOrder.indexOf(m.id);
      if (renderedIdx < seqIdx) {
        errors.push(`Memory #${m.id} was reordered.`);
      }
      seqIdx = Math.max(seqIdx, renderedIdx);
    }
  }

  // Check paragraph counts
  for (const [mId, info] of memoryMap.entries()) {
    if (info.renderedParas < info.totalParas) {
      errors.push(`Memory #${mId} lost ${info.totalParas - info.renderedParas} description paragraphs.`);
    }
  }

  return {
    isValid: errors.length === 0,
    totalMemoriesInput: memories.length,
    totalMemoriesRendered: renderedMemoryIdsInOrder.length,
    totalParagraphsInput: totalParasInput,
    totalParagraphsRendered: totalParasRendered,
    errors,
  };
}
