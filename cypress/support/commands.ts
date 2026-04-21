/**
 * Custom commands for Commentray static-site E2E (same role as commands.js in
 * other repos — keep specs thin, reuse assertions here).
 */

import { shellA11y } from "./shell-a11y";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Visit the built static site root (`/`). */
      visitStaticSiteHome(): Chainable<void>;
      /**
       * Visit the dual-pane E2E fixture (block-aware scroll sync + gutter rays).
       * Emitted by `scripts/build-static-pages.mjs` as `_site/__e2e__/dual-scroll-sync.html`.
       */
      visitE2eDualScrollSync(): Chainable<void>;
      /** Assert the code browser shell, panes, and search UI are present. */
      shouldDisplayCodeBrowserShell(): Chainable<void>;
      /** GET `/commentray-nav-search.json` and assert shape. */
      shouldExposeNavSearchArtifact(): Chainable<void>;
      /**
       * Assert icon links in the “current pair” toolbar cluster use `aria-hidden` SVG
       * (decorative). Selector lives in {@link ./shell-a11y.ts}.
       */
      shouldHideDecorativeSvgsInDocPairLinks(): Chainable<void>;
    }
  }
}

Cypress.Commands.add("visitStaticSiteHome", () => {
  cy.visit("/");
});

Cypress.Commands.add("visitE2eDualScrollSync", () => {
  cy.visit("/__e2e__/dual-scroll-sync/");
});

Cypress.Commands.add("shouldDisplayCodeBrowserShell", () => {
  cy.get(".shell").should("exist").and("have.attr", "data-layout");
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("be.visible");
  });
  cy.get(shellA11y.colorThemeTrigger).should("exist");
  cy.get(shellA11y.contentinfo).should("be.visible");
  cy.get(`${shellA11y.contentinfo} time`).should("be.visible");
});

Cypress.Commands.add("shouldExposeNavSearchArtifact", () => {
  cy.request("/commentray-nav-search.json").then((res) => {
    expect(res.status).to.eq(200);
    expect(res.body).to.have.property("schemaVersion");
  });
});

Cypress.Commands.add("shouldHideDecorativeSvgsInDocPairLinks", () => {
  cy.get(`${shellA11y.banner} a.toolbar-github`).each(($a) => {
    cy.wrap($a).find('svg[aria-hidden="true"]').should("exist");
  });
});

export {};
