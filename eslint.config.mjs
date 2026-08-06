// eslint.config.mjs — flat config.
//
// Next 16 removed `next lint`, and this project never had a config file on disk
// (the old command generated one on first run), so linting silently did nothing.
// eslint-config-next still ships the rules; they're just composed here now.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      // One-off seed/maintenance scripts: plain Node ESM, not part of the app
      // build, and gitignored. Linting them with the Next rules is pure noise.
      'scripts/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
