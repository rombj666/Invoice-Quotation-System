import type { Request } from "express";

export type MultipartFile = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

async function readRequestBody(req: Request, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limitBytes) {
      throw Object.assign(new Error("Upload is too large. Please use smaller files and try again."), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function parseMultipartRequest(req: Request, limitBytes = 40 * 1024 * 1024) {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error("Invalid multipart upload.");

  const body = (await readRequestBody(req, limitBytes)).toString("latin1");
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  for (const rawPart of body.split(`--${boundary}`)) {
    if (!rawPart || rawPart === "--\r\n" || rawPart === "--") continue;
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headerText = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + 4).replace(/\r\n--$/, "");
    const disposition = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headerText)?.[1] ?? "";
    const fieldName = /name="([^"]+)"/i.exec(disposition)?.[1];
    if (!fieldName) continue;
    const fileName = /filename="([^"]*)"/i.exec(disposition)?.[1];
    const mimeType = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() ?? "application/octet-stream";
    if (fileName) files.push({ fieldName, fileName, mimeType, buffer: Buffer.from(content, "latin1") });
    else fields[fieldName] = Buffer.from(content, "latin1").toString("utf8");
  }

  return { fields, files };
}
