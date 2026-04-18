/**
 * BDD-style labels: static Pages output from `npm run pages:build` (_site/).
 */
describe("Commentray static site (GitHub Pages build)", () => {
  describe("given the built index is served at /", () => {
    it("then the code browser shell, panes, and search are present", () => {
      cy.visit("/");
      cy.get("#shell").should("exist").and("have.attr", "data-layout");
      cy.get("#code-pane").should("exist");
      cy.get("#doc-pane").should("exist");
      cy.get("#search-q").should("be.visible");
    });

    it("then the nav search JSON artifact is reachable", () => {
      cy.request("/commentray-nav-search.json").then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property("schemaVersion");
      });
    });
  });
});
