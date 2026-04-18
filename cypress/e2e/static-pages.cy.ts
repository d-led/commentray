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

    it("then the hub exposes GitHub source links and a documented-files tree", () => {
      cy.visitStaticSiteHome();
      cy.contains("a", "Source on GitHub")
        .should("have.attr", "href")
        .and("match", /github\.com/);
      cy.contains("a", "Commentray on GitHub")
        .should("have.attr", "href")
        .and("match", /github\.com/);
      cy.get("#documented-files-toggle").click();
      cy.get("#documented-files-panel").should("be.visible");
      cy.get("#documented-files-tree ul", { timeout: 10000 }).should("exist");
    });

    it("then documented pairs are embedded on #shell for offline tree hydration", () => {
      cy.visitStaticSiteHome();
      cy.get("#shell")
        .invoke("attr", "data-documented-pairs-b64")
        .should("be.a", "string")
        .and("have.length.gt", 32);
    });

    it("then the documented tree still works when nav JSON cannot be fetched (embedded fallback)", () => {
      let navJsonRequested = false;
      cy.intercept("GET", "**/commentray-nav-search.json", (req) => {
        navJsonRequested = true;
        req.reply({ statusCode: 503, body: "{}" });
      }).as("navJsonFail");
      cy.visitStaticSiteHome();
      cy.get("#documented-files-toggle").click();
      cy.get("#documented-files-panel").should("be.visible");
      cy.get("#documented-files-tree").contains("README.md");
      cy.then(() => {
        expect(navJsonRequested, "tree must not depend on nav JSON when embedded pairs exist").to.be
          .false;
      });
    });

    it("then Escape clears in-page search and hides hit results", () => {
      cy.visitStaticSiteHome();
      cy.get("#search-q").type("commentray");
      cy.get("#search-results").should("not.have.attr", "hidden");
      cy.get("body").type("{esc}");
      cy.get("#search-q").should("have.value", "");
      cy.get("#search-results").should("have.attr", "hidden");
    });
  });
});
