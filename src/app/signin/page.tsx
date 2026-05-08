'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

function SignInForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const sb = createSupabaseBrowserClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: signInError } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`
      }
    });

    if (signInError) {
      setStatus('error');
      setError(signInError.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-slate-600 mb-6">
        We&apos;ll email you a magic link. No password needed.
      </p>

      {status === 'sent' ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Check your inbox at <strong>{email}</strong> — click the link to finish signing in.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col text-sm">
            <span className="text-slate-700 mb-1">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="bg-primary text-white rounded py-2 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>

          {status === 'error' && error && (
            <p className="text-sm text-red-700">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
