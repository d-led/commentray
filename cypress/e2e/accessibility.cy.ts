describe("Commentray static site — accessibility", () => {
  beforeEach(() => {
    cy.visitStaticSiteHome();
  });

  it("should expose html language, page title, and meta description", () => {
    cy.shouldExposeHtmlLanguage();
    cy.shouldHavePageTitleMatchingStaticSitePattern();
    cy.shouldHaveMetaDescriptionMatchingStaticSitePattern();
  });

  it("should provide a banner, primary main region, and a screen-reader page heading", () => {
    cy.shouldDisplayBannerLandmark();
    cy.shouldDisplaySrPageHeadingMatchingStaticSitePattern();
    cy.shouldDisplayPrimaryMainLandmark();
    cy.shouldDisplayContentInfoLandmark();
  });

  it("should label the dual panes, splitter, and in-page search region", () => {
    cy.shouldLabelDualPanesSplitterAndInPageSearch();
  });

  it("should offer skip navigation to main content", () => {
    cy.shouldOfferSkipNavigationToMainContent();
  });

  it("should show a visible focus indicator on the search field when focused via keyboard", () => {
    cy.shouldShowVisibleFocusIndicatorOnSearchWhenFocusedViaKeyboard();
  });

  it("should associate the search field with its visible label", () => {
    cy.shouldAssociateSearchFieldWithItsVisibleLabel();
  });

  it("should give the clear-search control an accessible name", () => {
    cy.shouldGiveClearSearchControlAnAccessibleName();
  });

  it("should use a labeled checkbox for line wrap", () => {
    cy.shouldUseLabeledCheckboxForLineWrap();
  });

  it("should expose a compact color theme control with a popover menu", () => {
    cy.shouldExposeCompactColorThemeControlWithPopoverMenu();
  });

  it("should expose the angle selector with a programmatic name", () => {
    cy.shouldExposeAngleSelectorWithProgrammaticName();
  });

  it("should mark search results as a polite live region", () => {
    cy.shouldMarkSearchResultsAsPoliteLiveRegion();
  });

  it("should open off-site links in a new tab with noopener", () => {
    cy.shouldOpenOffSiteLinksInNewTabWithNoopener();
  });

  it("should hide decorative svgs in documentation pair toolbar links", () => {
    cy.shouldHideDecorativeSvgsInDocPairLinks();
  });
});

describe("E2E dual-scroll fixture — accessibility shell", () => {
  it("should reuse the same main landmark and skip link as the site root", () => {
    cy.visitE2eDualScrollSync();
    cy.shouldDisplayMainLandmarkAndSkipLinkOnCurrentPage();
  });
});
