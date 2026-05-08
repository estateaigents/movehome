// POST /api/enquire — accept enquiry from MoveHome UI, persist to
// tbl_enquiries, forward to source agent's enquiry_endpoint.
//
// Wire payload mirrors RAIA Protocol v0.2 enquiry.json — see
// estateaigents.org/schemas/enquiry.json.

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

interface IncomingPayload {
  raia_id?: unknown;
  enquirer?: {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    preferred_contact?: unknown;
  };
  message?: unknown;
  viewing_request?: {
    preferred_dates?: unknown;
    party_size?: unknown;
  };
}

const RAIA_ID_RE = /^prop-[a-z]{2}-[a-z0-9-]{2,32}-[0-9]{4,}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PREFERRED_CONTACTS = new Set(['email', 'phone', 'whatsapp']);

export async function POST(request: Request) {
  let body: IncomingPayload;
  try {
    body = (await request.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate ────────────────────────────────────────────────────────────
  const raia_id = typeof body.raia_id === 'string' ? body.raia_id : '';
  if (!RAIA_ID_RE.test(raia_id)) {
    return NextResponse.json({ error: 'Invalid raia_id' }, { status: 400 });
  }

  const name = typeof body.enquirer?.name === 'string' ? body.enquirer.name.trim() : '';
  const email = typeof body.enquirer?.email === 'string' ? body.enquirer.email.trim() : '';
  if (!name || name.length > 200) {
    return NextResponse.json({ error: 'enquirer.name required (1-200 chars)' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'enquirer.email invalid' }, { status: 400 });
  }

  const phone = typeof body.enquirer?.phone === 'string' ? body.enquirer.phone.trim() : null;
  const preferred_contact_raw =
    typeof body.enquirer?.preferred_contact === 'string' ? body.enquirer.preferred_contact : null;
  const preferred_contact =
    preferred_contact_raw && PREFERRED_CONTACTS.has(preferred_contact_raw)
      ? preferred_contact_raw
      : null;

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: 'message required (1-2000 chars)' }, { status: 400 });
  }

  // ── Resolve listing → agent_id + enquiry_endpoint ──────────────────────
  const admin = createSupabaseAdminClient();
  const { data: listing, error: listingError } = await admin
    .from('tbl_external_raia_listings')
    .select('agent_id, enquiry_endpoint, raia_id, withdrawn_at, visibility')
    .eq('raia_id', raia_id)
    .maybeSingle();

  if (listingError) {
    console.error('[/api/enquire] listing lookup', listingError.message);
    return NextResponse.json({ error: 'Listing lookup failed' }, { status: 500 });
  }
  if (!listing || listing.withdrawn_at || listing.visibility !== 'public') {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // ── Optional auth — link enquiry to user if signed in ──────────────────
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  // ── Compose enquiry.json v0.2 payload ──────────────────────────────────
  const enquiry_id = randomUUID();
  const submitted_at = new Date().toISOString();
  const ip_country = request.headers.get('x-vercel-ip-country');

  const viewing_request =
    body.viewing_request &&
    Array.isArray(body.viewing_request.preferred_dates) &&
    body.viewing_request.preferred_dates.length > 0
      ? {
          preferred_dates: (body.viewing_request.preferred_dates as unknown[])
            .filter((d): d is string => typeof d === 'string')
            .slice(0, 3),
          ...(typeof body.viewing_request.party_size === 'number'
            ? { party_size: body.viewing_request.party_size }
            : {})
        }
      : null;

  const source = {
    origin: 'movehome.org',
    ...(ip_country ? { ip_country } : {})
  };

  const wirePayload = {
    enquiry_id,
    raia_id,
    enquirer: {
      name,
      email,
      ...(phone ? { phone } : {}),
      ...(preferred_contact ? { preferred_contact } : {})
    },
    message,
    ...(viewing_request ? { viewing_request } : {}),
    source,
    submitted_at
  };

  // ── Insert into tbl_enquiries ──────────────────────────────────────────
  const { error: insertError } = await admin.from('tbl_enquiries').insert({
    enquiry_id,
    raia_id,
    agent_id: listing.agent_id,
    user_id: user?.id ?? null,
    enquirer_name: name,
    enquirer_email: email,
    enquirer_phone: phone,
    preferred_contact,
    message,
    viewing_request,
    source,
    status: 'new',
    submitted_at
  });

  if (insertError) {
    console.error('[/api/enquire] insert', insertError.message);
    return NextResponse.json({ error: 'Could not record enquiry' }, { status: 500 });
  }

  // ── Forward to agent endpoint (best-effort) ────────────────────────────
  if (listing.enquiry_endpoint) {
    try {
      const agentResponse = await fetch(listing.enquiry_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'movehome.org/0.1' },
        body: JSON.stringify(wirePayload),
        signal: AbortSignal.timeout(10_000)
      });

      const responseBody = await agentResponse.text().catch(() => '');
      const forwardedResult = {
        status: agentResponse.status,
        ok: agentResponse.ok,
        body: responseBody.slice(0, 4000)
      };

      await admin
        .from('tbl_enquiries')
        .update({
          status: agentResponse.ok ? 'forwarded' : 'new',
          forwarded_at: agentResponse.ok ? new Date().toISOString() : null,
          forwarded_response: forwardedResult
        })
        .eq('enquiry_id', enquiry_id);
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      await admin
        .from('tbl_enquiries')
        .update({ forwarded_response: { error } })
        .eq('enquiry_id', enquiry_id);
    }
  }

  return NextResponse.json({ enquiry_id, status: 'received' }, { status: 201 });
}
