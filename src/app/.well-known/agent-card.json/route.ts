// src/app/.well-known/agent-card.json/route.ts — A2A spec ≥v0.3 renamed the
// well-known path from agent.json to agent-card.json. Same card, both paths;
// the legacy route stays for pre-0.3 clients.

export { GET } from '../agent.json/route';
