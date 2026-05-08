import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'movehome.org — find your next home',
  description: 'Free, not-for-profit property listings. Powered by the RAIA Protocol.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://movehome.org'),
  icons: {
    icon: [
      { url: '/branding/favicon.ico', sizes: 'any' },
      { url: '/branding/icon.svg', type: 'image/svg+xml' },
      { url: '/branding/icon.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: '/branding/apple-icon.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-primary">
              movehome.org
            </Link>
            <nav className="flex gap-6 text-sm text-slate-600">
              <Link href="/search" className="hover:text-primary">Search</Link>
              <Link href="/about" className="hover:text-primary">About</Link>
              <a
                href="https://github.com/estateaigents/raia-protocol"
                className="hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Protocol
              </a>
              <Link href="/signin" className="hover:text-primary">Sign in</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap justify-between gap-2">
            <span>movehome.org · free, not-for-profit · open source</span>
            <span>
              Powered by the{' '}
              <a
                href="https://github.com/estateaigents/raia-protocol"
                className="underline hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                RAIA Protocol
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
