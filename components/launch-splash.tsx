"use client";

import { useEffect, useState } from "react";

import { SealMark } from "@/components/su/loader";

// First-open splash (once per session): the seal stamps in, the name rises,
// then it all lifts away. Colours follow the live theme and minute palette.
export function LaunchSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("upsc-launch-seen-v4")) return;
      window.sessionStorage.setItem("upsc-launch-seen-v4", "1");
    } catch {
      // A blocked storage API should not prevent the app from opening.
    }

    setVisible(true);
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1600);
    const hideTimer = window.setTimeout(() => setVisible(false), 2200);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`su-splash ${leaving ? "leaving" : ""}`} aria-hidden="true">
      <SealMark size={200} />
      <div className="su-splash-copy">
        <span>Sacred Attempt · CSE 2027</span>
        <strong>Adarsh</strong>
      </div>
    </div>
  );
}
