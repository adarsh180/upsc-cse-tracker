export type TelegramPayload = {
  title: string;
  body: string;
  senderLabel?: string;
  tone?: string;
};

const TONE_EMOJI: Record<string, string> = {
  focus: "🎯",
  urgent: "🚨",
  care: "🤍",
  win: "🏆",
};

function cleanEnv(value: string | undefined) {
  return value?.replace(/['"]/g, "").trim() || "";
}

export function isTelegramConfigured() {
  return Boolean(cleanEnv(process.env.TELEGRAM_BOT_TOKEN) && cleanEnv(process.env.TELEGRAM_CHAT_ID));
}

export async function sendTelegramNotification(payload: TelegramPayload, baseUrl?: string | null) {
  const token = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const chatId = cleanEnv(process.env.TELEGRAM_CHAT_ID);

  if (!token || !chatId) {
    console.warn("[telegram] skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing.");
    return { sent: false, reason: "missing-config" };
  }

  const emoji = TONE_EMOJI[payload.tone?.toLowerCase() ?? "focus"] ?? "🔔";
  const lines = [
    `${emoji} <b>${escapeHtml(payload.title)}</b>`,
    payload.senderLabel ? `<i>from ${escapeHtml(payload.senderLabel)}</i>` : null,
    "",
    escapeHtml(payload.body),
  ].filter((line) => line !== null);

  if (baseUrl) {
    lines.push("", `<a href="${baseUrl}/dashboard">Open UPSC Tracker</a>`);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`[telegram] sendMessage failed: ${response.status} ${errorBody.slice(0, 200)}`);
      return { sent: false, status: response.status };
    }
    return { sent: true };
  } catch (error) {
    console.error("[telegram] network error:", error);
    return { sent: false, reason: "network" };
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
