import base from 'wiki-formant/knip';

export default { ...base, entry: [...base.entry, 'brand-assets/*.mjs'], project: [...base.project, 'brand-assets/*.mjs'] };
