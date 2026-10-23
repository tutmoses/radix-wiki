// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO – scene actions
//  Wiki-specific storyboard verbs on top of radix-studio's generic Scene:
//  navigation, the header search and an article's hover cards. Cinematics
//  (cards, Ken Burns, scroll, cursor) are inherited. Filmed frame-stepped, the
//  page's clock is paused, so every wait on a fetch runs inside `live`.
// ═══════════════════════════════════════════════════════════════════════════
import { Scene } from "radix-studio";

const clean = (p) => "/" + String(p).replace(/^\/+/, "");

export class WikiScene extends Scene {
  // A category listing (a valid tag path, which the catch-all renders as its page grid).
  async openCategory(tagPath, caption) {
    await this.goto(clean(tagPath));
    if (caption) await this.caption(caption[0], caption[1]);
  }

  // A single article (tagPath/slug), which leads with an infobox beside the text.
  async openPage(tagPath, slug, caption) {
    await this.goto(clean(`${tagPath}/${slug}`));
    if (caption) await this.caption(caption[0], caption[1]);
  }

  async openLeaderboard(caption) {
    await this.goto("/leaderboard");
    if (caption) await this.caption(caption[0], caption[1]);
  }

  /**
   * The header's logo link as one SVG in the overlay's terms: the mark the
   * header renders and the site name in the header's own font, weight and
   * colour, laid out where the header lays them.
   */
  logotype() {
    return this.page.evaluate(async () => {
      const a = document.querySelector("header .header-bar > a[href='/']");
      const img = a.querySelector("img"), name = a.querySelector(".logo-text");
      const box = a.getBoundingClientRect(), ib = img.getBoundingClientRect(), nb = name.getBoundingClientRect();
      const blob = await (await fetch(img.currentSrc)).blob();
      const src = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
      const cs = getComputedStyle(name);
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(box.width)} ${Math.ceil(box.height)}">`
        + `<image href="${src}" x="${ib.x - box.x}" y="${ib.y - box.y}" width="${ib.width}" height="${ib.height}"/>`
        + `<text x="${nb.x - box.x}" y="${nb.y - box.y + nb.height / 2}" dominant-baseline="central" font-family="${esc(cs.fontFamily)}" font-weight="${cs.fontWeight}" font-size="${cs.fontSize}" fill="${cs.color}">${esc(name.textContent)}</text></svg>`;
    });
  }

  // Scroll so `sel` sits `y` pixels from the top of the viewport.
  async scrollToY(sel, y, dur) {
    const to = await this.page.evaluate(([sel, y]) => {
      const el = document.querySelector(sel), box = document.scrollingElement;
      const max = Math.max(1, box.scrollHeight - box.clientHeight);
      return Math.min(1, Math.max(0, (el.getBoundingClientRect().top + box.scrollTop - y) / max));
    }, [sel, y]);
    await this.scrollTo(to, dur);
  }

  // Type into the header search and hold once its live results are in. On the
  // paused clock the search's debounce waits out the whole word, so its "No
  // pages found" would sit under every keystroke; it is hidden while typing.
  async search(query) {
    const input = this.page.locator('.header-search input[type="search"]');
    await this.page.addStyleTag({ content: ".search-empty{visibility:hidden}" }).then((s) => s.evaluate((e) => (e.id = "dtyping")));
    await this.typeInto(input, query, 90);
    await this.live(async () => {
      await this.page.locator(".search-results .search-result").first().waitFor({ state: "visible", timeout: 15000 });
      await this.settle();
    });
    await this.page.evaluate(() => document.getElementById("dtyping")?.remove());
  }

  // Draw the cursor, the real mouse with it, across `sel` from fraction `x0` to `x1` at height `y`, so the page answers the hover on every frame.
  async sweep(sel, x0, x1, y, dur) {
    const b = await this.page.locator(sel).first().boundingBox();
    const at = (t) => [b.x + b.width * (x0 + (x1 - x0) * t), b.y + b.height * y];
    await this.cursorAt(...at(0));
    await this.page.mouse.move(...at(0));
    const n = Math.max(1, this.frameCount(dur));
    for (let i = 1; i <= n; i++) {
      const t = i / n, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, [x, y] = at(e);
      await this.page.mouse.move(x, y);
      await this.page.evaluate(([x, y]) => window.__demo.cur(x, y), [x, y]);
      await this.frameOut();
    }
  }

  // Rest the cursor on an article link until its hover card is in.
  async hoverLink(sel) {
    await this.cursorTo(sel);
    await this.live(async () => {
      await this.page.locator(sel).first().hover();
      await this.page.locator(".link-preview-card").waitFor({ state: "visible", timeout: 15000 });
      await this.settle();
    });
  }
}
