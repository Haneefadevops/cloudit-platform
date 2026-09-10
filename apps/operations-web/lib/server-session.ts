import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySessionToken } from "./session";

export async function requireOperationsSession() {
  const token = cookies().get(sessionCookieName)?.value;
  const session = await verifySessionToken(token, process.env.OPERATIONS_SESSION_SECRET);
  if (!session) redirect("/login");
  return session;
}
