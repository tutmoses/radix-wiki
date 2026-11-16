import base from 'wiki-formant/knip';

// tsx runs the scripts by hand (`npx tsx scripts/<name>.ts`), so no package.json script names it.
export default {
  ...base,
  entry: [...base.entry, 'brand-assets/*.mjs'],
  project: [...base.project, 'brand-assets/*.mjs'],
  ignoreDependencies: [...base.ignoreDependencies, 'tsx'],
};
