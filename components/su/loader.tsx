import { Chakra } from "@/components/ui/chakra";

// The official seal: a turning ring of text with a progress arc drawing round
// it, and a slow chakra on a glass disc at the exact centre. Colours come from the live accent,
// so it follows light/dark and the minute palette.
export function SealMark({ size = 168, label = "SACRED ATTEMPT · CSE 2027 · SATYAMEVA JAYATE · " }: { size?: number; label?: string }) {
  return (
    <span className="su-seal" style={{ "--seal": `${size}px` } as React.CSSProperties} aria-hidden="true">
      <svg className="su-seal-ring" viewBox="0 0 200 200">
        <defs>
          <path id="su-seal-path" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
        </defs>
        <circle className="su-seal-track" cx="100" cy="100" r="94" />
        <circle className="su-seal-arc" cx="100" cy="100" r="94" pathLength={100} />
        <circle className="su-seal-inner" cx="100" cy="100" r="58" />
        <g className="su-seal-text">
          <text>
            <textPath href="#su-seal-path" startOffset="0" textLength={462} lengthAdjust="spacing">
              {label}
            </textPath>
          </text>
        </g>
      </svg>
      <span className="su-seal-core">
        <Chakra size={120} />
      </span>
    </span>
  );
}

export function SuLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="su-loader" role="status" aria-live="polite">
      <SealMark />
      <span className="su-loader-text">{label}</span>
    </div>
  );
}
