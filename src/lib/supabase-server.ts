// Server-side Supabase client — used in Server Components, Route Handlers,
// and Server Actions. Reads + writes the user's session via Next.js cookies.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method is called from a Server Component — Next.js
            // disallows cookie writes there. The middleware refreshes the
            // session on every request, so this is safe to ignore.
          }
        }
      }
    }
  );
}
