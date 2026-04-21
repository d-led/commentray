describe("Commentray static site — accessibility", () => {
  beforeEach(() => {
    cy.GoToStaticSiteHome();
  });

  it("Page identity and landmarks support assistive navigation", () => {
    cy.DocumentShouldExposeHtmlLanguage();
    cy.DocumentTitleShouldMatchStaticSitePattern();
    cy.MetaDescriptionShouldMatchStaticSitePattern();
    cy.BannerLandmarkShouldBeVisible();
    cy.PageHeadingShouldMatchStaticSitePattern();
    cy.MainLandmarkShouldExist();
    cy.ContentinfoLandmarkShouldExist();
  });

  it("Primary reading surface exposes structure for keyboard and announcements", () => {
    cy.DualPanesSplitterSearchRegionShouldBeVisible();
    cy.SkipNavigationLinkShouldTargetMainContent();
    cy.SearchFieldShouldExposeVisibleLabelText();
    cy.SearchClearButtonShouldBeVisibleWithClearText();
    cy.WrapLinesCheckboxShouldHaveLabeledWrapLinesText();
    cy.AngleSelectControlShouldExist();
    cy.SearchResultsShouldBePoliteLiveRegion();
  });

  it("Focused search shows a visible focus ring", () => {
    cy.FocusOnSearchField();
    cy.SearchFieldShouldBeFocused();
    cy.SearchFieldOutlineStyleShouldNotBeNone();
  });

  it("Theme picker applies a choice and can be dismissed without leaving the menu open", () => {
    cy.ColorThemeTriggerShouldAdvertisePopoverMenu();
    cy.ColorThemeMenuShouldStartHidden();
    cy.ClickColorThemeTrigger();
    cy.ColorThemeMenuShouldBeVisible();
    cy.ClickLightPresetInColorThemeMenu();
    cy.ColorThemeTriggerShouldReportLightMode();
    cy.ClickTopLeftOfMainLandmarkBody();
    cy.ColorThemeMenuShouldBeHidden();
  });

  it("External links and toolbar icons follow safe and decorative patterns", () => {
    cy.BlankTargetLinksShouldIncludeNoopenerInRel();
    cy.DocPairGithubToolbarLinksShouldMarkSvgsDecorative();
  });
});

describe("E2E dual-scroll fixture — accessibility shell", () => {
  it("Fixture shell matches hub landmark and skip affordances", () => {
    cy.GoToE2eDualScrollFixturePage();
    cy.CurrentPageShouldDisplayMainLandmarkAndSkipLink();
  });
});
