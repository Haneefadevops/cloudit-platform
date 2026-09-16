import { NextRequest } from "next/server";
import {
  getReportCommands,
  OperationsApiError,
} from "../../../../../lib/operations-api";
import { requireOperationsSession } from "../../../../../lib/server-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_KEY = /^[a-z0-9][a-z0-9_.-]{1,120}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: { reportKey: string } },
) {
  await requireOperationsSession();
  const reportKey = params.reportKey;
  if (!REPORT_KEY.test(reportKey)) {
    return Response.json(
      { message: "Not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  try {
    // platform-api returns safe fields only; pass through verbatim.
    const commands = await getReportCommands(reportKey);
    return Response.json(commands, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status =
      error instanceof OperationsApiError && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 502;
    const message =
      error instanceof OperationsApiError
        ? error.message
        : "Command history is temporarily unavailable";
    return Response.json(
      { message },
      { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
