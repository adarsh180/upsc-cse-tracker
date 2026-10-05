import { Chakra } from "@/components/ui/chakra";

/** Shared layout for error, not-found and offline screens. */
export function SystemState({
  kicker,
  title,
  body,
  children,
  code,
}: {
  kicker: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  code?: string;
}) {
  return (
    <main className="ss">
      <div className="ss-wheel" aria-hidden="true">
        <Chakra size={720} />
        {code ? <span className="ss-code su-dot">{code}</span> : null}
      </div>
      <div className="ss-copy">
        <span className="su-fig-label">{kicker}</span>
        <h1>{title}</h1>
        <p>{body}</p>
        {children ? <div className="ss-actions">{children}</div> : null}
      </div>
    </main>
  );
}
