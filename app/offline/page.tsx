import Link from "next/link";

import { SystemState } from "@/components/su/system-state";

export const metadata = {
  title: "Offline · Sacred Attempt",
};

export default function OfflinePage() {
  return (
    <SystemState
      kicker="Offline mode"
      title="You're offline. The tracker isn't."
      body="Cached pages still open, and mood, study, topic, test and task changes queue safely — they replay the moment the connection returns. Live sync, AI analysis and fresh analytics need internet."
    >
      <Link href="/dashboard" className="su-btn su-btn-ink">Try the overview again</Link>
    </SystemState>
  );
}
