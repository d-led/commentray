export {};

declare global {
  namespace Cypress {
    interface Chainable {
      GoToStaticSiteHome(): Chainable<void>;
      GoToE2eDualScrollFixturePage(): Chainable<void>;

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
      FocusOnSearchField(): Chainable<void>;
      SearchFieldShouldBeFocused(): Chainable<void>;
      SearchFieldOutlineStyleShouldNotBeNone(): Chainable<void>;

      SearchFieldShouldExposeVisibleLabelText(): Chainable<void>;
      SearchClearButtonShouldBeVisibleWithClearText(): Chainable<void>;
      WrapLinesCheckboxShouldHaveLabeledWrapLinesText(): Chainable<void>;

      ColorThemeTriggerShouldAdvertisePopoverMenu(): Chainable<void>;
      ColorThemeMenuShouldStartHidden(): Chainable<void>;
      ClickColorThemeTrigger(): Chainable<void>;
      ColorThemeMenuShouldBeVisible(): Chainable<void>;
      ClickLightPresetInColorThemeMenu(): Chainable<void>;
      ColorThemeTriggerShouldReportLightMode(): Chainable<void>;
      ClickTopLeftOfMainLandmarkBody(): Chainable<void>;
      ColorThemeMenuShouldBeHidden(): Chainable<void>;

      AngleSelectControlShouldExist(): Chainable<void>;
      SearchResultsShouldBePoliteLiveRegion(): Chainable<void>;
      BlankTargetLinksShouldIncludeNoopenerInRel(): Chainable<void>;

      ApplyNarrowViewportForDualScrollFixture(): Chainable<void>;
      CurrentPageShouldDisplayDualPaneCodeBrowserChrome(): Chainable<void>;
      DocumentationPairStripShouldMentionDualScrollSourceFile(): Chainable<void>;
      ResizeSplitterGutterShouldExposeConnectorPaths(): Chainable<void>;
      AwaitDualPaneScrollSyncFlush(): Chainable<void>;
      ScrollCodePaneToMaximum(): Chainable<void>;
      ScrollDocPaneBodyToMaximum(): Chainable<void>;
      DocPaneBodyScrollTopShouldExceed(pixels: number): Chainable<void>;
      CodePaneScrollTopShouldExceed(pixels: number): Chainable<void>;
      CodeAndDocPanesScrollTopShouldBeZero(): Chainable<void>;

      CurrentPageShouldDisplayMainLandmarkAndSkipLink(): Chainable<void>;

      CommentrayPaneReadmeLinksShouldUseGithubBlobUrls(): Chainable<void>;
      CommentrayPaneEmphasisShouldRenderAfterBlocks(): Chainable<void>;
      DocumentationHomeLinkShouldPointToRelativeIndex(): Chainable<void>;
      ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage(): Chainable<void>;
      OpenCommentRayedFilesDisclosure(): Chainable<void>;
      CloseCommentRayedFilesHubWithEscape(): Chainable<void>;
      CommentRayedFilesTreeShouldExposeAtLeastOneFileLink(): Chainable<void>;
      FollowFirstBrowseFileLinkInTree(): Chainable<void>;
      ShellPairBrowseLinkShouldAvoidStackedBrowseSegments(): Chainable<void>;

      InterceptNavSearchIndexAsUnavailable(): Chainable<void>;
      CommentRayedFilesTreeShouldContainReadmeLink(): Chainable<void>;

      TypeTextInSearchField(text: string): Chainable<void>;
      SearchResultsPanelShouldBeVisible(): Chainable<void>;
      PressEscapeInSearchField(): Chainable<void>;
      SearchFieldValueShouldBeEmpty(): Chainable<void>;
      SearchResultsPanelShouldBeHidden(): Chainable<void>;
      SearchResultsHitMarksShouldExist(): Chainable<void>;
      PressArrowDownInSearchField(): Chainable<void>;
      SearchResultsShouldMentionIndexedSourceFiles(): Chainable<void>;
      SearchResultsHitButtonsShouldExist(): Chainable<void>;
      SearchResultsHitButtonCountShouldBeAtLeast(min: number): Chainable<void>;
      FirstSearchHitButtonShouldBeFocused(): Chainable<void>;
      SearchHitButtonAtIndexShouldBeFocused(zeroBasedIndex: number): Chainable<void>;
      MoveSearchKeyboardFocusFromFieldToFirstHit(): Chainable<void>;
      PressArrowUpInFocusedElement(): Chainable<void>;
      PressArrowDownInFocusedElement(): Chainable<void>;
      PressEnterInFocusedSearchField(): Chainable<void>;

      FocusCommentRayedFilesFilter(): Chainable<void>;
      CommentRayedFilesFilterShouldBeFocused(): Chainable<void>;
      MoveKeyboardFocusFromCommentRayedFilterToFirstTreeLink(): Chainable<void>;
      FirstCommentRayedTreeFileLinkShouldBeFocused(): Chainable<void>;
      CommentRayedTreeFileLinkAtIndexShouldBeFocused(zeroBasedIndex: number): Chainable<void>;
      CommentRayedFilesTreeFileLinksShouldBeAtLeast(min: number): Chainable<void>;
      OpenCommentRayedFilesHubWithTreeVisible(): Chainable<void>;

      OptionsOfAngleSelectShouldIncludeMainAndArchitecture(): Chainable<void>;
      DisplayedValueOfAngleSelectShouldBe(value: string): Chainable<void>;
      ChooseValueOfAngleSelect(value: string): Chainable<void>;
      CommentrayPaneShouldContainText(text: string): Chainable<void>;
      ShellPairBrowseLinkShouldMatchRelativeBrowseHtml(): Chainable<void>;
      ShellPairBrowseLinkShouldNotPointAtGithubHost(): Chainable<void>;

      DocPaneMermaidShouldShowDiagramOrMarkup(): Chainable<void>;
      DocPaneMermaidSvgShouldExist(): Chainable<void>;

      PrepareStaticSiteHomeAtMobileViewport(): Chainable<void>;
      MobileStaticSiteCodeBrowserChromeShouldBeReady(): Chainable<void>;
      MobileSinglePaneLayoutShouldShowCommentaryColumnOnly(): Chainable<void>;
      MobileSinglePaneLayoutShouldShowSourceColumnOnly(): Chainable<void>;
      TapMobilePaneFlipControl(): Chainable<void>;

      PrepareE2eMobileFlipEndFixtureAtMobileViewport(): Chainable<void>;
    }
  }
}
