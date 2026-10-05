import { Chakra } from "@/components/ui/chakra";

// Chakra turning around a small vessel of liquid. Every colour comes from the
// live tokens, so it follows light/dark and the minute palette.
export function SuLoader({ label = "Loading" }: { label?: string }) {
  const wave = "M0 10 Q12.5 0 25 10 T50 10 T75 10 T100 10 T125 10 T150 10 T175 10 T200 10 V200 H0 Z";
  return (
    <div className="su-loader" role="status" aria-live="polite">
      <div className="su-loader-orb">
        <Chakra size={190} />
        <div className="su-loader-bowl">
          <svg className="w2" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={wave} />
          </svg>
          <svg className="w1" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={wave} />
          </svg>
        </div>
      </div>
      <span className="su-loader-text">
        <b>{label}</b>
      </span>
    </div>
  );
}
