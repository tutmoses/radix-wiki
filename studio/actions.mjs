// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — scene actions
//  Wiki-specific storyboard verbs on top of radix-studio's generic Scene. The
//  knowledge tour is browse-only, so these are all navigation + the header
//  search. Cinematics (titleCard, kenBurns, scroll, cursor, …) are inherited.
// ═══════════════════════════════════════════════════════════════════════════
import { Scene } from "radix-studio";

const clean = (p) => "/" + String(p).replace(/^\/+/, "");

export class WikiScene extends Scene {
  // A category listing (a valid tag path → the catch-all renders its page grid).
  async openCategory(tagPath, caption) {
    await this.goto(clean(tagPath));
    if (caption) await this.caption(caption[0], caption[1]);
  }

  // A single article (tagPath/slug). These lead with an infobox + sections.
  async openPage(tagPath, slug, caption) {
    await this.goto(clean(`${tagPath}/${slug}`));
    if (caption) await this.caption(caption[0], caption[1]);
  }

  async openLeaderboard(caption) {
    await this.goto("/leaderboard");
    if (caption) await this.caption(caption[0], caption[1]);
  }

  // Open the header search, type a query, reveal the live results, then
  // optionally click through to the top hit.
  async doSearch(query, { caption, open = false } = {}) {
    await this.cursorClick('[aria-label="Search"]');
    const input = this.page.locator('.search-panel input[type="search"]');
    await input.waitFor({ state: "visible", timeout: 8000 });
    if (caption) await this.caption(caption[0], caption[1]);
    await this.typeInto(input, query, 95);       // 300ms-debounced — slow type lets results land
    await this.page.locator(".search-result").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await this.wait(1500);
    if (open) {
      await this.cursorClick(this.page.locator(".search-result").first());
      await this.installOverlay(); await this.wait(800);
    }
  }
}
