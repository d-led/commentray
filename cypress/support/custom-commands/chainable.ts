export {};

declare global {
  namespace Cypress {
    interface Chainable {
      VisitStaticSiteHome(): Chainable<void>;
      VisitE2eDualScrollFixture(): Chainable<void>;

      CurrentPageShouldDisplayCodeBrowserShell(): Chainable<void>;
      NavSearchArtifactGetRequestShouldReturnSchemaVersion(): Chainable<void>;
      DocPairGithubToolbarLinksShouldMarkSvgsDecorative(): Chainable<void>;

      DocumentShouldExposeHtmlLanguage(expected?: string): Chainable<void>;
      DocumentTitleShouldMatch(pattern: RegExp): Chainable<void>;
      MetaDescriptionContentShouldMatch(pattern: RegExp): Chainable<void>;
      DocumentTitleShouldMatchStaticSitePattern(): Chainable<void>;
      MetaDescriptionShouldMatchStaticSitePattern(): Chainable<void>;

      BannerLandmarkShouldBeVisible(): Chainable<void>;
      PageHeadingShouldMatch(pattern: RegExp): Chainable<void>;
      PageHeadingShouldMatchStaticSitePattern(): Chainable<void>;
      MainLandmarkShouldExist(): Chainable<void>;
      ContentinfoLandmarkShouldExist(): Chainable<void>;
      DualPanesSplitterSearchRegionShouldBeVisible(): Chainable<void>;

      SkipNavigationLinkShouldTargetMainContent(): Chainable<void>;
      SearchFieldFocus(): Chainable<void>;
      SearchFieldShouldBeFocused(): Chainable<void>;
      SearchFieldOutlineStyleShouldNotBeNone(): Chainable<void>;

      SearchFieldShouldExposeVisibleLabelText(): Chainable<void>;
      SearchClearButtonShouldBeVisibleWithClearText(): Chainable<void>;
      WrapLinesCheckboxShouldHaveLabeledWrapLinesText(): Chainable<void>;

      ColorThemeTriggerShouldAdvertisePopoverMenu(): Chainable<void>;
      ColorThemeMenuShouldStartHidden(): Chainable<void>;
      ColorThemeTriggerClick(): Chainable<void>;
      ColorThemeMenuShouldBeVisible(): Chainable<void>;
      ColorThemePresetLightOptionClick(): Chainable<void>;
      ColorThemeTriggerShouldReportLightMode(): Chainable<void>;
      MainLandmarkBodyClickTopLeft(): Chainable<void>;
      ColorThemeMenuShouldBeHidden(): Chainable<void>;

      AngleSelectShouldExist(): Chainable<void>;
      SearchResultsShouldBePoliteLiveRegion(): Chainable<void>;
      BlankTargetLinksShouldIncludeNoopenerInRel(): Chainable<void>;

      ViewportResizeForDualScrollScenario(): Chainable<void>;
      CurrentPageShouldDisplayDualPaneCodeBrowserChrome(): Chainable<void>;
      DocumentationPairStripShouldMentionDualScrollSourceFile(): Chainable<void>;
      ResizeSplitterGutterShouldExposeConnectorPaths(): Chainable<void>;
      CodePaneScrollToMaxScroll(): Chainable<void>;
      DocPaneBodyScrollToMaxScroll(): Chainable<void>;
      DocPaneBodyScrollTopShouldExceed(pixels: number): Chainable<void>;
      CodePaneScrollTopShouldExceed(pixels: number): Chainable<void>;
      CodeAndDocPanesScrollTopShouldBeZero(): Chainable<void>;

      CurrentPageShouldDisplayMainLandmarkAndSkipLink(): Chainable<void>;

      CommentrayPaneReadmeLinksShouldUseGithubBlobUrls(): Chainable<void>;
      CommentrayPaneEmphasisShouldRenderAfterBlocks(): Chainable<void>;
      DocumentationHomeLinkShouldPointToRelativeIndex(): Chainable<void>;
      ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage(): Chainable<void>;
      CommentRayedFilesSummaryClick(): Chainable<void>;
      CommentRayedFilesTreeShouldExposeAtLeastOneFileLink(): Chainable<void>;
      TreeFirstBrowseFileLinkVisit(): Chainable<void>;
      ShellPairBrowseLinkShouldAvoidStackedBrowseSegments(): Chainable<void>;

      NavSearchIndexGetInterceptAsUnavailable(): Chainable<void>;
      CommentRayedFilesTreeShouldContainReadmeLink(): Chainable<void>;

      SearchFieldType(text: string): Chainable<void>;
      SearchResultsPanelShouldBeVisible(): Chainable<void>;
      SearchFieldEscapeKeyPress(): Chainable<void>;
      SearchFieldValueShouldBeEmpty(): Chainable<void>;
      SearchResultsPanelShouldBeHidden(): Chainable<void>;
      SearchResultsHitMarksShouldExist(): Chainable<void>;
      SearchFieldArrowDownKeyPress(): Chainable<void>;
      SearchResultsShouldMentionIndexedSourceFiles(): Chainable<void>;
      SearchResultsHitButtonsShouldExist(): Chainable<void>;

      AngleSelectShouldExposeMainAndArchitectureOptions(): Chainable<void>;
      AngleSelectShouldHaveValue(value: string): Chainable<void>;
      AngleSelectChooseValue(value: string): Chainable<void>;
      CommentrayPaneShouldContainText(text: string): Chainable<void>;
      ShellPairBrowseLinkShouldMatchRelativeBrowseHtml(): Chainable<void>;
      ShellPairBrowseLinkShouldNotPointAtGithubHost(): Chainable<void>;

      DocPaneMermaidShouldShowDiagramOrMarkup(): Chainable<void>;
    }
  }
}
