// src/lib/taxonomy.ts — the wiki's binding of the shared taxonomy engine.
//
// The mechanism (facets counted against every OTHER active filter, values read
// from the data rather than the declared options, the A–Z index, shared-facet
// related ranking, one href contract) lives in `wiki-formant`. What stays here
// is the only part that is this wiki's: which metadata keys a tag path declares,
// and what a category URL looks like.
//
// Two behaviours changed when this moved out, both fixes:
//   - `rankRelated` now names an axis the returned siblings actually SHARE. It
//     used to pick the narrowest axis the subject carried without checking, so
//     a 141-page ecosystem article could headline "More DeFi in Ecosystem" over
//     five pages that were not DeFi, linking to a set containing none of them.
//   - `buildFacets`/`filterPages` keep the `letter` narrowing they always had
//     here; caper's copy had dropped it.

import { createTaxonomy, defaultHref } from 'wiki-formant/taxonomy';
import { getMetadataKeys } from '@/lib/tags';

export {
  DEFAULT_ALPHA_INDEX_MIN_PAGES as ALPHA_INDEX_MIN_PAGES,
  firstLetter,
  toggleFilter,
  type Facet,
  type FacetFilters,
  type FacetValue,
  type MetadataKeyDefinition,
  type RelatedRanking,
  type SharedFacet,
} from 'wiki-formant/taxonomy';

// The one place the category URL contract lives. This wiki mounts its
// categories at the root, which is exactly the shape `defaultHref` encodes –
// the local copy was byte-identical to it.
export const categoryHref = defaultHref;

const taxonomy = createTaxonomy({
  getMetadataKeys: tagPath => getMetadataKeys(tagPath.split('/')),
  href: categoryHref,
});

export const {
  facetKeys,
  facetFilters,
  filterPages,
  buildFacets,
  alphaIndex,
  rankRelated,
} = taxonomy;
