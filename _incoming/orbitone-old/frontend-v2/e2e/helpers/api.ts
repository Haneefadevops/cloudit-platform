import type { APIRequestContext, BrowserContext } from "@playwright/test";
import type {
  Customer,
  CustomerInput,
  MeetingType,
  MeetingTypeInput,
  Profile,
  ProfileInput,
  User,
  Plan,
} from "../../src/lib/contracts";

export const API_BASE_URL = "http://localhost:8000/api";

export type TestUser = { email: string; password: string; fullName: string };

export async function registerUser(
  request: APIRequestContext,
  user: TestUser
): Promise<User> {
  const res = await request.post(`${API_BASE_URL}/v2/auth/register`, {
    data: user,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`register failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function loginUser(
  request: APIRequestContext,
  user: TestUser
): Promise<User> {
  const res = await request.post(`${API_BASE_URL}/v2/auth/login`, {
    data: { email: user.email, password: user.password },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`login failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function updateProfile(
  request: APIRequestContext,
  input: ProfileInput
): Promise<Profile> {
  const res = await request.put(`${API_BASE_URL}/v2/profiles/me`, {
    data: input,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`updateProfile failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function upgradePlan(
  request: APIRequestContext,
  plan: Plan
): Promise<User> {
  const res = await request.post(`${API_BASE_URL}/v2/billing/upgrade`, {
    data: { plan },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`upgradePlan failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function createOrganization(
  request: APIRequestContext,
  input: { slug: string; name: string; industry?: string | null }
) {
  const res = await request.post(`${API_BASE_URL}/v2/organizations`, {
    data: input,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`createOrganization failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function createMeetingType(
  request: APIRequestContext,
  input: MeetingTypeInput
): Promise<MeetingType> {
  const res = await request.post(`${API_BASE_URL}/v2/scheduling/meeting-types`, {
    data: input,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`createMeetingType failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function updateAvailability(
  request: APIRequestContext,
  rules: { dayOfWeek: number; startTime: string; endTime: string; timezone: string; isActive?: boolean }[],
  exceptions: unknown[] = []
) {
  const res = await request.put(`${API_BASE_URL}/v2/scheduling/availability`, {
    data: { rules, exceptions },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`updateAvailability failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function createCustomer(
  request: APIRequestContext,
  input: CustomerInput
): Promise<Customer> {
  const res = await request.post(`${API_BASE_URL}/v2/customers`, {
    data: input,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`createCustomer failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

export async function seedHost(
  request: APIRequestContext,
  slug: string,
  plan: "free" | "pro_individual" | "pro_business_starter" | "pro_business_growth" | "pro_business_enterprise" = "pro_individual"
) {
  const user = await registerUser(request, {
    email: `${slug}@test.orbitone.local`,
    password: "Password123!",
    fullName: `Test ${slug}`,
  });
  await loginUser(request, {
    email: `${slug}@test.orbitone.local`,
    password: "Password123!",
    fullName: `Test ${slug}`,
  });

  if (plan.startsWith("pro_business")) {
    await createOrganization(request, { slug: `org-${slug}`, name: `Org ${slug}` });
  } else if (plan === "pro_individual") {
    await upgradePlan(request, plan);
  }

  const profile = await updateProfile(request, {
    slug,
    fullName: `Test ${slug}`,
    headline: "Test headline",
    email: `${slug}@test.orbitone.local`,
    isPublished: true,
  });
  return { user, profile };
}

export async function applySessionToContext(
  request: APIRequestContext,
  context: BrowserContext
) {
  const state = await request.storageState();
  if (state.cookies.length > 0) {
    await context.addCookies(
      state.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as "Strict" | "Lax" | "None",
      }))
    );
  }
}
