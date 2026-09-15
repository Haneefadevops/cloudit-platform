import { NextRequest } from "next/server";
import { requireOperationsSession } from "../../../../../lib/server-session";
import {
  ReportPdfRelayError,
  retrieveReportPdf,
  type ReportPdfDisposition,
} from "../../../../../lib/report-pdf-relay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_KEY = /^[a-z0-9][a-z0-9_.-]{1,120}$/;

function safeHeaders(disposition: ReportPdfDisposition, reportKey: string): HeadersInit {
  const safeKey = reportKey.replace(/[^a-z0-9.-]+/gi, "-").slice(0, 100);
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": "application/pdf",
    "Content-Disposition": `${disposition}; filename="${safeKey}.pdf"`,
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { reportKey: string } },
) {
  await requireOperationsSession();
  const reportKey = params.reportKey;
  const requestedDisposition = request.nextUrl.searchParams.get("disposition");
  const disposition: ReportPdfDisposition =
    requestedDisposition === "attachment" ? "attachment" : "inline";

  if (
    !REPORT_KEY.test(reportKey) ||
    (requestedDisposition !== null && requestedDisposition !== disposition)
  ) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const stream = await retrieveReportPdf(reportKey, disposition);
    return new Response(stream, { status: 200, headers: safeHeaders(disposition, reportKey) });
  } catch (error) {
    const status = error instanceof ReportPdfRelayError ? error.status : 502;
    const message = error instanceof ReportPdfRelayError ? error.message : "PDF retrieval failed";
    return Response.json(
      { message },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
