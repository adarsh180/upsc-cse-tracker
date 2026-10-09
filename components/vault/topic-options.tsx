import type { TopicRow, TrackRow } from "@/lib/vault/metrics";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

/** <option>s for a topic picker: each stage's manual concepts plus your extra topics, then your tracks. */
export function TopicOptions({ topics, tracks }: { topics: TopicRow[]; tracks: TrackRow[] }) {
  return (
    <>
      <option value="">— whole stage / none —</option>
      {ROADMAP.stages.map((s) => (
        <optgroup key={s.n} label={`${String(s.n).padStart(2, "0")} · ${titleCase(s.title)}`}>
          {s.concepts.map((c, i) => <option key={i} value={`s${s.n}.c${i}`}>{c.title}</option>)}
          {topics.filter((t) => t.stage === s.n).map((t) => <option key={t.id} value={`t.${t.id}`}>{t.name} (yours)</option>)}
        </optgroup>
      ))}
      {topics.some((t) => t.stage === 14) ? (
        <optgroup label="14 · Capstone">
          {topics.filter((t) => t.stage === 14).map((t) => <option key={t.id} value={`t.${t.id}`}>{t.name}</option>)}
        </optgroup>
      ) : null}
      {tracks.map((tr) => {
        const own = topics.filter((t) => t.trackId === tr.id);
        return own.length ? (
          <optgroup key={tr.id} label={`Track · ${tr.name}`}>
            {own.map((t) => <option key={t.id} value={`t.${t.id}`}>{t.name}</option>)}
          </optgroup>
        ) : null;
      })}
    </>
  );
}
