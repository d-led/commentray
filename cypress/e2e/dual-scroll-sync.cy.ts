describe("E2E dual-scroll fixture — block-aware scroll sync", () => {
  beforeEach(() => {
    cy.prepareNarrowViewportForDualScrollFixture();
    cy.visitE2eDualScrollSync();
  });

  it("should present the dual-pane code browser chrome", () => {
    cy.shouldDisplayDualPaneCodeBrowserChrome();
  });

  it("should show gutter connector artwork between the panes after layout", () => {
    cy.shouldShowGutterConnectorArtworkBetweenPanesAfterLayout();
  });

  it("should pull the commentray pane to follow when the code pane scrolls down", () => {
    cy.shouldHaveCodeAndDocPanesAtScrollTopZero();
    cy.scrollCodePaneToEnd();
    cy.shouldHaveDocPaneBodyScrolledPast(80);
  });

  it("should pull the code pane to follow when the commentray pane scrolls down", () => {
    cy.shouldHaveCodeAndDocPanesAtScrollTopZero();
    cy.scrollDocPaneBodyToEnd();
    cy.shouldHaveCodePaneScrolledPast(80);
  });
});
