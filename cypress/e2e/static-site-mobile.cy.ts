describe("The Commentray GitHub Pages static build on a narrow viewport", () => {
  beforeEach(() => {
    cy.PrepareStaticSiteHomeAtMobileViewport();
  });

  it("opens on commentary, hides the gutter, and keeps search chrome within reach", () => {
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
  });

  it("flips between source-only and commentary-only without losing in-page search", () => {
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();

    cy.TapMobilePaneFlipControl();
    cy.MobileSinglePaneLayoutShouldShowSourceColumnOnly();

    cy.TypeTextInSearchField("readme");
    cy.SearchResultsPanelShouldBeVisible();

    cy.TapMobilePaneFlipControl();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
    cy.SearchResultsPanelShouldBeVisible();
  });

  it("still drives multi-angle copy and the documented-files tree from the compact toolbar", () => {
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.OptionsOfAngleSelectShouldIncludeMainAndArchitecture();
    cy.ChooseValueOfAngleSelect("architecture");
    cy.DisplayedValueOfAngleSelectShouldBe("architecture");
    cy.CommentrayPaneShouldContainText("architecture angle");

    cy.OpenCommentRayedFilesDisclosure();
    cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
  });

  it("renders Mermaid in the commentary pane on a narrow viewport", () => {
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
    cy.DocPaneMermaidShouldShowDiagramOrMarkup();
  });

  it("renders Mermaid after opening commentary when the reader left off on source-only", () => {
    cy.window().then((win) => {
      win.localStorage.setItem("commentray.codeCommentrayStatic.dualMobilePane", "code");
    });
    cy.visit("/");
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.MobileSinglePaneLayoutShouldShowSourceColumnOnly();
    cy.TapMobilePaneFlipControl();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
    cy.DocPaneMermaidShouldShowDiagramOrMarkup();
  });

  it("keeps rendered Mermaid SVG after flipping to source and back to commentary", () => {
    cy.MobileStaticSiteCodeBrowserChromeShouldBeReady();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
    cy.DocPaneMermaidShouldShowDiagramOrMarkup();

    cy.TapMobilePaneFlipControl();
    cy.MobileSinglePaneLayoutShouldShowSourceColumnOnly();

    cy.TapMobilePaneFlipControl();
    cy.MobileSinglePaneLayoutShouldShowCommentaryColumnOnly();
    cy.DocPaneMermaidSvgShouldExist();
  });
});
