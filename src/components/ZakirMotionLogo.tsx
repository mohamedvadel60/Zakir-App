import React from "react";

export interface ZakirMotionLogoProps {
  size?: number | "sm" | "md" | "lg" | "xl" | "2xl";
  theme?: "light" | "dark" | "auto";
  showText?: boolean;
  withBox?: boolean;
  className?: string;
  loop?: boolean;
}

/**
 * ZAKIR Official Brand Motion System
 * 
 * Rebuilt strictly against official brand asset files:
 * - Light Mode: `Light Mode.txt` (Rect fill #1c2c58, Paths fill #ffffff)
 * - Dark Mode: `Dark Mode.txt` (Rect fill #ffffff, Paths fill #1c2c58)
 * - Exact SVG viewBox: `0 0 1435 1199.38`
 * - NO outer box / card / container / border / shadow behind logo.
 * - Responsive sizing and smooth SaaS initial motion graphic.
 */
export const ZakirMotionLogo: React.FC<ZakirMotionLogoProps> = ({
  size = "lg",
  theme = "dark",
  showText = false,
  className = "",
}) => {
  // Size calculations for standalone SVG logo
  let widthClass = "w-28 md:w-36 lg:w-40";
  let customStyle: React.CSSProperties = {};

  if (size === "sm") {
    widthClass = "w-16 md:w-20";
  } else if (size === "md") {
    widthClass = "w-24 md:w-28";
  } else if (size === "lg") {
    widthClass = "w-28 md:w-36 lg:w-40";
  } else if (size === "xl") {
    widthClass = "w-36 md:w-44";
  } else if (size === "2xl") {
    widthClass = "w-44 md:w-52";
  } else if (typeof size === "number") {
    widthClass = "";
    customStyle = { width: `${size}px`, height: "auto" };
  }

  const isLight = theme === "light";

  // Official Brand Colors from Light Mode.txt & Dark Mode.txt
  // Light Mode.txt: rect fill="#1c2c58", paths fill="#ffffff"
  // Dark Mode.txt:  rect fill="#ffffff", paths fill="#1c2c58"
  const rectFill = isLight ? "#1c2c58" : "#ffffff";
  const pathsFill = isLight ? "#ffffff" : "#1c2c58";
  const textColor = isLight ? "#1c2c58" : "#ffffff";

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none bg-transparent border-none p-0 m-0 ${className}`}
      style={{ willChange: "transform, opacity" }}
    >
      {/* CSS Animations for smooth 3-stage Motion Graphic sequence */}
      <style>{`
        @keyframes zakirLogoFadeScale {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1.0);
          }
        }

        @keyframes zakirCognitiveShimmer {
          0% {
            opacity: 0.9;
            filter: brightness(1);
          }
          50% {
            opacity: 1;
            filter: brightness(1.15) drop-shadow(0 0 10px ${isLight ? "rgba(28,44,88,0.2)" : "rgba(255,255,255,0.25)"});
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }

        .zakir-motion-svg-element {
          animation: zakirLogoFadeScale 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
          will-change: transform, opacity;
        }

        .zakir-motion-paths-group {
          animation: zakirCognitiveShimmer 750ms ease-in-out 300ms forwards;
          will-change: filter, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .zakir-motion-svg-element,
          .zakir-motion-paths-group {
            animation: none !important;
            transform: none !important;
            filter: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* SVG Logo directly without any outer box, card, or container */}
      <div
        className={`relative flex items-center justify-center bg-transparent border-none shadow-none ${widthClass}`}
        style={customStyle}
      >
        <svg
          id="zakir-official-motion-logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1435 1199.38"
          className="w-full h-auto block zakir-motion-svg-element"
          style={{ aspectRatio: "1435 / 1199.38" }}
        >
          {/* Spacer path from original asset */}
          <rect y="561.27" width="56" height="56" fill="none" />

          {/* Logo Rounded Rect from official Light/Dark Mode.txt */}
          <rect
            x="235.62"
            width="1199.38"
            height="1199.38"
            rx="262.36"
            ry="262.36"
            fill={rectFill}
          />

          {/* 5 Vector Paths from official Light/Dark Mode.txt */}
          <g className="zakir-motion-paths-group" fill={pathsFill}>
            <path d="M778.63,549.83c-23.73-3.27-49.53-5.85-77.18-7.24-32.15-1.61-62.03-1.36-89.24,0,34.57-18.49,69.14-36.98,103.71-55.47,20.27,4.1,42.87,7.57,67.53,9.65,37.02,3.12,70.37,2.39,98.89,0-34.57,17.69-69.14,35.37-103.71,53.06Z" />
            <path d="M981.22,706.61c-21.55-3.6-44.07-6.86-67.53-9.65-27.66-3.29-54.23-5.64-79.59-7.24,24.92-14.47,49.85-28.94,74.77-43.41,15.69,5.87,35.17,11.48,57.89,14.47,48.31,6.37,88.45-2.07,113.36-9.65-32.96,18.49-65.92,36.98-98.89,55.47Z" />
            <path d="M475.93,701.78c-.4-63.54-.79-127.08-1.19-190.62,0-1.55.04-3.1.17-4.65,1.41-16.02,5.73-38.28,19.11-60.39,15.25-25.22,36.03-39.94,52.05-49.5,46.85-27.96,204.08-102.02,420.68-194.1,2.95-1.1,22.35-7.98,38.59,2.41,13.05,8.35,16.88,21.71,19.3,33.77.99,4.94,2.1,13.09,2.12,24.52,0,0-.21,16.41-4.53,33.36-3.15,12.35-9.18,25.15-15.95,36.87-15.62,27.05-38.84,48.89-66.54,63.34-2.2,1.15-4.45,2.31-6.75,3.51-28.28,14.64-50.12,25.26-62.71,31.35-57.8,28-105.19,50.13-105.19,50.14-109.22,51.02-121.47,55.24-155.29,75.28-51.72,30.66-69.24,48.16-82,65.12-22.17,29.46-31.69,59.52-36.18,79.59-.91,5.07-5.6,8.12-9.65,7.24-3.09-.68-5.58-3.59-6.03-7.24Z" />
            <path d="M588.09,864.59c-2.01-24.49-3.65-49.83-4.82-75.97-1.24-27.44-1.89-54.04-2.06-79.75-.1-14.52,5.57-37.35,18.94-60.14,18.93-32.26,45.29-46.83,62.71-55.47,137.63-68.29,257.29-123.83,260.14-125.21,75.11-36.38,123.35-60.5,145.05-72.56,27.49-15.27,46.87-32.02,62.71-41,2.06-1.17,4.68-2.2,6.94-3.07,3.88-1.5,8.1-2.04,12.18-1.23,3.17.63,6.65,1.89,9.82,4.3,8.71,6.63,9.55,16.58,9.65,18.09,1.46,13.4,2.41,28.35,2.41,44.62,0,16.21-.96,31.11-2.41,44.47-1.5,12.31-5.42,31.69-16.88,52.01-18.53,32.84-45.67,49.12-57.89,55.47-88.75,45.47-177.49,90.94-266.24,136.41-51.56,25.46-85.39,42.03-105.19,51.72-34.66,16.95-62.96,28.55-86.83,55.47-9.81,11.07-16.25,18.95-21.71,28.94-3.96,7.25-5.57,13.62-7.24,21.71-.3,1.46-.76,3.36-1.71,5.25-3.58,7.17-13.97,7.18-16.83-.3-.44-1.16-.71-2.42-.76-3.74Z" />
            <path d="M731,901.24l-.61,63.29c-.18,1.66-1.51,16.38,9.65,26.68,8.53,7.87,21.11,10.17,32.5,6.06,1.53-.55,2.98-1.29,4.41-2.05,119.85-63.7,238.77-125,359.6-191.17,9.25-5.06,29.78-21.26,44.87-54.03,11.48-24.93,14.47-48.24,15.26-61.06.4-6.47-.79-72.8-.79-72.8.52-9.04-4.44-17.3-12.06-20.5-6.75-2.84-14.79-1.38-20.71,3.5-7.47,6.16-15.24,11.95-23.87,16.34-108.77,55.28-218.03,109.37-326.82,164.6-6.15,3.12-12.17,6.5-17.96,10.25-12.15,7.86-28.06,20.17-42.37,41.68-.13.2-.26.39-.39.59-13.44,20.35-20.47,44.24-20.71,68.63Z" />
          </g>
        </svg>
      </div>

      {/* Wordmark (Optional) */}
      {showText && (
        <div className="overflow-hidden mt-3">
          <span
            className="font-extrabold tracking-widest uppercase font-display block select-none text-xl"
            style={{ color: textColor }}
          >
            ZAKIR
          </span>
        </div>
      )}
    </div>
  );
};
