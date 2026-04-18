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
  });
});
