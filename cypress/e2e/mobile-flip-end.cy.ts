describe("Mobile flip at README tail on the shipped static home", () => {
  it("keeps the secondary flip hidden until the toolbar flip scrolls away, then syncs tail after flip", () => {
    cy.PrepareStaticSiteHomeForMobileFlipTailCheck();

    cy.MobileViewportShouldHaveScrollableDocument(200);
    cy.ScrollMobileDocumentToBottomAndFlush();
    cy.SecondaryMobileFlipShouldBeVisibleAndPrimaryShouldBeOffscreen();

    cy.TapMobilePaneFlipControl();
    cy.MobilePaneShouldShowTailFixtureSourceText();

    cy.ScrollMobileDocumentToBottomAndFlush();
    cy.SecondaryMobileFlipShouldBeVisibleAndPrimaryShouldBeOffscreen();
    cy.TapMobilePaneFlipControl();
    cy.MobilePaneShouldShowTailFlipMarkerText();
  });
});
