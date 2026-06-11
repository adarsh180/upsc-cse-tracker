import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { istDayKey } from "@/lib/current-affairs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint: open /api/cron/status?key=<CRON_SECRET> in a browser
 * to see whether the morning/evening jobs actually ran and which
 * notification channels are configured. Read-only, makes no changes.
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayKey = istDayKey();
  const [todayDigest, latestDigest, latestNotifications, pushSubscriptions] = await Promise.all([
    db.currentAffairsDigest.findUnique({ where: { digestDate: todayKey }, select: { createdAt: true } }),
    db.currentAffairsDigest.findFirst({ orderBy: { digestDate: "desc" }, select: { digestDate: true } }),
    db.appNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true, senderLabel: true, createdAt: true },
    }),
    db.pushSubscription.count().catch(() => -1),
  ]);

  return NextResponse.json({
    ok: true,
    nowUTC: new Date().toISOString(),
    todayDigestCreated: Boolean(todayDigest),
    todayDigestCreatedAt: todayDigest?.createdAt ?? null,
    latestDigestDate: latestDigest?.digestDate ?? null,
    latestNotifications,
    pushSubscriptionCount: pushSubscriptions,
    channelsConfigured: {
      webPushVapid: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      discord: Boolean(process.env.DISCORD_WEBHOOK_URL),
      cronSecretSet: Boolean(process.env.CRON_SECRET),
    },
    hint: "If todayDigestCreated is false after 8:00 AM IST, the Vercel cron did not fire — check Vercel > Project > Settings > Cron Jobs (enabled + CRON_SECRET set in Vercel env). Trigger manually: /api/cron/morning?key=<CRON_SECRET>",
  });
}
