describe("Commentray static site (GitHub Pages build)", () => {
  it("should expose a valid nav search json artifact", () => {
    cy.shouldExposeNavSearchArtifact();
  });

  describe("given the built index is served at /", () => {
    beforeEach(() => {
      cy.visitStaticSiteHome();
    });

    it("should serve the code browser shell, panes, and search", () => {
      cy.shouldDisplayCodeBrowserShell();
    });

    it("should link the commentray readme to github blob urls, not hub-relative readme paths", () => {
      cy.shouldLinkCommentrayReadmeToGithubBlobUrls();
    });

    it("should render inline markdown emphasis in the commentray pane after block markers", () => {
      cy.shouldRenderCommentrayInlineMarkdownEmphasis();
    });

    it("should expose hub home link, pair browse on shell, and a collapsible comment-rayed files tree", () => {
      cy.shouldExposeHubHomeLinkPairBrowseOnShellAndCollapsibleFileTree();
    });

    it("should serve per-pair browse pages without stacked /browse/browse/ path segments", () => {
      cy.shouldServeBrowsePageWithoutStackedBrowsePathSegments();
    });

    it("should clear in-page search and hide results when escape is pressed", () => {
      cy.shouldClearInPageSearchAndHideResultsOnEscape();
    });

    it("should highlight matched query tokens in search hit snippets", () => {
      cy.shouldHighlightSearchHitSnippetsWithMark();
    });

    it("should show a capped list of indexed source files when arrow down is used on an empty search", () => {
      cy.shouldListIndexedSourceFilesWhenArrowDownOnEmptySearch();
    });

    it("should list main and architecture angles and swap commentray bodies both ways", () => {
      cy.shouldSwapAngleBetweenMainAndArchitectureWithExpectedBodiesAndBrowseHref();
    });

    it("should clear the in-page search field and hide results when switching angle", () => {
      cy.shouldClearSearchWhenSwitchingAngle();
    });

    it("should include mermaid diagram blocks or rendered output in commentray for main and architecture", () => {
      cy.shouldShowMermaidInCommentrayForMainAndArchitectureAngles();
    });
  });

  describe("when the nav search index cannot be fetched", () => {
    beforeEach(() => {
      cy.interceptNavSearchIndexAsUnavailable();
      cy.visitStaticSiteHome();
    });

    it("should still show the comment-rayed files list including readme", () => {
      cy.shouldShowCommentrayedFilesTreeIncludingReadme();
    });
  });
});
