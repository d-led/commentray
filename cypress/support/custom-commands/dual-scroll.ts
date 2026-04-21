import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("prepareNarrowViewportForDualScrollFixture", () => {
  cy.viewport(1280, 480);
});

Cypress.Commands.add("shouldDisplayDualPaneCodeBrowserChrome", () => {
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
  cy.get(shellA11y.resizeSplitter).should("be.visible");
});

Cypress.Commands.add("shouldShowGutterConnectorArtworkBetweenPanesAfterLayout", () => {
  cy.get(shellA11y.documentationPairLandmark).should("contain", "dual-scroll.ts");
  cy.get(`${shellA11y.resizeSplitter} .gutter__rays`, { timeout: 15000 }).should("be.visible");
  cy.get(`${shellA11y.resizeSplitter} svg path`).should("have.length.at.least", 4);
});

Cypress.Commands.add("scrollCodePaneToEnd", () => {
  cy.get("#code-pane").then(($pane) => {
    const el = $pane[0];
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  });
});

Cypress.Commands.add("scrollDocPaneBodyToEnd", () => {
  cy.get("#doc-pane-body").then(($body) => {
    const el = $body[0];
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  });
});

Cypress.Commands.add("shouldHaveDocPaneBodyScrolledPast", (pixels) => {
  cy.get("#doc-pane-body").invoke("scrollTop").should("be.gt", pixels);
});

Cypress.Commands.add("shouldHaveCodePaneScrolledPast", (pixels) => {
  cy.get("#code-pane").invoke("scrollTop").should("be.gt", pixels);
});

Cypress.Commands.add("shouldHaveCodeAndDocPanesAtScrollTopZero", () => {
  cy.get("#doc-pane-body").invoke("scrollTop").should("eq", 0);
  cy.get("#code-pane").invoke("scrollTop").should("eq", 0);
});

Cypress.Commands.add("shouldDisplayMainLandmarkAndSkipLinkOnCurrentPage", () => {
  cy.get(shellA11y.main).should("exist");
  cy.get(shellA11y.skipToMainLink).should("exist");
});
