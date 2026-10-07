// src/lib/admin.ts – the passkey door to /stats. The gate, its tables and the
// invite bin are `wiki-formant/passkey`; this binds it to the wiki's database.

import { createPasskeyGate } from 'wiki-formant/passkey';
import { SITE_NAME } from '@/lib/site';
import { sql } from '@/lib/track';

export const gate = createPasskeyGate({ sql, rpName: SITE_NAME });
