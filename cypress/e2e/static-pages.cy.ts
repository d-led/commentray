describe("The Commentray GitHub Pages static build", () => {
  describe("The nav search JSON artifact", () => {
    it("responds with 200 and a schemaVersion field", () => {
      cy.NavSearchArtifactGetRequestShouldReturnSchemaVersion();
    });
  });

  describe("The built site index at /", () => {
    beforeEach(() => {
      cy.GoToStaticSiteHome();
    });

    it("backfills the hub URL to a humane browse path for the current pair", () => {
      cy.location("pathname").should("match", /\/browse\/README\.md@main\.html$/);
    });

    it("presents a coherent browsable documentation workspace", () => {
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.CommentrayPaneReadmeLinksShouldUseGithubBlobUrls();
      cy.CommentrayPaneEmphasisShouldRenderAfterBlocks();
      cy.DocumentationHomeLinkShouldPointToRelativeIndex();
      cy.ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage();
      cy.OpenCommentRayedFilesDisclosure();
      cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
    });

    it("closes the Comment-rayed files hub when Escape is pressed", () => {
      cy.OpenCommentRayedFilesDisclosure();
      cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
      cy.CloseCommentRayedFilesHubWithEscape();
    });

    it("keeps pair-browse routes from stacking under repeated /browse/ segments", () => {
      cy.OpenCommentRayedFilesDisclosure();
      cy.FollowFirstBrowseFileLinkInTree();
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.ShellPairBrowseLinkShouldAvoidStackedBrowseSegments();
    });

    it("keeps relative pair-browse links stable when landing on a direct browse permalink", () => {
      cy.get(".shell")
        .invoke("attr", "data-commentray-pair-browse-href")
        .then((browseHref) => {
          expect(browseHref)
            .to.be.a("string")
            .and.match(
              /^(?:\.\/browse\/[^/]+\.html|https?:\/\/[^/]+\/browse\/[^/]+\.html)(?:\?.*)?$/,
            );
          if (typeof browseHref !== "string") {
            throw new Error("Expected shell browse permalink href");
          }
          cy.visit(browseHref);
        });

      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.location("pathname").should("match", /\/browse\/[^/]+(?:\.html)?$/);
      cy.location("pathname").should("not.match", /\/browse\/browse\//);
      cy.get('a[aria-label="Documentation home"]')
        .should("have.attr", "href")
        .and("match", /^(?:\/|\/.+\/)$/)
        .and("not.match", /\/browse\/?$/);
      cy.ShellPairBrowseLinkShouldAvoidStackedBrowseSegments();
    });

    it("serves humane source browse paths as real pages on static hosts", () => {
      cy.visit("/browse/README.md@main.html");
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.location("pathname").should("match", /\/browse\/[^/]+$/);
      cy.ShellPairBrowseLinkShouldAvoidStackedBrowseSegments();
    });

    it("returns 404 for humane browse paths without a documented pair", () => {
      cy.request({
        method: "GET",
        url: "/browse/this-path-has-no-commentray.md",
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 404);
    });

    it("clears in-page search and hides hits when Escape is pressed", () => {
      cy.TypeTextInSearchField("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.PressEscapeInSearchField();
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("highlights matched query tokens inside search hit snippets", () => {
      cy.TypeTextInSearchField("commentray");
      cy.SearchResultsPanelShouldBeVisible();
      cy.SearchResultsHitMarksShouldExist();
    });

    it("switches documentation angle while keeping on-site pair-browse targets", () => {
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

    it("resets in-flight search when the angle changes", () => {
      cy.TypeTextInSearchField("quickstart");
      cy.SearchResultsPanelShouldBeVisible();
      cy.ChooseValueOfAngleSelect("architecture");
      cy.SearchFieldValueShouldBeEmpty();
      cy.SearchResultsPanelShouldBeHidden();
    });

    it("keeps Mermaid output valid when the angle changes", () => {
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
      cy.ChooseValueOfAngleSelect("architecture");
      cy.DisplayedValueOfAngleSelectShouldBe("architecture");
      cy.DocPaneMermaidShouldShowDiagramOrMarkup();
    });
  });

  context("when nav search JSON cannot be fetched", () => {
    beforeEach(() => {
      cy.InterceptNavSearchIndexAsUnavailable();
      cy.GoToStaticSiteHome();
    });

    it("still exposes README through the comment-rayed files tree", () => {
      cy.OpenCommentRayedFilesDisclosure();
      cy.CommentRayedFilesTreeShouldContainReadmeLink();
    });
  });
});
