import { UpscGuruShell } from "@/components/ai/upsc-guru-shell";
import { buildUPSCContext, listGuruConversations } from "@/lib/ai-context-builder";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";
import { db } from "@/lib/db";

export default async function GuruPage() {
  await requireSession();

  const [summary, context, conversation, conversations] = await Promise.all([
    getDashboardSummary(),
    buildUPSCContext(),
    db.aiConversation.findFirst({
      where: { persona: "guru" },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 40,
        },
      },
    }),
    listGuruConversations(),
  ]);

  const serializedConversation = conversation
    ? {
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      }
    : null;

  return (
    <main className="page-shell guru-page-shell">
      <UpscGuruShell
        conversations={conversations}
        conversation={serializedConversation}
        discipline={summary.metrics?.[2]?.value ?? "0/100"}
        avgScore={summary.metrics?.[1]?.value ?? "0%"}
        focusTrend={summary.metrics?.[3]?.value ?? "0/10"}
        memory={context.memory}
      />
    </main>
  );
}
