import { UpscGuruShell } from "@/components/ai/upsc-guru-shell";
import { buildUPSCContext, listGuruConversations } from "@/lib/ai-context-builder";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";

export default async function GuruPage() {
  await requireSession();

  const context = await withDbRetry(() => buildUPSCContext());
  const conversations = await withDbRetry(() => listGuruConversations());
  const latestConversationId = conversations[0]?.id;
  const conversation = latestConversationId
    ? await withDbRetry(() =>
        db.aiConversation.findUnique({
          where: { id: latestConversationId },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              take: 40,
              include: {
                attachments: {
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        }),
      )
    : null;

  const avgDiscipline = context.recentDailyLogs.length
    ? (
        context.recentDailyLogs.reduce((sum, log) => sum + log.disciplineScore, 0) /
        context.recentDailyLogs.length
      ).toFixed(1)
    : "0.0";

  const serializedConversation = conversation
    ? {
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            kind: attachment.kind.toLowerCase() as "image" | "pdf",
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
          })),
          createdAt: message.createdAt.toISOString(),
        })),
      }
    : null;

  return (
    <main className="page-shell guru-page-shell">
      <UpscGuruShell
        conversations={conversations}
        conversation={serializedConversation}
        discipline={`${avgDiscipline}/100`}
        avgScore={`${context.testSummary.avgOverallPct}%`}
        focusTrend={`${context.moodSummary.avgFocus}/10`}
        memory={context.memory}
      />
    </main>
  );
}
