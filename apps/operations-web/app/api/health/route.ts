import { NextResponse } from "next/server";
import { getOperationsRuntimeConfig } from "../../../lib/runtime-config";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getOperationsRuntimeConfig();
    return NextResponse.json({ status: "ok", service: "operations-web", checkedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "unavailable", service: "operations-web", checkedAt: new Date().toISOString() }, { status: 503 });
  }
}
