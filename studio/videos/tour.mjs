// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — Knowledge Tour
//  A browse-only walkthrough: homepage → category grid → an article (Ken Burns on
//  the infobox, scroll the sections) → live search → leaderboard. Films a real,
//  currently-live page picked from the DB. No auth required.
// ═══════════════════════════════════════════════════════════════════════════
export const meta = { name: "tour", title: "RADIX.wiki — Knowledge Tour", out: "radixwiki-tour.mp4" };

export default async function makeTour({ director, data, log }) {
  const category = await data.pickCategory();
  const page = await data.pickPage();
  const pagePath = page ? `/${page.tag_path}/${page.slug}` : null;
  const query = page ? page.title.split(/\s+/)[0] : "Radix";
  log(`tour · category=/${category} · page=${pagePath ?? "(none)"} · search="${query}"`);

  // Preload the routes we'll film so they paint instantly on camera.
  await director.warm(["/", `/${category}`, pagePath, "/leaderboard"].filter(Boolean));

  await director.segment("main", async (s) => {
    await s.titleCard({ sub: "The knowledge base for the Radix ecosystem." });

    // ① Browse — the homepage
    await s.caption("① Browse", "Every corner of the Radix ecosystem, in one place.");
    await s.wait(700);
    await s.scrollTour({ to: 0.5, down: 2800, back: 2000 });

    // ② Explore — a populated category grid
    await s.openCategory(category, ["② Explore", "Curated categories — ecosystem, protocol, roadmap."]);
    await s.wait(700);
    await s.scrollTour({ to: 0.45, down: 2400, back: 1700 });

    // ③ Learn — a real article: focus the infobox, then read the sections
    if (pagePath) {
      await s.openPage(page.tag_path, page.slug, ["③ Learn", page.title]);
      await s.wait(800);
      await s.kenBurnsOn("table", { scale: 1.5, zoomMs: 1500, holdMs: 2200, restMs: 900 });
      await s.scrollTour({ to: 0.55, down: 3000, back: 2100 });
    }

    // ④ Search — find anything in seconds
    await s.doSearch(query, { caption: ["④ Search", "Find anything in seconds."] });
    await s.wait(800);

    // ⑤ Contribute — the points / airdrop payoff
    await s.openLeaderboard(["⑤ Contribute", "Edit a page, earn points toward the contributor airdrop."]);
    await s.wait(700);
    await s.scrollTour({ to: 0.4, down: 2200, back: 1500 });

    await s.outro("Read it. Improve it. Earn from it. — radix.wiki");
  });
}
