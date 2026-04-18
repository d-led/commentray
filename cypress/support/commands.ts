/**
 * Custom commands for Commentray static-site E2E (same role as commands.js in
 * other repos — keep specs thin, reuse assertions here).
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /** Visit the built static site root (`/`). */
      visitStaticSiteHome(): Chainable<void>;
      /** Assert the code browser shell, panes, and search UI are present. */
      shouldDisplayCodeBrowserShell(): Chainable<void>;
      /** GET `/commentray-nav-search.json` and assert shape. */
      shouldExposeNavSearchArtifact(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("visitStaticSiteHome", () => {
  cy.visit("/");
});

Cypress.Commands.add("shouldDisplayCodeBrowserShell", () => {
  cy.get("#shell").should("exist").and("have.attr", "data-layout");
  cy.get("#code-pane").should("exist");
  cy.get("#doc-pane").should("exist");
  cy.get("#search-q").should("be.visible");
});

Cypress.Commands.add("shouldExposeNavSearchArtifact", () => {
  cy.request("/commentray-nav-search.json").then((res) => {
    expect(res.status).to.eq(200);
    expect(res.body).to.have.property("schemaVersion");
  });
});

export {};
