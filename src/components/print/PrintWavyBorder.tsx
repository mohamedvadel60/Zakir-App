import React from "react";
import { WavySideStyle } from "./printTypes";

interface PrintWavyBorderProps {
  style?: WavySideStyle;
  color?: string;
  thickness?: number;
  height?: string | number;
  className?: string;
  side?: "right" | "left";
}

export const PrintWavyBorder: React.FC<PrintWavyBorderProps> = ({
  style = "calligraphic",
  color = "#0f172a",
  thickness = 1.5,
  height = "100%",
  className = "",
  side = "right",
}) => {
  return (
    <div
      className={`zakir-print-wavy-border flex flex-col items-center justify-between pointer-events-none select-none ${className}`}
      style={{
        width: "28px",
        height: typeof height === "number" ? `${height}px` : height,
        color: color,
        position: "relative",
      }}
      aria-hidden="true"
    >
      {/* Top Calligraphic Ornament / Motif */}
      <div className="flex flex-col items-center justify-center shrink-0 pt-1 pb-1">
        {style === "calligraphic" ? (
          <div className="flex flex-col items-center">
            {/* Calligraphic 'نّي' emblem with diacritic dots */}
            <div className="text-[15px] font-serif font-black leading-none tracking-tighter" style={{ color }}>
              نّي
            </div>
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
              <span className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: color }} />
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
            </div>
          </div>
        ) : style === "arabesque" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={thickness}>
            <path d="M12 2L15 8L21 9L16.5 13.5L18 20L12 16.5L6 20L7.5 13.5L3 9L9 8L12 2Z" fill={color} fillOpacity="0.1" />
            <circle cx="12" cy="12" r="3" fill={color} />
          </svg>
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="w-2 h-2 rotate-45 border" style={{ borderColor: color, backgroundColor: color }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        )}
      </div>

      {/* Center Continuous Vertical Wavy Line / Ribbon */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden my-1">
        {style === "double-wave" ? (
          /* Double Sinusoidal Wave SVG */
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 24 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 0 Q14 25 8 50 T8 100 T8 150 T8 200 T8 250 T8 300 T8 350 T8 400 T8 450 T8 500 T8 550 T8 600"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
            <path
              d="M16 0 Q10 25 16 50 T16 100 T16 150 T16 200 T16 250 T16 300 T16 350 T16 400 T16 450 T16 500 T16 550 T16 600"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          </svg>
        ) : style === "geometric" ? (
          /* Geometric Zigzag & Dots SVG */
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 20 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 0 L15 25 L5 50 L15 75 L5 100 L15 125 L5 150 L15 175 L5 200 L15 225 L5 250 L15 275 L5 300 L15 325 L5 350 L15 375 L5 400 L15 425 L5 450 L15 475 L5 500 L15 525 L5 550 L15 575 L10 600"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          /* Classic Smooth Wavy Ribbon (Matching hand-drawn diagram) */
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 20 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Elegant harmonic wave */}
            <path
              d="M10 0 C16 15 4 30 10 45 C16 60 4 75 10 90 C16 105 4 120 10 135 C16 150 4 165 10 180 C16 195 4 210 10 225 C16 240 4 255 10 270 C16 285 4 300 10 315 C16 330 4 345 10 360 C16 375 4 390 10 405 C16 420 4 435 10 450 C16 465 4 480 10 495 C16 510 4 525 10 540 C16 555 4 570 10 585 L10 600"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
            {/* Small decorative rhythmic dots along the wave */}
            <circle cx="10" cy="150" r="1.5" fill={color} />
            <circle cx="10" cy="300" r="2" fill={color} />
            <circle cx="10" cy="450" r="1.5" fill={color} />
          </svg>
        )}
      </div>

      {/* Bottom Calligraphic Ornament / Motif */}
      <div className="flex flex-col items-center justify-center shrink-0 pt-1 pb-1">
        {style === "calligraphic" ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5 mb-0.5">
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
              <span className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: color }} />
              <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
            </div>
            {/* Calligraphic 'نّي' bottom terminal */}
            <div className="text-[15px] font-serif font-black leading-none tracking-tighter" style={{ color }}>
              نّي
            </div>
          </div>
        ) : style === "arabesque" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={thickness}>
            <path d="M12 22L15 16L21 15L16.5 10.5L18 4L12 7.5L6 4L7.5 10.5L3 15L9 16L12 22Z" fill={color} fillOpacity="0.1" />
            <circle cx="12" cy="12" r="3" fill={color} />
          </svg>
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="w-2 h-2 rotate-45 border" style={{ borderColor: color, backgroundColor: color }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        )}
      </div>
    </div>
  );
};
