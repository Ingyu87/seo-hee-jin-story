'use client';
import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <div className="boot">seo hee jin story…</div>,
});

export default function Page() {
  return <Game />;
}
