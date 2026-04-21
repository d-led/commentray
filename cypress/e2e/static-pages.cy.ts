describe("Commentray static site (GitHub Pages build)", () => {
  it("Published nav search artifact is valid JSON the client can bootstrap from", () => {
    cy.NavSearchArtifactGetRequestShouldReturnSchemaVersion();
  });

  describe("given the built index is served at /", () => {
    beforeEach(() => {
      cy.VisitStaticSiteHome();
    });

    it("Hub shell, pair browse metadata, and file tree read as one coherent workspace", () => {
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.CommentrayPaneReadmeLinksShouldUseGithubBlobUrls();
      cy.CommentrayPaneEmphasisShouldRenderAfterBlocks();
      cy.DocumentationHomeLinkShouldPointToRelativeIndex();
      cy.ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage();
      cy.CommentRayedFilesSummaryClick();
      cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
    });

    it("Opening a browse page from the tree stays on-site without stacking /browse/browse/", () => {
      cy.CommentRayedFilesSummaryClick();
      cy.TreeFirstBrowseFileLinkVisit();
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.ShellPairBrowseLinkShouldAvoidStackedBrowseSegments();
    });

    it("Escape clears the query and collapses search hits", () => {
      cy.SearchFieldType("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchFieldEscapeKeyPress();
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("Search hits surface mark elements for matched tokens", () => {
      cy.SearchFieldType("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchResultsHitMarksShouldExist();
    });

    it("ArrowDown on an empty field lists indexed sources without typing a query", () => {
      cy.SearchFieldFocus();
      cy.SearchFieldArrowDownKeyPress();
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchResultsShouldMentionIndexedSourceFiles();
      cy.SearchResultsHitButtonsShouldExist();
    });

    it("Angle control swaps rendered bodies and keeps pair browse links on-site", () => {
      cy.AngleSelectShouldExposeMainAndArchitectureOptions();
      cy.AngleSelectShouldHaveValue("main");
      cy.CommentrayPaneShouldContainText("quick-start");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();

      cy.AngleSelectChooseValue("architecture");
      cy.AngleSelectShouldHaveValue("architecture");
      cy.CommentrayPaneShouldContainText("architecture angle");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();

      cy.AngleSelectChooseValue("main");
      cy.AngleSelectShouldHaveValue("main");
      cy.CommentrayPaneShouldContainText("quick-start");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();
    });

    it("Changing angle resets an in-flight search back to a clean slate", () => {
      cy.SearchFieldType("quickstart");
      cy.SearchResultsPanelShouldBeVisible();
      cy.AngleSelectChooseValue("architecture");
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("Mermaid survives angle changes without syntax-error placeholders", () => {
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
      cy.AngleSelectChooseValue("architecture");
      cy.AngleSelectShouldHaveValue("architecture");
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
    });
  });

  describe("when the nav search index cannot be fetched", () => {
    beforeEach(() => {
      cy.NavSearchIndexGetInterceptAsUnavailable();
      cy.VisitStaticSiteHome();
    });

    it("The comment-rayed files disclosure still reaches README in the tree", () => {
      cy.CommentRayedFilesSummaryClick();
      cy.CommentRayedFilesTreeShouldContainReadmeLink();
    });
  });
});
