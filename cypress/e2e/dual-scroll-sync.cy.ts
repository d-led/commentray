describe("The dual-scroll block-sync ", () => {
  beforeEach(() => {
    cy.ApplyNarrowViewportForDualScrollFixture();
    cy.GoToE2eDualScrollFixturePage();
  });

  it("renders paired panes with gutter connector artwork", () => {
    cy.CurrentPageShouldDisplayDualPaneCodeBrowserChrome();
    cy.DocumentationPairStripShouldMentionDualScrollSourceFile();
    cy.ResizeSplitterGutterShouldExposeConnectorPaths();
  });

  it("couples documentation scroll position to code-pane scroll", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollCodePaneToMaximum();
    cy.DocPaneBodyScrollTopShouldExceed(80);
  });

  it("couples code-pane scroll position to documentation scroll", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollDocPaneBodyToMaximum();
    cy.CodePaneScrollTopShouldExceed(80);
  });
});
