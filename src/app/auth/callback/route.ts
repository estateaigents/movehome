// GET /auth/callback?token_hash=...&type=email&next=/...
// Magic-link landing route — exchanges the OTP token for a session, then
// redirects to `next` (or `/`).

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/';

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/signin?error=missing_token', url.origin));
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.verifyOtp({ token_hash, type });

  if (error) {
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
