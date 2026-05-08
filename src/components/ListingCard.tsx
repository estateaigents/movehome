import Link from 'next/link';
import type { Listing } from '@/lib/types';
import AgentAttribution from './AgentAttribution';

function formatPrice(l: Listing): string {
  if (!l.currency) return 'Price on application';
  const fmt = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: l.currency,
    maximumFractionDigits: 0
  });
  if (l.service_type === 'long_term' && l.rent_pcm) return `${fmt.format(l.rent_pcm)} pcm`;
  if (l.service_type === 'short_term' && l.daily_rate) return `${fmt.format(l.daily_rate)} / night`;
  if (l.service_type === 'sale' && l.asking_price) return fmt.format(l.asking_price);
  return 'Price on application';
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/property/${listing.raia_id}`}
      className="block rounded-lg border border-slate-200 bg-white overflow-hidden hover:border-primary transition-colors"
    >
      <div className="aspect-[4/3] bg-slate-100 relative">
        {listing.photo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.photo_url}
            alt={listing.headline ?? listing.raia_id}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {listing.listing_status && listing.listing_status !== 'available' && (
          <span className="absolute top-2 left-2 rounded bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-700">
            {listing.listing_status.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-slate-900">{formatPrice(listing)}</p>
        <p className="text-sm text-slate-700 mt-1 line-clamp-1">
          {listing.headline ?? listing.suburb ?? listing.postcode_district}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {[
            listing.bedrooms != null && `${listing.bedrooms} bed`,
            listing.bathrooms != null && `${listing.bathrooms} bath`,
            listing.property_type
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="mt-2">
          <AgentAttribution agentId={listing.agent_id} agentCardUrl={listing.agent_card_url} />
        </div>
      </div>
    </Link>
  );
}
