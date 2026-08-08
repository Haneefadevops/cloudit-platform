import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const TRADES = [
  'AC & Refrigeration',
  'Lifts',
  'Fire & Security',
  'Generators',
  'Facilities',
  'CCTV',
  'Other',
] as const;
const TEAM_SIZES = ['1–5', '6–15', '16+'] as const;
const CURRENT_METHODS = ['Paper', 'WhatsApp', 'Excel', 'Other software'] as const;
const BUSINESS_TYPES = ['Service contractor', 'In-house team', 'Both'] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sri Lankan mobile: 07XXXXXXXX, +947XXXXXXXX or 7XXXXXXXX
const PHONE_RE = /^(?:\+94|0)?7\d{8}$/;

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+94')) return cleaned;
  if (cleaned.startsWith('0')) return `+94${cleaned.slice(1)}`;
  return `+94${cleaned}`;
}

type SignupFields = {
  company: string;
  name: string;
  phone: string;
  email: string;
  trade: string;
  teamSize: string;
  currentMethod: string;
  businessType: string;
};

function validate(body: Record<string, unknown>): {
  data?: SignupFields;
  errors: Partial<Record<keyof SignupFields, string>>;
} {
  const errors: Partial<Record<keyof SignupFields, string>> = {};
  const str = (key: keyof SignupFields) =>
    typeof body[key] === 'string' ? (body[key] as string).trim() : '';

  const company = str('company');
  const name = str('name');
  const phone = str('phone');
  const email = str('email');
  const trade = str('trade');
  const teamSize = str('teamSize');
  const currentMethod = str('currentMethod');
  const businessType = str('businessType');

  if (!company) errors.company = 'Company name is required';
  if (!name) errors.name = 'Your name is required';

  const cleanedPhone = phone.replace(/[\s-]/g, '');
  if (!cleanedPhone) {
    errors.phone = 'Phone number is required';
  } else if (!PHONE_RE.test(cleanedPhone)) {
    errors.phone = 'Enter a valid Sri Lankan mobile number (e.g. 0771234567)';
  }

  if (!email) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!TRADES.includes(trade as (typeof TRADES)[number])) errors.trade = 'Select your trade';
  if (!TEAM_SIZES.includes(teamSize as (typeof TEAM_SIZES)[number]))
    errors.teamSize = 'Select your team size';
  if (!CURRENT_METHODS.includes(currentMethod as (typeof CURRENT_METHODS)[number]))
    errors.currentMethod = 'Select your current method';
  if (!BUSINESS_TYPES.includes(businessType as (typeof BUSINESS_TYPES)[number]))
    errors.businessType = 'Select your business type';

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    data: {
      company,
      name,
      phone: normalizePhone(phone),
      email: email.toLowerCase(),
      trade,
      teamSize,
      currentMethod,
      businessType,
    },
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'signups.json');

async function storeSignup(record: SignupFields & { submittedAt: string }) {
  await mkdir(DATA_DIR, { recursive: true });
  let existing: unknown[] = [];
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    // file missing or unreadable — start fresh
  }
  existing.push(record);
  await writeFile(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { data, errors } = validate(body ?? {});
  if (!data) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  try {
    await storeSignup({ ...data, submittedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to store pilot signup', err);
    return NextResponse.json(
      { ok: false, error: 'Could not save your signup. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}
