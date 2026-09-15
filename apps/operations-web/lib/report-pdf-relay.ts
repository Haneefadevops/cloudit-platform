import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

export type ReportPdfDisposition = "inline" | "attachment";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const RELAY_TIMEOUT_MS = 30_000;

type RelayConfig = { url: string; token: string; secret: string };

function relayConfig(): RelayConfig | null {
  const url = process.env.OPERATIONS_REPORT_PDF_RELAY_URL?.trim();
  const token = process.env.OPERATIONS_REPORT_PDF_RELAY_TOKEN?.trim();
  const secret = process.env.OPERATIONS_REPORT_PDF_RELAY_SECRET;
  if (!url || !token || !secret || token.length < 32 || secret.length < 32) return null;
  try {
    const parsed = new URL(url);
    const privateN8n = parsed.protocol === "http:" && parsed.hostname === "n8n";
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !privateN8n) return null;
    if (parsed.username || parsed.password || parsed.hash) return null;
  } catch {
    return null;
  }
  return { url, token, secret };
}

export function isReportPdfRelayConfigured(): boolean {
  return relayConfig() !== null;
}

export class ReportPdfRelayError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ReportPdfRelayError";
  }
}

async function verifyAndLimitPdfStream(
  body: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array>> {
  const reader = body.getReader();
  const primed: Uint8Array[] = [];
  let prefix = new Uint8Array(0);
  let total = 0;

  while (prefix.byteLength < 5) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_PDF_BYTES) {
      await reader.cancel();
      throw new ReportPdfRelayError(502, "PDF relay response is invalid");
    }
    primed.push(next.value);
    const combined = new Uint8Array(prefix.byteLength + next.value.byteLength);
    combined.set(prefix);
    combined.set(next.value, prefix.byteLength);
    prefix = combined;
  }

  if (prefix.byteLength < 5 || new TextDecoder().decode(prefix.slice(0, 5)) !== "%PDF-") {
    await reader.cancel();
    throw new ReportPdfRelayError(502, "PDF relay response is invalid");
  }

  let primedIndex = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (primedIndex < primed.length) {
        controller.enqueue(primed[primedIndex]);
        primedIndex += 1;
        return;
      }
      try {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          return;
        }
        total += next.value.byteLength;
        if (total > MAX_PDF_BYTES) {
          await reader.cancel();
          controller.error(new Error("PDF size limit exceeded"));
          return;
        }
        controller.enqueue(next.value);
      } catch {
        controller.error(new Error("PDF relay interrupted"));
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function retrieveReportPdf(
  reportKey: string,
  disposition: ReportPdfDisposition,
): Promise<ReadableStream<Uint8Array>> {
  const config = relayConfig();
  if (!config) throw new ReportPdfRelayError(503, "PDF retrieval is not configured");

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60;
  const nonce = randomBytes(32).toString("hex");
  const correlationId = randomUUID();
  const canonical = [reportKey, issuedAt, expiresAt, nonce, correlationId, disposition].join("\n");
  const signature = createHmac("sha256", config.secret).update(canonical).digest("hex");

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cloudit-pdf-relay-token": config.token,
      },
      body: JSON.stringify({
        reportKey,
        issuedAt,
        expiresAt,
        nonce,
        correlationId,
        disposition,
        signature,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  } catch {
    throw new ReportPdfRelayError(502, "PDF retrieval is temporarily unavailable");
  }

  if (!response.ok || !response.body) {
    throw new ReportPdfRelayError(
      response.status === 404 ? 404 : 502,
      response.status === 404 ? "Report PDF not found" : "PDF retrieval failed",
    );
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const contentLength = Number(response.headers.get("content-length"));
  if (
    contentType !== "application/pdf" ||
    (Number.isFinite(contentLength) && contentLength > MAX_PDF_BYTES)
  ) {
    await response.body.cancel();
    throw new ReportPdfRelayError(502, "PDF relay response is invalid");
  }
  return verifyAndLimitPdfStream(response.body);
}
