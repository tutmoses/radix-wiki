// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO – tour
//  What a reader finds on radix.wiki, shown on the live wiki's own pages: the
//  home page and the Ecosystem directory, an article with its infobox and a
//  link's hover card, the search as it is typed, the ledger charts with a
//  measure and a period picked, the contributors' leaderboard and an article's
//  history. Reads only;
//  the article is the one named by TOUR_PAGE, or the latest changed
//  (studio/data.mjs).
// ═══════════════════════════════════════════════════════════════════════════
export const meta = { name: "tour", title: "radix.wiki: a tour", out: "radixwiki-tour.mp4" };

// An article link the hover cards cover: internal, two segments or more, not an app route (src/components/LinkPreview.tsx).
const CARDED = ".prose-content a[href^='/']:not([href^='/charts']):not([href^='/search']):not([href^='/leaderboard'])";

export default async function tour({ director, data, log }) {
  const page = await data.pickPage();
  if (!page) throw new Error("no article to film");
  const article = `/${page.tag_path}/${page.slug}`;
  const query = "Hyperscale";
  log(`tour · article=${article} · search="${query}"`);

  // Compile and cache every route filmed, the hover card's and the search's included, so each paints at once on camera.
  await director.warm(["/", "/ecosystem", article, "/charts", "/leaderboard", `${article}/history`, "/api/wiki/preview?path=contents", `/search?q=${query}`]);
  await director.headless(async (s) => {
    // The plates' logotype is the wiki's header logo, as it renders.
    director.brand.logotype = await s.logotype();
  });

  await director.segment("main", async (s) => {
    await s.agenda("A wiki of Radix and its ecosystem", [
      "Articles on Radix's technology, projects and news",
      "A preview of any page an article links to",
      "Search that answers as you type",
      "Charts read from the Radix ledger",
      "Points for writers, and a history of every edit",
    ], { hold: 3000 });

    // ① Read: the home page, then the Ecosystem directory
    await s.caption("① Read", "radix.wiki covers Radix: the network, the projects built on it and the week's news.");
    await s.wait(1800);
    await s.scrollTo(0.18, 2000);
    await s.wait(1000);
    await s.openCategory("ecosystem", ["① Read", "The Ecosystem category lists the projects built on Radix, the closed ones included."]);
    await s.wait(1400);
    await s.scrollTo(0.12, 1800);
    await s.wait(900);

    // ② Learn: an article, its infobox and a hover card
    await s.openPage(page.tag_path, page.slug, ["② Learn", "An article opens with an infobox of its key facts."]);
    await s.wait(500);
    if (await s.page.locator("aside.infobox").count()) await s.kenBurnsOn("aside.infobox", { scale: 1.5, zoomMs: 1000, holdMs: 1900, restMs: 700 });
    else await s.wait(1600);
    const link = await s.page.evaluate((sel) => {
      const a = [...document.querySelectorAll(sel)].find((a) => a.getAttribute("href").split(/[#?]/)[0].split("/").filter(Boolean).length >= 2);
      a?.setAttribute("data-tour", "link");
      return !!a;
    }, CARDED);
    if (link) {
      await s.caption("② Learn", "Rest on a link to preview the page it leads to.");
      await s.scrollToY('[data-tour="link"]', 260, 1500);
      await s.hoverLink('[data-tour="link"]');
      await s.wait(3000);
    }

    // ③ Search: the header search, answering as it is typed
    await s.cut(() => s.page.evaluate(() => window.scrollTo(0, 0)));
    await s.caption("③ Search", "Search every page from the header.");
    await s.search(query);
    await s.kenBurnsOn(".search-results", { scale: 1.3, zoomMs: 900, holdMs: 2200, restMs: 600 });
    const hit = ".search-results .search-result >> nth=0";
    await s.cursorTo(hit);
    await s.wait(300);
    const from = s.page.url();
    await s.cut(async () => { await s.page.locator(hit).click(); await s.page.waitForURL((u) => u.href !== from, { timeout: 30000 }); });
    await s.caption("③ Search", "A result opens its page.");
    await s.wait(2000);

    // ④ Charts: a measure and a period picked on the ledger's daily figures
    await s.goto("/charts");
    await s.caption("④ Charts", "Charts of the network, read from the Radix ledger every day.");
    await s.wait(1600);
    await s.scrollToY("#network-activity", 90, 1300);
    await s.caption("④ Charts", "Pick a measure and a period: here, active accounts each week since September 2023.");
    await s.cursorClick('main button:has-text("Active accounts")');
    await s.wait(700);
    await s.cursorClick('main button:text-is("All") >> nth=0');
    await s.wait(500);
    await s.sweep("section:has(> #network-activity) .chart-canvas", 0.12, 0.26, 0.55, 2400);
    await s.wait(1200);

    // ⑤ Write: the contributors' leaderboard
    await s.openLeaderboard(["⑤ Write", "Sign in with a Radix wallet to write: its $XRD balance is checked, never spent."]);
    await s.wait(2400);
    await s.caption("⑤ Write", "Every page, edit and comment earns points on the leaderboard.");
    await s.wait(2400);
    await s.goto(`${article}/history`);
    await s.caption("⑤ Write", "Every edit is kept: an article's history lists each version, what changed and who wrote it.");
    await s.wait(2800);

    await s.outro("Read it at radix.wiki", 2400);
  });
}
