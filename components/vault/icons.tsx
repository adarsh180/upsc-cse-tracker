/* Forge icon set — drawn for the vault, not borrowed from the UPSC desk. */
type P = { size?: number; className?: string };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const ForgeMark = ({ size = 28, className }: P) => (
  <svg {...base(size)} viewBox="0 0 32 32" className={className}>
    <path d="M16 3 27 9.5v13L16 29 5 22.5v-13Z" />
    <path d="M16 9.5 21.5 12.7v6.6L16 22.5l-5.5-3.2v-6.6Z" className="fi-core" />
    <path d="M16 3v6.5M27 9.5l-5.5 3.2M27 22.5l-5.5-3.2M16 29v-6.5M5 22.5l5.5-3.2M5 9.5l5.5 3.2" opacity=".55" />
  </svg>
);
export const IconCore = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="8" strokeDasharray="2.5 2.5" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></svg>
);
export const IconGate = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-7h6v7" /><path d="M12 3v4" /></svg>
);
export const IconLab = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3" /><path d="M7.5 15h9" /></svg>
);
export const IconChip = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>
);
export const IconTrace = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 17h4l3-8 4 10 3-6h4" /></svg>
);
export const IconLog = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
export const IconBranch = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10M18 11c0 4-6 3-11 6" /></svg>
);
export const IconLock = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.2" /></svg>
);
export const IconSpark = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const IconBack = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M15 5 8 12l7 7" /></svg>
);
