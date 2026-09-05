// src/app/.well-known/openapi.json/route.ts — the well-known alias of
// /openapi.json. Same document, both paths: which one an agent probes is a coin
// toss, and a 404 reads as "this origin publishes no spec".
//
// `revalidate` is declared here rather than re-exported — Next parses route
// segment config statically and cannot follow it through a re-export.

export const revalidate = 86400;

export { GET } from '../../openapi.json/route';
