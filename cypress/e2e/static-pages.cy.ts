describe("Commentray static site (GitHub Pages build)", () => {
  it("Nav search bootstrap artifact is well-formed", () => {
    cy.NavSearchArtifactGetRequestShouldReturnSchemaVersion();
  });

  describe("given the built index is served at /", () => {
    beforeEach(() => {
      cy.GoToStaticSiteHome();
    });

    it("Index behaves as a coherent documentation hub", () => {
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.CommentrayPaneReadmeLinksShouldUseGithubBlobUrls();
      cy.CommentrayPaneEmphasisShouldRenderAfterBlocks();
      cy.DocumentationHomeLinkShouldPointToRelativeIndex();
      cy.ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage();
      cy.OpenCommentRayedFilesDisclosure();
      cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
    });

    it("Pair browse stays on-site without path stacking", () => {
      cy.OpenCommentRayedFilesDisclosure();
      cy.FollowFirstBrowseFileLinkInTree();
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.ShellPairBrowseLinkShouldAvoidStackedBrowseSegments();
    });

    it("Search dismisses cleanly from the keyboard", () => {
      cy.TypeTextInSearchField("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.PressEscapeInSearchField();
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("Search results emphasize matched tokens in context", () => {
      cy.TypeTextInSearchField("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchResultsHitMarksShouldExist();
    });

    it("Empty search offers a navigable index hint", () => {
      cy.FocusOnSearchField();
      cy.PressArrowDownInSearchField();
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchResultsShouldMentionIndexedSourceFiles();
      cy.SearchResultsHitButtonsShouldExist();
    });

    it("Angle switches refresh the pair while keeping browse targets on-site", () => {
      cy.OptionsOfAngleSelectShouldIncludeMainAndArchitecture();
      cy.DisplayedValueOfAngleSelectShouldBe("main");
      cy.CommentrayPaneShouldContainText("quick-start");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();

      cy.ChooseValueOfAngleSelect("architecture");
      cy.DisplayedValueOfAngleSelectShouldBe("architecture");
      cy.CommentrayPaneShouldContainText("architecture angle");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();

      cy.ChooseValueOfAngleSelect("main");
      cy.DisplayedValueOfAngleSelectShouldBe("main");
      cy.CommentrayPaneShouldContainText("quick-start");
      cy.ShellPairBrowseLinkShouldMatchRelativeBrowseHtml();
      cy.ShellPairBrowseLinkShouldNotPointAtGithubHost();
    });

    it("Angle change clears stale search state", () => {
      cy.TypeTextInSearchField("quickstart");
      cy.SearchResultsPanelShouldBeVisible();
      cy.ChooseValueOfAngleSelect("architecture");
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("Diagrams stay present and clean across angles", () => {
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
      cy.ChooseValueOfAngleSelect("architecture");
      cy.DisplayedValueOfAngleSelectShouldBe("architecture");
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
    });
  });

  describe("when the nav search index cannot be fetched", () => {
    beforeEach(() => {
      cy.InterceptNavSearchIndexAsUnavailable();
      cy.GoToStaticSiteHome();
    });

    it("File tree remains reachable when search bootstrap fails", () => {
      cy.OpenCommentRayedFilesDisclosure();
      cy.CommentRayedFilesTreeShouldContainReadmeLink();
    });
  });
});
