import { searchListings } from '@/lib/queries';
import { isConfigured } from '@/lib/supabase';
import ListingGrid from '@/components/ListingGrid';
import MapView from '@/components/MapView';

export const revalidate = 60;

export default async function HomePage() {
  const { results, total } = await searchListings({ limit: 24 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {!isConfigured && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase isn&apos;t configured. Run <code>vercel env pull .env.local</code> from the
          MoveHome project, or copy <code>.env.local.example</code> manually.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section>
          <MapView />
        </section>
        <aside>
          <h2 className="text-lg font-semibold mb-3">
            {total > 0 ? `${total} listings` : 'No listings yet'}
          </h2>
          <ListingGrid listings={results} />
        </aside>
      </div>
    </div>
  );
}
