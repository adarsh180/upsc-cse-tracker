"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, Plus, Search, Tag, X } from "lucide-react";

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
    <div className="subject-picker">
      <input type="hidden" name={name} value={selected.join(", ")} />

      <div className="subject-picker-head">
        <span className="subject-picker-label">
          <Tag size={13} />
          Subjects covered today
        </span>
        <div className="subject-picker-head-right">
          <span className="subject-picker-count">{selected.length} selected</span>
          {selected.length > 0 && (
            <button type="button" className="subject-picker-clear" onClick={() => setSelected([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="subject-picker-selected">
          {selected.map((s) => (
            <button
              key={s}
              type="button"
              className="subject-chip selected removable"
              style={{ "--chip-accent": accentFor.get(s.toLowerCase()) ?? "var(--lotus-bright)" } as CSSProperties}
              onClick={() => remove(s)}
              title="Remove"
            >
              {s}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="subject-picker-controls">
        <label className="subject-picker-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter subjects…"
          />
        </label>
        <div className="subject-picker-add">
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
            placeholder="Add custom area…"
          />
          <button type="button" onClick={addCustom} title="Add custom tag" aria-label="Add custom tag">
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="subject-picker-groups">
        {filteredGroups.map((g) => (
          <div key={g.paper} className="subject-picker-group" style={{ "--group-accent": g.accent } as CSSProperties}>
            <div className="subject-picker-group-label">
              <i />
              {g.paper}
            </div>
            <div className="subject-picker-chip-row">
              {g.subjects.map((s) => {
                const on = selectedSet.has(s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    className={`subject-chip${on ? " selected" : ""}`}
                    style={{ "--chip-accent": g.accent } as CSSProperties}
                    onClick={() => toggle(s)}
                    aria-pressed={on}
                  >
                    {on ? <Check size={12} /> : null}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="subject-picker-empty">No subjects match "{query}". Add it as a custom area above.</div>
        )}
      </div>
    </div>
  );
}
