// src/lib/taxonomy.ts — the wiki's binding of the shared taxonomy engine.
//
// The mechanism (facets counted against every OTHER active filter, values read
// from the data rather than the declared options, the A–Z index, shared-facet
// related ranking, one href contract) lives in `wiki-formant`. What stays here
// is the only part that is this wiki's: which metadata keys a tag path declares,
// and what a category URL looks like.
//
// The rail's ROWS come from here too (`facetControls`/`alphaControls`), not just
// the counts: the href arithmetic that carries the reader's letter and sort
// through every chip.

import { createTaxonomy, defaultHref } from 'wiki-formant/taxonomy';
import { getMetadataKeys } from '@/lib/tags';

export type {
  Control,
  FacetControlGroup,
  FacetFilters,
  SharedFacet,
} from 'wiki-formant/taxonomy';

// The one place the category URL contract lives. This wiki mounts its
// categories at the root, which is exactly the shape `defaultHref` encodes.
export const categoryHref = defaultHref;

const taxonomy = createTaxonomy({
  getMetadataKeys: tagPath => getMetadataKeys(tagPath.split('/')),
  href: categoryHref,
});

export const {
  facetFilters,
  filterPages,
  rankRelated,
  metadataRows,
  // The rail's rows, with every href already built through `categoryHref`.
  facetControls,
  alphaControls,
  resolveLetter,
} = taxonomy;
