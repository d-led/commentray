describe("E2E dual-scroll fixture — block-aware scroll sync", () => {
  beforeEach(() => {
    cy.ApplyNarrowViewportForDualScrollFixture();
    cy.GoToE2eDualScrollFixturePage();
  });

  it("Fixture renders paired panes with gutter connector visuals", () => {
    cy.CurrentPageShouldDisplayDualPaneCodeBrowserChrome();
    cy.DocumentationPairStripShouldMentionDualScrollSourceFile();
    cy.ResizeSplitterGutterShouldExposeConnectorPaths();
  });

  it("Code scroll couples to the documentation body", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollCodePaneToMaximum();
    cy.DocPaneBodyScrollTopShouldExceed(80);
  });

  it("Documentation scroll couples back to the code pane", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollDocPaneBodyToMaximum();
    cy.CodePaneScrollTopShouldExceed(80);
  });
});
