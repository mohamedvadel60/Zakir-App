import React, { useEffect, useState } from "react";

interface ZakirLoadingScreenProps {
  theme?: "light" | "dark";
  onComplete?: () => void;
}

/**
 * ZAKIR Professional Brand Loading System
 *
 * Sequence (~1350ms total):
 * 1. Phase 1 (0 - 650ms): Fade In (opacity 0 -> 1) + Logo Drawing/Reveal (clip-path progressive reveal) + Subtle Zoom (scale 0.92 -> 1) concurrently.
 * 2. Phase 2 (650 - 800ms): Pure Hold (150ms static hold at scale 1.0, opacity 1.0).
 * 3. Phase 3 (800 - 1050ms): Logo Scale Down (1.0 -> 0.58) + App Box Emergence (96x96, radius 20px, opacity 0 -> 1, scale 0.90 -> 1).
 * 4. Centering Hold (1050 - 1100ms): Mathematical flex centering inside 96x96 box.
 * 5. Phase 4 (1100 - 1350ms): Smooth Exit (opacity 1 -> 0, scale 1.0 -> 0.97).
 */
export const ZakirLoadingScreen: React.FC<ZakirLoadingScreenProps> = ({
  theme: propsTheme,
  onComplete,
}) => {
  // Synchronous theme resolution from localStorage
  const [activeTheme] = useState<"light" | "dark">((): "light" | "dark" => {
    if (propsTheme === "light" || propsTheme === "dark") return propsTheme;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zakir_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  // Stage state machine: "draw" | "hold" | "box" | "centered" | "exit" | "hidden"
  const [stage, setStage] = useState<
    "draw" | "hold" | "box" | "centered" | "exit" | "hidden"
  >("draw");

  const isLight = activeTheme === "light";

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setStage("centered");
      const t = setTimeout(() => {
        setStage("exit");
        setTimeout(() => {
          setStage("hidden");
          onComplete?.();
        }, 200);
      }, 400);
      return () => clearTimeout(t);
    }

    // Precise timeline orchestrator (~1350ms total)
    const tHold = setTimeout(() => setStage("hold"), 650);
    const tBox = setTimeout(() => setStage("box"), 800);
    const tCenter = setTimeout(() => setStage("centered"), 1050);
    const tExit = setTimeout(() => setStage("exit"), 1100);
    const tHide = setTimeout(() => {
      setStage("hidden");
      onComplete?.();
    }, 1350);

    return () => {
      clearTimeout(tHold);
      clearTimeout(tBox);
      clearTimeout(tCenter);
      clearTimeout(tExit);
      clearTimeout(tHide);
    };
  }, [onComplete]);

  if (stage === "hidden") return null;

  // Colors according to ZAKIR Brand Rules:
  // Light Mode Canvas: #F8FAFC
  // Dark Mode Canvas: #0B0F19
  // Standalone Symbol: Light = #1C2C58, Dark = #FFFFFF
  // 96x96 Box: Light = #1C2C58, Dark = #FFFFFF
  // Symbol inside 96x96 Box: Light = #FFFFFF, Dark = #1C2C58
  const bgClass = isLight ? "bg-[#F8FAFC]" : "bg-[#0B0F19]";
  const standaloneSymbolColor = isLight ? "#1C2C58" : "#FFFFFF";
  const boxBgColor = isLight ? "#1C2C58" : "#FFFFFF";
  const boxSymbolColor = isLight ? "#FFFFFF" : "#1C2C58";

  // Official ZAKIR 5 Vector Paths (DO NOT MODIFY PATH GEOMETRY)
  const pathD = {
    p1: "M778.26,359.34c-23.74-3.27-49.55-5.85-77.22-7.24-32.16-1.61-62.06-1.36-89.28,0,34.59-18.5,69.17-37,103.76-55.5,20.28,4.11,42.89,7.58,67.57,9.65,37.04,3.12,70.4,2.4,98.93,0-34.59,17.7-69.17,35.39-103.76,53.09Z",
    p2: "M980.96,516.19c-21.56-3.6-44.1-6.86-67.57-9.65-27.67-3.29-54.26-5.64-79.63-7.24,24.93-14.48,49.87-28.96,74.8-43.43,15.7,5.87,35.19,11.48,57.91,14.48,48.33,6.37,88.49-2.07,113.41-9.65-32.98,18.5-65.96,37-98.93,55.5Z",
    p3: "M475.42,511.37c-.4-63.57-.79-127.14-1.19-190.71,0-1.56.04-3.1.17-4.65,1.41-16.02,5.74-38.29,19.12-60.42,15.26-25.24,36.05-39.96,52.07-49.52,46.87-27.98,204.17-102.07,420.89-194.19,2.96-1.1,22.36-7.98,38.61,2.41,13.06,8.36,16.89,21.72,19.3,33.78.99,4.94,2.1,13.1,2.12,24.53,0,0-.21,16.42-4.53,33.38-3.15,12.35-9.18,25.16-15.95,36.88-15.63,27.06-38.86,48.92-66.57,63.37-2.2,1.15-4.45,2.32-6.75,3.51-28.29,14.65-50.15,25.27-62.74,31.37-57.83,28.01-105.24,50.16-105.24,50.16-109.27,51.04-121.53,55.26-155.36,75.32-51.75,30.67-69.27,48.18-82.04,65.15-22.18,29.47-31.7,59.55-36.2,79.63-.91,5.07-5.6,8.13-9.65,7.24-3.09-.68-5.58-3.59-6.03-7.24Z",
    p4: "M587.63,674.25c-2.01-24.5-3.65-49.86-4.83-76.01-1.24-27.45-1.89-54.07-2.06-79.79-.1-14.52,5.57-37.36,18.95-60.16,18.94-32.28,45.31-46.85,62.74-55.5,137.7-68.32,257.41-123.89,260.27-125.27,75.14-36.4,123.4-60.53,145.12-72.6,27.5-15.28,46.89-32.03,62.74-41.02,2.06-1.17,4.68-2.2,6.95-3.08,3.88-1.5,8.11-2.04,12.19-1.23,3.17.63,6.65,1.89,9.82,4.3,8.72,6.63,9.55,16.59,9.65,18.1,1.46,13.4,2.42,28.36,2.41,44.64,0,16.22-.96,31.12-2.41,44.49-1.5,12.31-5.42,31.71-16.89,52.03-18.54,32.86-45.69,49.14-57.91,55.5-88.79,45.49-177.58,90.98-266.37,136.48-51.58,25.47-85.43,42.05-105.24,51.74-34.68,16.96-62.99,28.56-86.87,55.5-9.82,11.07-16.26,18.95-21.72,28.96-3.96,7.25-5.57,13.62-7.24,21.72-.3,1.46-.76,3.36-1.71,5.25-3.58,7.17-13.97,7.19-16.83-.3-.44-1.16-.71-2.42-.76-3.74Z",
    p5: "M730.61,710.92l-.61,63.32c-.18,1.66-1.51,16.39,9.65,26.69,8.53,7.87,21.12,10.17,32.51,6.07,1.53-.55,2.98-1.29,4.41-2.05,119.91-63.73,238.88-125.06,359.77-191.26,9.25-5.07,29.79-21.27,44.89-54.06,11.49-24.94,14.48-48.26,15.27-61.09.4-6.48-.79-72.83-.79-72.83.52-9.04-4.44-17.31-12.07-20.51-6.75-2.84-14.8-1.38-20.72,3.5-7.47,6.16-15.25,11.96-23.88,16.35-108.82,55.31-218.13,109.42-326.98,164.68-6.15,3.12-12.18,6.5-17.97,10.25-12.15,7.87-28.07,20.18-42.39,41.7-.13.2-.26.39-.39.59-13.44,20.36-20.48,44.27-20.72,68.66Z",
  };

  const isExit = stage === "exit";
  const isBoxOrBeyond = stage === "box" || stage === "centered" || stage === "exit";

  return (
    <div
      id="zakir-loading-screen"
      className={`fixed inset-0 z-[99999] flex items-center justify-center select-none overflow-hidden ${bgClass}`}
      style={{
        transition:
          "opacity 250ms cubic-bezier(0.4, 0, 0.2, 1), transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isExit ? 0 : 1,
        transform: isExit ? "scale(0.97)" : "scale(1)",
        pointerEvents: isExit ? "none" : "auto",
      }}
      role="status"
      aria-label="Loading ZAKIR"
    >
      <style>{`
        /* 1. Phase 1: Fade In + Drawing/Reveal + Subtle Zoom (0 - 650ms) */
        @keyframes zakirDrawAndZoom {
          0% {
            opacity: 0;
            transform: scale(0.92);
            clip-path: polygon(-10% -10%, -10% -10%, -10% 110%, -10% 110%);
          }
          100% {
            opacity: 1;
            transform: scale(1.0);
            clip-path: polygon(-10% -10%, 110% -10%, 110% 110%, -10% 110%);
          }
        }

        /* 2. Phase 3: Box Emergence (800 - 1050ms) */
        @keyframes zakirBoxEmerge {
          0% {
            opacity: 0;
            transform: scale(0.90);
          }
          100% {
            opacity: 1;
            transform: scale(1.0);
          }
        }

        /* 3. Phase 3: Logo Scale Down inside Box (800 - 1050ms) */
        @keyframes zakirLogoScaleDown {
          0% {
            transform: scale(1.724);
          }
          100% {
            transform: scale(1.0);
          }
        }

        .zakir-draw-zoom {
          animation: zakirDrawAndZoom 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity, clip-path;
        }

        .zakir-box-appear {
          animation: zakirBoxEmerge 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .zakir-logo-scale-down {
          animation: zakirLogoScaleDown 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .zakir-draw-zoom,
          .zakir-box-appear,
          .zakir-logo-scale-down {
            animation: none !important;
            transform: none !important;
            clip-path: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Main Container System */}
      <div className="relative flex items-center justify-center">
        {!isBoxOrBeyond ? (
          /* ========================================================================= */
          /* STAGE 1 & 2 (0 - 800ms): Standalone Logo Drawing / Reveal & Hold          */
          /* ========================================================================= */
          <div className="zakir-draw-zoom relative flex items-center justify-center">
            <svg
              viewBox="474.23 0 728.85 810"
              xmlns="http://www.w3.org/2000/svg"
              className="block shrink-0 overflow-visible"
              style={{ width: "96px", height: "96px" }}
            >
              <g fill={standaloneSymbolColor}>
                <path d={pathD.p1} />
                <path d={pathD.p2} />
                <path d={pathD.p3} />
                <path d={pathD.p4} />
                <path d={pathD.p5} />
              </g>
            </svg>
          </div>
        ) : (
          /* ========================================================================= */
          /* STAGE 3 & 4 (800 - 1350ms): 96px x 96px App Box & Scaled Down Centered Logo */
          /* ========================================================================= */
          <div
            className="zakir-box-appear flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              width: "96px",
              height: "96px",
              minWidth: "96px",
              minHeight: "96px",
              maxWidth: "96px",
              maxHeight: "96px",
              borderRadius: "20px",
              backgroundColor: boxBgColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Logo Symbol Mathematically Centered Inside 96x96 Box */}
            <svg
              viewBox="474.23 0 728.85 810"
              xmlns="http://www.w3.org/2000/svg"
              className="zakir-logo-scale-down shrink-0 block"
              style={{ width: "56px", height: "56px" }}
            >
              <g fill={boxSymbolColor}>
                <path d={pathD.p1} />
                <path d={pathD.p2} />
                <path d={pathD.p3} />
                <path d={pathD.p4} />
                <path d={pathD.p5} />
              </g>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
