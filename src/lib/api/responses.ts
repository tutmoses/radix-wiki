// src/lib/api/responses.ts

import { NextResponse } from 'next/server';

export const unauthorized = (message = 'Unauthorized') =>
  NextResponse.json({ error: message }, { status: 401 });

export const forbidden = (message = 'Forbidden') =>
  NextResponse.json({ error: message }, { status: 403 });

export const notFound = (resource = 'Resource') =>
  NextResponse.json({ error: `${resource} not found` }, { status: 404 });

export const badRequest = (message = 'Bad request') =>
  NextResponse.json({ error: message }, { status: 400 });

export const serverError = (error: unknown, message = 'Internal server error') => {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
};

export const success = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status });

export const created = <T>(data: T) =>
  NextResponse.json(data, { status: 201 });