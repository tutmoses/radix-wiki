import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

/** The font's custom property, set on <html> by the root layout and `global-error.tsx`. */
export const fontVariables = inter.variable;
