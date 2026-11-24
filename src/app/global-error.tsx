'use client';
import '@/styles/globals.css';
import { GlobalRouteError } from 'wiki-formant/react';
import { fontVariables } from '@/app/fonts';

export default function GlobalError({ retry }: { retry: () => void }) {
  return <GlobalRouteError retry={retry} htmlClassName={fontVariables} />;
}
