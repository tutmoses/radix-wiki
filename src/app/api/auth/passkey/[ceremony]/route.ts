// src/app/api/auth/passkey/[ceremony]/route.ts
//
// POST /api/auth/passkey/register and /login. Each is asked twice: without a
// `response` it answers the options the browser hands its authenticator, and
// with the authenticator's `response` it verifies it and opens the session.

import { NextRequest } from 'next/server';
import { clientKey } from 'wiki-formant/rate-limit';
import { errors, handleRoute, json } from 'wiki-formant/http';
import { IP_LIMITS, overBudget, type RouteContext } from '@/lib/api';
import { createSession, getSession, sessionJson } from '@/lib/auth';
import { cleanName, login, loginOptions, NAME_MAX, register, registrationOptions } from '@/lib/passkey';

export async function POST(request: NextRequest, { params }: RouteContext<{ ceremony: string }>) {
  const { ceremony } = await params;
  if (ceremony !== 'register' && ceremony !== 'login') return errors.notFound();

  return handleRoute(async () => {
    const body = await request.json().catch(() => ({})) as { name?: unknown; response?: any };
    // Options are what cost a row and, for a new name, lead to an account: they carry the budget.
    if (!body.response) {
      const limited = overBudget(clientKey('passkey', request.headers), IP_LIMITS.challenge);
      if (limited) return limited;
    }

    if (ceremony === 'login') {
      if (!body.response) return json(await loginOptions(request));
      const user = await login(request, body.response);
      if (!user) return errors.unauthorized('That passkey did not sign in. If it was saved for another site, pick the one saved for this wiki.');
      const { expiresAt } = await createSession(user);
      return json(sessionJson(user, expiresAt));
    }

    // Saving a passkey while signed in adds it to that account; signed out, it makes a new one.
    const session = await getSession();
    const name = session ? null : cleanName(body.name);
    if (!session && !name) return errors.badRequest(`Pick a name of 2 to ${NAME_MAX} characters.`);
    if (!body.response) return json(await registrationOptions(request, session, name));
    const user = await register(request, session, name, body.response);
    if (!user) return errors.badRequest('That passkey could not be saved. Try again.');
    if (session) return json(sessionJson(user, session.expiresAt));
    const { expiresAt } = await createSession(user);
    return json(sessionJson(user, expiresAt));
  }, 'Passkey sign-in failed');
}
