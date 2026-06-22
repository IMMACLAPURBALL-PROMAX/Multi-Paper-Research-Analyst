'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Workspace client component with SSR disabled.
// This completely bypasses server pre-rendering of browser-only APIs (IndexedDB, pdfjs-dist, mermaid).
const Workspace = dynamic(
  () => import('@/components/layout/Workspace').then((m) => m.Workspace),
  { ssr: false }
);

export default function Home() {
  return <Workspace />;
}
