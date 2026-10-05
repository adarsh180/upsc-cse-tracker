import Link from "next/link";

import { SystemState } from "@/components/su/system-state";

export const metadata = { title: "Not found · Sacred Attempt" };

export default function NotFound() {
  return (
    <SystemState
      kicker="Off the syllabus"
      title="This page isn't on the map."
      body="The link may be old, or the topic was renamed. Search the syllabus from the top bar, or head back to the overview."
      code="404"
    >
      <Link href="/dashboard" className="su-btn su-btn-ink">Back to overview</Link>
      <Link href="/study/general-studies-1" className="su-btn">Open the syllabus</Link>
    </SystemState>
  );
}
