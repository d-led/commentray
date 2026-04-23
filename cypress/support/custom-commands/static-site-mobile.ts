import { shellA11y } from "../shell-a11y";

/** Matches `code-browser.ts` / client `DUAL_MOBILE_SINGLE_PANE_MQ` (dual panes from 768px up). */
const MOBILE_VIEWPORT_WIDTH = 390;
const MOBILE_VIEWPORT_HEIGHT = 844;

Cypress.Commands.add("PrepareStaticSiteHomeAtMobileViewport", () => {
  cy.clearLocalStorage();
  cy.viewport(MOBILE_VIEWPORT_WIDTH, MOBILE_VIEWPORT_HEIGHT);
  cy.visit("/");
});

Cypress.Commands.add("MobileStaticSiteCodeBrowserChromeShouldBeReady", () => {
  cy.get(shellA11y.shell).should("exist").and("have.attr", "data-layout", "dual");
  cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane");
  cy.get(shellA11y.mobilePaneFlip).should("be.visible");
  cy.get(shellA11y.resizeSplitter).should("not.be.visible");
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("be.visible");
  });
  cy.get(shellA11y.banner).should("be.visible");
  cy.get(shellA11y.contentinfo).should("be.visible");
});

Cypress.Commands.add("MobileSinglePaneLayoutShouldShowCommentaryColumnOnly", () => {
  cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "doc");
  cy.get(shellA11y.panes.source).should("not.be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
});

Cypress.Commands.add("MobileSinglePaneLayoutShouldShowSourceColumnOnly", () => {
  cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("not.be.visible");
});

Cypress.Commands.add("TapMobilePaneFlipControl", () => {
  cy.get(shellA11y.mobilePaneFlip).click();
});
