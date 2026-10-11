import './globals.css';
import type { Metadata, Viewport } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
const TITLE = 'seo hee jin story';
const DESC = '서희와 서진이 3D 동화 속으로 들어가는 이야기 · 첫 번째 동화: 백설공주와 일곱 난쟁이';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESC,
  applicationName: TITLE,
  openGraph: {
    type: 'website', siteName: TITLE, title: TITLE, description: DESC, locale: 'ko_KR',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'seo hee jin story — 서희 & 서진의 3D 동화 여행' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/og.png'] },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
