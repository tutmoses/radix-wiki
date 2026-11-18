// src/lib/passkey.ts – passkey sign-in for accounts, beside the wallet's.
//
// A passkey opens the same session a wallet proof does (`createSession`). A
// visitor with no wallet saves one and gets an account with no address, which
// can chat and nothing else: every other write reads a wallet's $XRD. A wallet
// account can save one too, and then signs in on a phone without the wallet
// round trip. `wiki-formant/passkey` is a different thing, the admin door to
// /stats: it knows keys, not users.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { CHALLENGE_TTL_SEC, type AuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma/client';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { shortenAddress } from '@/lib/utils';

/** The transports a stored key names, as the library types them. */
type Transports = NonNullable<NonNullable<Parameters<typeof generateRegistrationOptions>[0]['excludeCredentials']>[number]['transports']>;

type Ceremony = 'register' | 'login';

/** The longest name a passkey account can take. */
export const NAME_MAX = 24;

/** A display name as typed, tidied: one space between words, none at the ends. Null when it is too short or too long. */
export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  return clean.length >= 2 && clean.length <= NAME_MAX ? clean : null;
}

// A passkey belongs to one domain. Production's is the canonical origin's; the
// dev server's is localhost, on whatever port it took.
function relyingParty(request: Request): { rpID: string; origin: string } {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== 'production' && url.hostname === 'localhost') return { rpID: 'localhost', origin: url.origin };
  const site = new URL(SITE_URL);
  return { rpID: site.hostname, origin: site.origin };
}

// Challenges share the wallet's table under a prefix that names the ceremony, so
// one issued for a sign-in cannot be spent saving a key, nor either on a wallet proof.
const stored = (ceremony: Ceremony, challenge: string) => `passkey:${ceremony}:${challenge}`;

async function issueChallenge(ceremony: Ceremony, challenge: string): Promise<void> {
  await prisma.challenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.challenge.create({ data: { challenge: stored(ceremony, challenge), expiresAt: new Date(Date.now() + CHALLENGE_TTL_SEC * 1000) } });
}

/** One conditional delete, so two requests racing with one response cannot both pass. */
const spendChallenge = (ceremony: Ceremony) => async (challenge: string): Promise<boolean> =>
  (await prisma.challenge.deleteMany({ where: { challenge: stored(ceremony, challenge), expiresAt: { gt: new Date() } } })).count === 1;

/** What the browser needs to make a passkey: for the signed-in account, or for a new one called `name`. */
export async function registrationOptions(request: Request, session: AuthSession | null, name: string | null) {
  const label = session ? session.displayName || shortenAddress(session.radixAddress) || SITE_NAME : name!;
  const held = session ? await prisma.userPasskey.findMany({ where: { userId: session.userId }, select: { id: true, transports: true } }) : [];
  const options = await generateRegistrationOptions({
    rpName: SITE_NAME,
    rpID: relyingParty(request).rpID,
    userName: label,
    userDisplayName: label,
    attestationType: 'none',
    // One device, one key: the browser refuses to save a second for the same account.
    excludeCredentials: held.map(k => ({ id: k.id, transports: k.transports as Transports })),
    // Discoverable, so signing in later asks for no name: the device offers the passkey.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await issueChallenge('register', options.challenge);
  return options;
}

/**
 * Saves the passkey the browser made, on the signed-in account or on a new one
 * called `name`, and answers the account. Null when the response does not verify.
 */
export async function register(request: Request, session: AuthSession | null, name: string | null, response: RegistrationResponseJSON) {
  const { rpID, origin } = relyingParty(request);
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: spendChallenge('register'),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return null;

  const { credential } = result.registrationInfo;
  const passkey = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
  };
  if (session) {
    await prisma.userPasskey.create({ data: { ...passkey, userId: session.userId } });
    return prisma.user.findUnique({ where: { id: session.userId } });
  }
  return prisma.user.create({ data: { displayName: name, passkeys: { create: passkey } } });
}

export async function loginOptions(request: Request) {
  const options = await generateAuthenticationOptions({ rpID: relyingParty(request).rpID, userVerification: 'required' });
  await issueChallenge('login', options.challenge);
  return options;
}

/** The account whose passkey answered, or null when it is not one the wiki holds or does not verify. */
export async function login(request: Request, response: AuthenticationResponseJSON) {
  const passkey = typeof response?.id === 'string' ? await prisma.userPasskey.findUnique({ where: { id: response.id }, include: { user: true } }) : null;
  if (!passkey) return null;
  const { rpID, origin } = relyingParty(request);
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: spendChallenge('login'),
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as Transports,
    },
    requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified) return null;
  await prisma.userPasskey.update({ where: { id: passkey.id }, data: { counter: result.authenticationInfo.newCounter } });
  return passkey.user;
}
