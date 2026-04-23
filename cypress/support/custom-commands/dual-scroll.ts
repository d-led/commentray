import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("ApplyNarrowViewportForDualScrollFixture", () => {
  cy.viewport(1280, 480);
});

Cypress.Commands.add("CurrentPageShouldDisplayDualPaneCodeBrowserChrome", () => {
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
  cy.get(shellA11y.resizeSplitter).should("be.visible");
});

Cypress.Commands.add("DocumentationPairStripShouldMentionDualScrollSourceFile", () => {
  cy.get(shellA11y.documentationPairLandmark).should("contain", "dual-scroll.ts");
});

Cypress.Commands.add("ResizeSplitterGutterShouldExposeConnectorPaths", () => {
  cy.get(`${shellA11y.resizeSplitter} .gutter__rays`, { timeout: 15000 }).should("be.visible");
  cy.get(`${shellA11y.resizeSplitter} svg path`).should("have.length.at.least", 4);
});

Cypress.Commands.add("ScrollCodePaneToMaximum", () => {
  cy.get("#code-pane").then(($pane) => {
    const el = $pane[0];
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  });
});

Cypress.Commands.add("ScrollDocPaneBodyToMaximum", () => {
  cy.get(shellA11y.docPaneBody).then(($body) => {
    const el = $body[0];
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  });
});

Cypress.Commands.add("DocPaneBodyScrollTopShouldExceed", (pixels) => {
  cy.get(shellA11y.docPaneBody).invoke("scrollTop").should("be.gt", pixels);
});

Cypress.Commands.add("CodePaneScrollTopShouldExceed", (pixels) => {
  cy.get("#code-pane").invoke("scrollTop").should("be.gt", pixels);
});

Cypress.Commands.add("CodeAndDocPanesScrollTopShouldBeZero", () => {
  cy.get(shellA11y.docPaneBody).invoke("scrollTop").should("eq", 0);
  cy.get("#code-pane").invoke("scrollTop").should("eq", 0);
});

Cypress.Commands.add("CurrentPageShouldDisplayMainLandmarkAndSkipLink", () => {
  cy.get(shellA11y.main).should("exist");
  cy.get(shellA11y.skipToMainLink).should("exist");
});
