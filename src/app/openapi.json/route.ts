// src/app/openapi.json/route.ts — serves the OpenAPI 3.1 spec from @/lib/openapi.
//
// Also mounted at /.well-known/openapi.json. The three origins in this
// workspace had each picked one of the two paths and 404'd the other, so an
// agent that guessed wrong concluded there was no spec.

import { descriptorResponse } from 'wiki-formant/http';
import { SPEC } from '@/lib/openapi';

export const revalidate = 86400;

export async function GET(request: Request) {
  return descriptorResponse(request, SPEC);
}
