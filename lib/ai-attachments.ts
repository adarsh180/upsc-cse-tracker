import pdfParse from "pdf-parse";

const MAX_ATTACHMENTS = 6;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PDF_EXTRACTED_TEXT = 16000;
const MAX_COMBINED_ATTACHMENT_TEXT = 24000;

export type StoredAttachmentRecord = {
  kind: "image" | "pdf";
  name: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
};

export type ProcessedAttachment = StoredAttachmentRecord & {
  contentPart:
    | {
        type: "image";
        image: Buffer;
        mediaType: string;
      }
    | {
        type: "file";
        data: Buffer;
        filename: string;
        mediaType: string;
      };
};

function sanitizeName(name: string) {
  const trimmed = name.trim();
  return trimmed.length ? trimmed.slice(0, 180) : "attachment";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function isPdf(mimeType: string) {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export async function processIncomingAttachments(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_ATTACHMENTS} files in one message.`);
  }

  const processed = await Promise.all(
    files.map(async (file) => {
      if (!isPdf(file.type) && !isImage(file.type)) {
        throw new Error(`Unsupported file type for ${file.name}. Use images or PDFs only.`);
      }

      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name} is too large. Keep each file under 4 MB for reliable Vercel uploads.`);
      }

      const name = sanitizeName(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());

      if (isPdf(file.type)) {
        const parsed = await pdfParse(buffer);
        const extractedText = truncate(parsed.text.replace(/\s+\n/g, "\n").trim(), MAX_PDF_EXTRACTED_TEXT);

        return {
          kind: "pdf" as const,
          name,
          mimeType: file.type,
          sizeBytes: file.size,
          extractedText: extractedText || null,
          contentPart: {
            type: "file" as const,
            data: buffer,
            filename: name,
            mediaType: file.type,
          },
        };
      }

      return {
        kind: "image" as const,
        name,
        mimeType: file.type,
        sizeBytes: file.size,
        extractedText: null,
        contentPart: {
          type: "image" as const,
          image: buffer,
          mediaType: file.type,
        },
      };
    }),
  );

  return processed;
}

export function buildAttachmentContextText(attachments: StoredAttachmentRecord[]) {
  if (!attachments.length) return "";

  const sections = attachments.map((attachment, index) => {
    if (attachment.kind === "pdf") {
      return [
        `Attachment ${index + 1}: PDF`,
        `Name: ${attachment.name}`,
        attachment.extractedText ? `Extracted text:\n${attachment.extractedText}` : "Extracted text: unavailable",
      ].join("\n");
    }

    return [
      `Attachment ${index + 1}: Image`,
      `Name: ${attachment.name}`,
      `Mime type: ${attachment.mimeType}`,
      "Inspect the image directly before answering.",
    ].join("\n");
  });

  return truncate(sections.join("\n\n"), MAX_COMBINED_ATTACHMENT_TEXT);
}

export function buildAttachmentDisplayLabel(attachments: Pick<StoredAttachmentRecord, "name">[]) {
  if (!attachments.length) return "";
  return attachments.map((attachment) => attachment.name).join(", ");
}
