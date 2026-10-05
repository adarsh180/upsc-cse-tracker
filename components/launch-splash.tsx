"use client";

import { useEffect, useState } from "react";

import { Chakra } from "@/components/ui/chakra";

// First-open splash (once per session). Colours come from the live theme and
// the minute palette, so it matches whatever the app is about to show.
export function LaunchSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("upsc-launch-seen-v3")) return;
      window.sessionStorage.setItem("upsc-launch-seen-v3", "1");
    } catch {
      // A blocked storage API should not prevent the app from opening.
    }

    setVisible(true);
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1500);
    const hideTimer = window.setTimeout(() => setVisible(false), 2100);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`su-splash ${leaving ? "leaving" : ""}`} aria-hidden="true">
      <div className="su-splash-mark">
        <Chakra size={420} />
        <div className="su-splash-lens su-glass">
          <img src="/upsc-logo-mark.png" alt="" />
        </div>
      </div>
      <div className="su-splash-copy">
        <span>Sacred Attempt · CSE 2027</span>
        <strong>Adarsh</strong>
      </div>
    </div>
  );
}
