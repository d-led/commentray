/**
 * BDD-style labels: static Pages output from `npm run pages:build` (_site/).
 */
describe("Commentray static site (GitHub Pages build)", () => {
  describe("given the built index is served at /", () => {
    it("then the code browser shell, panes, and search are present", () => {
      cy.visitStaticSiteHome();
      cy.shouldDisplayCodeBrowserShell();
    });

    it("then the nav search JSON artifact is reachable", () => {
      cy.shouldExposeNavSearchArtifact();
    });

    it("then commentray pane links to README stay on github.com blob URLs (not ../README.md on Pages)", () => {
      cy.visitStaticSiteHome();
      cy.get("#doc-pane")
        .invoke("html")
        .should("match", /https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/README\.md/)
        .and("not.match", /href="\.\.\/README\.md"/);
    });

    it("then the commentray pane renders inline markdown after block markers (not raw underscores)", () => {
      cy.visitStaticSiteHome();
      cy.get("#doc-pane-body").find("em").should("have.length.at.least", 1);
      cy.get("#doc-pane-body em").first().should("contain.text", "You have the main");
    });

    it("then the hub exposes GitHub source links and a collapsible browse-files tree", () => {
      cy.visitStaticSiteHome();
      cy.get("#toolbar-source-github")
        .should("have.attr", "href")
        .and("match", /github\.com/);
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /github\.com/);
      cy.get("#documented-files-hub").should("exist");
      cy.get("#documented-files-hub").find("summary").contains("Documented files");
      cy.get("#documented-files-hub").then(($d) => {
        if (!$d.attr("open")) cy.wrap($d).find("summary").click();
      });
      cy.get("#documented-files-tree ul", { timeout: 10000 }).should("exist");
    });

    it("then documented pairs are embedded on #shell for offline tree hydration", () => {
      cy.visitStaticSiteHome();
      cy.get("#shell")
        .invoke("attr", "data-documented-pairs-b64")
        .should("be.a", "string")
        .and("have.length.gt", 32);
    });

    it("then the documented tree still hydrates from embedded pairs when nav JSON is unavailable", () => {
      cy.intercept("GET", "**/commentray-nav-search.json", { statusCode: 503, body: "{}" }).as(
        "navJsonFail",
      );
      cy.visitStaticSiteHome();
      cy.get("#documented-files-hub").then(($d) => {
        if (!$d.attr("open")) cy.wrap($d).find("summary").click();
      });
      cy.get("#documented-files-tree").contains("README.md");
    });

    it("then Escape clears in-page search and hides hit results", () => {
      cy.visitStaticSiteHome();
      cy.get("#search-q").type("commentray");
      cy.get("#search-results").should("not.have.attr", "hidden");
      cy.get("body").type("{esc}");
      cy.get("#search-q").should("have.value", "");
      cy.get("#search-results").should("have.attr", "hidden");
    });

    it("then search hit snippets highlight matched query tokens", () => {
      cy.visitStaticSiteHome();
      cy.get("#search-q").type("commentray");
      cy.get("#search-results").should("not.have.attr", "hidden");
      cy.get("#search-results mark.search-hit").should("have.length.at.least", 1);
    });

    it("then the Angle selector lists main and architecture and swaps commentray bodies both ways", () => {
      cy.visitStaticSiteHome();
      cy.get("#angle-select").should("exist");
      cy.get("#angle-select option").should("have.length.at.least", 2);
      cy.get('#angle-select option[value="main"]').should("exist");
      cy.get('#angle-select option[value="architecture"]').should("exist");
      cy.get("#angle-select").should("have.value", "main");

      cy.get("#doc-pane-body").should("contain", "quick-start");

      cy.get("#angle-select").select("architecture");
      cy.get("#angle-select").should("have.value", "architecture");
      cy.get("#doc-pane-body").should("contain", "architecture angle");
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /architecture\.md/);

      cy.get("#angle-select").select("main");
      cy.get("#angle-select").should("have.value", "main");
      cy.get("#doc-pane-body").should("contain", "quick-start");
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /main\.md/);
    });

    it("then switching Angle clears the in-page search field and hides results", () => {
      cy.visitStaticSiteHome();
      cy.get("#search-q").type("quickstart");
      cy.get("#search-results").should("not.have.attr", "hidden");
      cy.get("#angle-select").select("architecture");
      cy.get("#search-q").should("have.value", "");
      cy.get("#search-results").should("have.attr", "hidden");
    });
  });
});
