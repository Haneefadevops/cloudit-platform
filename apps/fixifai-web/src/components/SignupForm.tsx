'use client';

import { ChangeEvent, FormEvent, useState } from 'react';

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/25';
const inputErrorClass =
  'w-full rounded-xl border border-red-400 bg-white px-4 py-2.5 text-sm transition-colors focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sri Lankan mobile: 07XXXXXXXX, +947XXXXXXXX or 7XXXXXXXX
const PHONE_RE = /^(?:\+94|0)?7\d{8}$/;

const TRADES = [
  'AC & Refrigeration',
  'Lifts',
  'Fire & Security',
  'Generators',
  'Facilities',
  'CCTV',
  'Other',
];
const TEAM_SIZES = ['1–5', '6–15', '16+'];
const CURRENT_METHODS = ['Paper', 'WhatsApp', 'Excel', 'Other software'];
const BUSINESS_TYPES = ['Service contractor', 'In-house team', 'Both'];

type FieldName =
  | 'company'
  | 'name'
  | 'phone'
  | 'email'
  | 'trade'
  | 'teamSize'
  | 'currentMethod'
  | 'businessType';

type Errors = Partial<Record<FieldName, string>>;

function validate(values: Record<FieldName, string>): Errors {
  const errors: Errors = {};

  if (!values.company.trim()) errors.company = 'Company name is required';
  if (!values.name.trim()) errors.name = 'Your name is required';

  const phone = values.phone.replace(/[\s-]/g, '');
  if (!phone) {
    errors.phone = 'Phone number is required';
  } else if (!PHONE_RE.test(phone)) {
    errors.phone = 'Enter a valid Sri Lankan mobile number (e.g. 0771234567)';
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!values.trade) errors.trade = 'Select your trade';
  if (!values.teamSize) errors.teamSize = 'Select your team size';
  if (!values.currentMethod) errors.currentMethod = 'Select your current method';
  if (!values.businessType) errors.businessType = 'Select your business type';

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

export default function SignupForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');

  function clearError(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const field = e.target.name as FieldName;
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError('');

    const form = e.currentTarget;
    const fd = new FormData(form);
    const values = Object.fromEntries(fd.entries()) as Record<FieldName, string>;

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return; // no submit while invalid

    setSubmitting(true);
    try {
      const res = await fetch('/api/pilot-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.ok) {
        setSubmitted(true);
      } else if (res.status === 400 && payload?.errors) {
        setErrors(payload.errors as Errors);
      } else {
        setServerError(
          payload?.error || 'Something went wrong while saving your signup. Please try again.',
        );
      }
    } catch {
      setServerError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass = (field: FieldName) => (errors[field] ? inputErrorClass : inputClass);

  return (
    <section id="signup" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
          Join the Free Pilot
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-gray-600">
          Free for 3 months, no card required. Tell us about your business and
          we&apos;ll set you up.
        </p>
        <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-brand-teal/15 bg-white p-8 shadow-xl shadow-brand-teal/10 sm:p-10">
          {submitted ? (
            <div className="py-8 text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/10 text-2xl text-brand-teal">
                ✓
              </span>
              <p className="mt-5 font-heading text-xl font-semibold text-brand-teal">
                We&apos;ll contact you within 24 hours on WhatsApp
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Thanks for joining the FixifAI pilot.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Company name
                </label>
                <input
                  id="company"
                  name="company"
                  className={fieldClass('company')}
                  onChange={clearError}
                />
                <FieldError message={errors.company} />
              </div>
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Your name
                </label>
                <input
                  id="name"
                  name="name"
                  className={fieldClass('name')}
                  onChange={clearError}
                />
                <FieldError message={errors.name} />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone (WhatsApp)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="0771234567"
                  className={fieldClass('phone')}
                  onChange={clearError}
                />
                <FieldError message={errors.phone} />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={fieldClass('email')}
                  onChange={clearError}
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <label htmlFor="trade" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Trade
                </label>
                <select
                  id="trade"
                  name="trade"
                  className={fieldClass('trade')}
                  defaultValue=""
                  onChange={clearError}
                >
                  <option value="" disabled>
                    Select your trade
                  </option>
                  {TRADES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <FieldError message={errors.trade} />
              </div>
              <div>
                <label htmlFor="teamSize" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Team size
                </label>
                <select
                  id="teamSize"
                  name="teamSize"
                  className={fieldClass('teamSize')}
                  defaultValue=""
                  onChange={clearError}
                >
                  <option value="" disabled>
                    Select team size
                  </option>
                  {TEAM_SIZES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <FieldError message={errors.teamSize} />
              </div>
              <div>
                <label htmlFor="currentMethod" className="mb-1.5 block text-sm font-medium text-gray-700">
                  How do you manage jobs today?
                </label>
                <select
                  id="currentMethod"
                  name="currentMethod"
                  className={fieldClass('currentMethod')}
                  defaultValue=""
                  onChange={clearError}
                >
                  <option value="" disabled>
                    Select current method
                  </option>
                  {CURRENT_METHODS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <FieldError message={errors.currentMethod} />
              </div>
              <div>
                <label htmlFor="businessType" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Business type
                </label>
                <select
                  id="businessType"
                  name="businessType"
                  className={fieldClass('businessType')}
                  defaultValue=""
                  onChange={clearError}
                >
                  <option value="" disabled>
                    Select business type
                  </option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <FieldError message={errors.businessType} />
              </div>

              {serverError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2">
                  {serverError} You can also reach us directly on{' '}
                  <a
                    href="https://chat.cloudit.lk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    WhatsApp
                  </a>
                  .
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting && (
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  {submitting ? 'Submitting…' : 'Join the Free Pilot'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
