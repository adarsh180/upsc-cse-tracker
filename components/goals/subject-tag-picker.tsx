"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, Plus, Search, X } from "lucide-react";

export type SubjectGroup = { paper: string; accent: string; subjects: string[] };

export function SubjectTagPicker({
  groups,
  name = "subjectsCovered",
  defaultSelected = [],
}: {
  groups: SubjectGroup[];
  name?: string;
  defaultSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");

  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);

  const accentFor = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => g.subjects.forEach((s) => map.set(s.toLowerCase(), g.accent)));
    return map;
  }, [groups]);

  const toggle = (subject: string) => {
    setSelected((cur) =>
      cur.some((s) => s.toLowerCase() === subject.toLowerCase())
        ? cur.filter((s) => s.toLowerCase() !== subject.toLowerCase())
        : [...cur, subject],
    );
  };

  const remove = (subject: string) =>
    setSelected((cur) => cur.filter((s) => s.toLowerCase() !== subject.toLowerCase()));

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (!selectedSet.has(value.toLowerCase())) setSelected((cur) => [...cur, value]);
    setCustom("");
  };

  const q = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((g) => ({ ...g, subjects: q ? g.subjects.filter((s) => s.toLowerCase().includes(q)) : g.subjects }))
    .filter((g) => g.subjects.length > 0);

  return (
    <div className="tp">
      <input type="hidden" name={name} value={selected.join(", ")} />

      <div className="tp-tray" data-empty={selected.length === 0 || undefined}>
        <div className="tp-tray-head">
          <span className="lg-label">Covered today</span>
          <span className="tp-count">
            {selected.length}
            {selected.length > 0 ? (
              <button type="button" onClick={() => setSelected([])}>
                clear
              </button>
            ) : null}
          </span>
        </div>
        {selected.length > 0 ? (
          <div className="tp-tray-chips">
            {selected.map((s) => (
              <button
                key={s}
                type="button"
                className="tp-chip is-on"
                style={{ "--c": accentFor.get(s.toLowerCase()) ?? "var(--nv-a3)" } as CSSProperties}
                onClick={() => remove(s)}
                title="Remove"
              >
                {s}
                <X size={12} />
              </button>
            ))}
          </div>
        ) : (
          <p className="tp-tray-empty">Tap the subjects you actually touched. They feed the staleness radar.</p>
        )}
      </div>

      <div className="tp-controls">
        <label className="tp-search">
          <Search size={14} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter subjects" />
        </label>
        <div className="tp-add">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom area"
          />
          <button type="button" onClick={addCustom} aria-label="Add custom tag">
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="tp-groups">
        {filteredGroups.map((g) => (
          <div key={g.paper} className="tp-group" style={{ "--c": g.accent } as CSSProperties}>
            <div className="tp-group-label">{g.paper}</div>
            <div className="tp-group-chips">
              {g.subjects.map((s) => {
                const on = selectedSet.has(s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    className={`tp-chip${on ? " is-on" : ""}`}
                    onClick={() => toggle(s)}
                    aria-pressed={on}
                  >
                    <span className="tp-tick" aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 ? (
          <div className="tp-none">No subjects match &ldquo;{query}&rdquo;. Add it as a custom area.</div>
        ) : null}
      </div>
    </div>
  );
}
