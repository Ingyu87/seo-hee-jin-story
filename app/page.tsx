'use client';
import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <div className="boot">동화책을 여는 중…</div>,
});

export default function Page() {
  return <Game />;
}
