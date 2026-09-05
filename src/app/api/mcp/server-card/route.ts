// src/app/api/mcp/server-card/route.ts — MCP Server Card.
//
// Pre-connection discovery: lets a client learn who this server is and how to
// reach it without opening a session. Served at <mcp-url>/server-card, the
// location the Server Card extension recommends.
//
// Status: the extension is a DRAFT (SEP-1649 / SEP-2127) and its location has
// already moved once, from /.well-known/mcp.json to this path. It is served
// here only because it costs nothing to keep correct — every field is projected
// from server.json, the registry manifest that already single-sources the
// version, so there is no second copy of anything to drift. If the draft moves
// again, move this route; if it dies,
// delete it. Cards deliberately omit tool listings — that is what tools/list
// is for.

import { descriptorResponse } from 'wiki-formant/http';
import { serverCard } from 'wiki-formant/well-known';
import { MCP_PROTOCOL_VERSIONS } from 'wiki-formant/mcp';
import serverManifest from '../../../../../server.json';

export const revalidate = 86400;

// Projected from server.json, the registry manifest that already single-sources
// the version. It used to retype `title` and `description` as literals here, so
// the site served two different descriptions of the same server with nothing
// comparing them — the manifest's and this one's. The manifest wins, because it
// is the copy the registry publishes.
const SERVER_CARD = serverCard(serverManifest, MCP_PROTOCOL_VERSIONS);

export async function GET(request: Request) {
  return descriptorResponse(request, SERVER_CARD);
}
