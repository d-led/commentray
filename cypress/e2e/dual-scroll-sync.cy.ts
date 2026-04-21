describe("E2E dual-scroll fixture — block-aware scroll sync", () => {
  beforeEach(() => {
    cy.ViewportResizeForDualScrollScenario();
    cy.VisitE2eDualScrollFixture();
  });

  it("Dual-pane chrome and gutter artwork match the fixture’s pair and connector story", () => {
    cy.CurrentPageShouldDisplayDualPaneCodeBrowserChrome();
    cy.DocumentationPairStripShouldMentionDualScrollSourceFile();
    cy.ResizeSplitterGutterShouldExposeConnectorPaths();
  });

  it("Scrolling the code pane drives the commentray pane once both start at the origin", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.CodePaneScrollToMaxScroll();
    cy.DocPaneBodyScrollTopShouldExceed(80);
  });

  it("Scrolling the commentray pane drives the code pane once both start at the origin", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.DocPaneBodyScrollToMaxScroll();
    cy.CodePaneScrollTopShouldExceed(80);
  });
});
