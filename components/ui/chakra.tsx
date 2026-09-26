/** Line-art 24-spoke chakra, echoing the wheel on the logo's pedestal. */
export function Chakra({ className, size = 420 }: { className?: string; size?: number }) {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  if (size <= 40) {
    // Small inline mark: bolder strokes so the wheel stays legible.
    return (
      <svg
        className={className ? `nv-chakra ${className}` : "nv-chakra"}
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="88" strokeWidth="14" />
        <circle cx="100" cy="100" r="16" strokeWidth="14" />
        {spokes.map((deg) => (
          <line key={deg} x1="100" y1="84" x2="100" y2="18" strokeWidth="6" transform={`rotate(${deg} 100 100)`} />
        ))}
      </svg>
    );
  }
  return (
    <svg
      className={className ? `nv-chakra ${className}` : "nv-chakra"}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="96" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="90" strokeWidth="0.4" />
      <circle cx="100" cy="100" r="13" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="5" strokeWidth="0.6" />
      {spokes.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 100 100)`}>
          <path d="M100 87 Q101.6 50 100 12 Q98.4 50 100 87Z" strokeWidth="0.5" />
          <circle cx="100" cy="7" r="1.6" strokeWidth="0.5" />
        </g>
      ))}
    </svg>
  );
}
