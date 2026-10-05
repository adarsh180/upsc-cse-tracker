// Re-mounts on every navigation, so each page arrives with a soft rise.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="su-enter">{children}</div>;
}
