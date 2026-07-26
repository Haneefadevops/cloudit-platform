'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isPortalUser } from '../dashboard/portal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || 'Login failed');
      return;
    }

    localStorage.setItem('token', data.access_token);
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    router.push(
      isPortalUser(data.user) ? '/dashboard/bookings' : '/dashboard/clients',
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page p-4">
      {/* Subtle gradient backdrop, like the landing hero */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(600px 400px at 15% 10%, rgba(0,216,199,0.16), transparent 60%), radial-gradient(700px 500px at 85% 90%, rgba(74,66,252,0.14), transparent 60%)',
        }}
      />
      <form
        onSubmit={login}
        className="relative w-full max-w-sm rounded-card border border-line bg-white p-8 shadow-pop"
      >
        <div className="mb-8 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="TheReplyte" className="h-10" />
          <p className="mb-0 mt-3 text-sm text-muted">
            Sign in to your dashboard
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20"
          />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-card transition-opacity hover:opacity-90"
        >
          Log In
        </button>
      </form>
    </div>
  );
}
