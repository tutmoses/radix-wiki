// POST /api/view – a page reporting a view, or an event such as a click out.
// Sent by wiki-formant's <Beacon> to this site's own address, and counted by
// its `collect`, which answers 204 before writing anything – and writes nothing
// off a production deployment.

import { viewRoute } from '@/lib/track';

export const POST = viewRoute();
