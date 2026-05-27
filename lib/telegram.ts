export type TelegramPayload = {
  title: string;
  body: string;
  senderLabel: string;
};

export async function sendTelegramNotification(
  payload: TelegramPayload,
  baseUrl?: string | null
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[telegram] Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in environment variables."
    );
    return { sent: false, reason: "missing-config" };
  }

  // Strip wrapping quotes if any
  const cleanToken = token.replace(/['"]/g, "");
  const cleanChatId = chatId.replace(/['"]/g, "");

  // Format a premium notification body using HTML formatting (more robust than MarkdownV2)
  const escapedSender = escapeHtml(payload.senderLabel);
  const escapedTitle = escapeHtml(payload.title);
  const escapedBody = escapeHtml(payload.body);

  const text = `🔔 <b>${escapedSender}</b>\n\n<b>${escapedTitle}</b>\n${escapedBody}`;

  const telegramUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  // Build the inline button to open the dashboard if a baseUrl is available
  const replyMarkup = baseUrl
    ? {
        inline_keyboard: [
          [
            {
              text: "🔗 Open UPSC Tracker",
              url: `${baseUrl}/dashboard`,
            },
          ],
        ],
      }
    : undefined;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[telegram] Telegram send failed with status ${response.status}:`,
        errorText
      );
      return { sent: false, error: errorText };
    }

    console.log("[telegram] Telegram notification sent successfully!");
    return { sent: true };
  } catch (error) {
    console.error("[telegram] Network error sending Telegram notification:", error);
    return { sent: false, error: String(error) };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
