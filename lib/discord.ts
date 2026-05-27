export type DiscordPayload = {
  title: string;
  body: string;
  senderLabel: string;
  tone?: string;
};

// Maps tones to sleek, premium Discord sidebar colors (decimal format)
const TONE_COLORS: Record<string, number> = {
  focus: 2450411,    // Deep Blue (#2563EB)
  urgent: 14427686,  // Crimson Red (#DC2626)
  care: 14251782,    // Warm Amber (#D97706)
  win: 366185,       // Success Emerald (#059669)
};

export async function sendDiscordNotification(
  payload: DiscordPayload,
  baseUrl?: string | null
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      "[discord] Discord notification skipped: DISCORD_WEBHOOK_URL is missing in environment variables."
    );
    return { sent: false, reason: "missing-config" };
  }

  // Strip wrapping quotes if any
  const cleanWebhookUrl = webhookUrl.replace(/['"]/g, "");

  const tone = payload.tone?.toLowerCase() || "focus";
  const embedColor = TONE_COLORS[tone] || 6514417; // Fallback Indigo (#6366F1)

  // Append a beautiful markdown link to the dashboard at the bottom of the description
  let description = payload.body;
  if (baseUrl) {
    description += `\n\n[**🔗 Open UPSC Tracker**](${baseUrl}/dashboard)`;
  }

  // Construct a premium Rich Embed body
  const discordPayload = {
    username: "UPSC Tracker",
    embeds: [
      {
        title: payload.title,
        description: description,
        color: embedColor,
        author: {
          name: `🔔 ${payload.senderLabel}`,
        },
        footer: {
          text: "UPSC CSE Tracker Alert",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(cleanWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[discord] Discord webhook failed with status ${response.status}:`,
        errorText
      );
      return { sent: false, error: errorText };
    }

    console.log("[discord] Discord webhook notification sent successfully!");
    return { sent: true };
  } catch (error) {
    console.error("[discord] Network error sending Discord notification:", error);
    return { sent: false, error: String(error) };
  }
}
