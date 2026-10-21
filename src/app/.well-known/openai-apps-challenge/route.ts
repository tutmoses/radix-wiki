// src/app/.well-known/openai-apps-challenge/route.ts – domain proof for the
// ChatGPT plugin. The portal issues the token when the plugin is created, so it
// is the OPENAI_APPS_CHALLENGE env var; unset, this 404s.

import { openaiChallengeHandler } from 'wiki-formant/well-known';

export const dynamic = 'force-dynamic';

export const GET = openaiChallengeHandler();
