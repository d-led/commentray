describe("Commentray static site — accessibility", () => {
  beforeEach(() => {
    cy.VisitStaticSiteHome();
  });

  it("Document chrome exposes language, title, and landmarks for assistive tech", () => {
    cy.DocumentShouldExposeHtmlLanguage();
    cy.DocumentTitleShouldMatchStaticSitePattern();
    cy.MetaDescriptionShouldMatchStaticSitePattern();
    cy.BannerLandmarkShouldBeVisible();
    cy.PageHeadingShouldMatchStaticSitePattern();
    cy.MainLandmarkShouldExist();
    cy.ContentinfoLandmarkShouldExist();
  });

  it("Reading layout wires dual panes, skip link, search labelling, and a polite results region", () => {
    cy.DualPanesSplitterSearchRegionShouldBeVisible();
    cy.SkipNavigationLinkShouldTargetMainContent();
    cy.SearchFieldShouldExposeVisibleLabelText();
    cy.SearchClearButtonShouldBeVisibleWithClearText();
    cy.WrapLinesCheckboxShouldHaveLabeledWrapLinesText();
    cy.AngleSelectShouldExist();
    cy.SearchResultsShouldBePoliteLiveRegion();
  });

  it("Search field shows a non-none outline once it receives focus", () => {
    cy.SearchFieldFocus();
    cy.SearchFieldShouldBeFocused();
    cy.SearchFieldOutlineStyleShouldNotBeNone();
  });

  it("Color theme popover opens, applies light, and dismisses without leaving the menu open", () => {
    cy.ColorThemeTriggerShouldAdvertisePopoverMenu();
    cy.ColorThemeMenuShouldStartHidden();
    cy.ColorThemeTriggerClick();
    cy.ColorThemeMenuShouldBeVisible();
    cy.ColorThemePresetLightOptionClick();
    cy.ColorThemeTriggerShouldReportLightMode();
    cy.MainLandmarkBodyClickTopLeft();
    cy.ColorThemeMenuShouldBeHidden();
  });

  it("External navigation stays safe and toolbar icons stay decorative", () => {
    cy.BlankTargetLinksShouldIncludeNoopenerInRel();
    cy.DocPairGithubToolbarLinksShouldMarkSvgsDecorative();
  });
});

describe("E2E dual-scroll fixture — accessibility shell", () => {
  it("Fixture page keeps the same main landmark and skip affordance as the hub", () => {
    cy.VisitE2eDualScrollFixture();
    cy.CurrentPageShouldDisplayMainLandmarkAndSkipLink();
  });
});
