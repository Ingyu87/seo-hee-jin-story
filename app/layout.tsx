import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '백설공주와 일곱 난쟁이 · 서희 & 서진의 동화 여행',
  description: '서희와 서진이 3D 동화 속으로 들어가 백설공주와 일곱 난쟁이를 만나는 이야기',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
