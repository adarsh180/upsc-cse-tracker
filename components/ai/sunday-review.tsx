import { format } from "date-fns";
import { CalendarCheck2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SundayReviewProps = {
  weekStart: Date;
  reportText: string;
};

export function SundayReviewCard({ weekStart, reportText }: SundayReviewProps) {
  return (
    <section className="db-section anim-fade-up">
      <article
        className="glass"
        style={{
          padding: "22px 24px",
          borderRadius: 18,
          border: "1px solid color-mix(in srgb, var(--gold-bright, #d4af37) 35%, transparent)",
        }}
      >
        <div className="db-section-title" style={{ marginBottom: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CalendarCheck2 size={16} style={{ color: "var(--gold-bright, #d4af37)" }} />
            Sunday Self-Review · week of {format(weekStart, "d MMM yyyy")}
          </span>
        </div>
        <div className="prose-invert" style={{ fontSize: 14, lineHeight: 1.65 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
        </div>
      </article>
    </section>
  );
}
