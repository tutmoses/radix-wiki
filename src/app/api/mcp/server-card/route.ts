// src/app/api/mcp/server-card/route.ts — MCP Server Card.
//
// Pre-connection discovery: lets a client learn who this server is and how to
// reach it without opening a session. Served at <mcp-url>/server-card, the
// location the Server Card extension recommends.
//
// Status: the extension is a DRAFT (SEP-1649 / SEP-2127) and its location has
// already moved once. It is served here only because it costs nothing to keep
// correct — `serverCardHandler` projects every field from server.json, the
// registry manifest that already single-sources the version, so there is no
// second copy of anything to drift. If the draft moves again, move this route;
// if it dies, delete it.

import { serverCardHandler } from 'wiki-formant/well-known';
import serverManifest from '../../../../../server.json';

export const revalidate = 86400;

export const GET = serverCardHandler(serverManifest);
