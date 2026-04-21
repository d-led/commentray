export {};

declare global {
  namespace Cypress {
    interface Chainable {
      visitStaticSiteHome(): Chainable<void>;
      visitE2eDualScrollSync(): Chainable<void>;
      shouldDisplayCodeBrowserShell(): Chainable<void>;
      shouldExposeNavSearchArtifact(): Chainable<void>;
      shouldHideDecorativeSvgsInDocPairLinks(): Chainable<void>;

      shouldExposeHtmlLanguage(expected?: string): Chainable<void>;
      shouldHavePageTitleMatching(pattern: RegExp): Chainable<void>;
      shouldHaveMetaDescriptionContentMatching(pattern: RegExp): Chainable<void>;
      shouldHavePageTitleMatchingStaticSitePattern(): Chainable<void>;
      shouldHaveMetaDescriptionMatchingStaticSitePattern(): Chainable<void>;

      shouldDisplayBannerLandmark(): Chainable<void>;
      shouldDisplaySrPageHeadingMatching(pattern: RegExp): Chainable<void>;
      shouldDisplaySrPageHeadingMatchingStaticSitePattern(): Chainable<void>;
      shouldDisplayPrimaryMainLandmark(): Chainable<void>;
      shouldDisplayContentInfoLandmark(): Chainable<void>;
      shouldLabelDualPanesSplitterAndInPageSearch(): Chainable<void>;

      shouldOfferSkipNavigationToMainContent(): Chainable<void>;
      shouldShowVisibleFocusIndicatorOnSearchWhenFocusedViaKeyboard(): Chainable<void>;

      shouldAssociateSearchFieldWithItsVisibleLabel(): Chainable<void>;
      shouldGiveClearSearchControlAnAccessibleName(): Chainable<void>;
      shouldUseLabeledCheckboxForLineWrap(): Chainable<void>;
      shouldExposeCompactColorThemeControlWithPopoverMenu(): Chainable<void>;
      shouldExposeAngleSelectorWithProgrammaticName(): Chainable<void>;

      shouldMarkSearchResultsAsPoliteLiveRegion(): Chainable<void>;
      shouldOpenOffSiteLinksInNewTabWithNoopener(): Chainable<void>;

      prepareNarrowViewportForDualScrollFixture(): Chainable<void>;
      shouldDisplayDualPaneCodeBrowserChrome(): Chainable<void>;
      shouldShowGutterConnectorArtworkBetweenPanesAfterLayout(): Chainable<void>;
      scrollCodePaneToEnd(): Chainable<void>;
      scrollDocPaneBodyToEnd(): Chainable<void>;
      shouldHaveDocPaneBodyScrolledPast(pixels: number): Chainable<void>;
      shouldHaveCodePaneScrolledPast(pixels: number): Chainable<void>;
      shouldHaveCodeAndDocPanesAtScrollTopZero(): Chainable<void>;

      shouldLinkCommentrayReadmeToGithubBlobUrls(): Chainable<void>;
      shouldRenderCommentrayInlineMarkdownEmphasis(): Chainable<void>;
      shouldExposeHubHomeLinkPairBrowseOnShellAndCollapsibleFileTree(): Chainable<void>;
      shouldServeBrowsePageWithoutStackedBrowsePathSegments(): Chainable<void>;
      interceptNavSearchIndexAsUnavailable(): Chainable<void>;
      shouldShowCommentrayedFilesTreeIncludingReadme(): Chainable<void>;
      shouldClearInPageSearchAndHideResultsOnEscape(): Chainable<void>;
      shouldHighlightSearchHitSnippetsWithMark(): Chainable<void>;
      shouldListIndexedSourceFilesWhenArrowDownOnEmptySearch(): Chainable<void>;
      shouldSwapAngleBetweenMainAndArchitectureWithExpectedBodiesAndBrowseHref(): Chainable<void>;
      shouldClearSearchWhenSwitchingAngle(): Chainable<void>;
      shouldShowMermaidDiagramOrMarkupInDocPaneForCurrentAngle(): Chainable<void>;
      shouldShowMermaidInCommentrayForMainAndArchitectureAngles(): Chainable<void>;

      shouldDisplayMainLandmarkAndSkipLinkOnCurrentPage(): Chainable<void>;
    }
  }
}
