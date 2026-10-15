// src/app/api/passkey/route.ts

import { gate } from '@/lib/admin';

export const POST = gate.route;
export const DELETE = gate.signOut;
