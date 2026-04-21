import { DOCUMENT_LANG, STATIC_SITE_TITLE_PATTERN, shellA11y } from "../shell-a11y";

Cypress.Commands.add("shouldExposeHtmlLanguage", (expected = DOCUMENT_LANG) => {
  cy.get("html").should("have.attr", "lang", expected);
});

Cypress.Commands.add("shouldHavePageTitleMatching", (pattern) => {
  cy.title().should("match", pattern);
});

Cypress.Commands.add("shouldHaveMetaDescriptionContentMatching", (pattern) => {
  cy.get('meta[name="description"]').should("have.attr", "content").and("match", pattern);
});

Cypress.Commands.add("shouldHavePageTitleMatchingStaticSitePattern", () => {
  cy.shouldHavePageTitleMatching(STATIC_SITE_TITLE_PATTERN);
});

Cypress.Commands.add("shouldHaveMetaDescriptionMatchingStaticSitePattern", () => {
  cy.shouldHaveMetaDescriptionContentMatching(STATIC_SITE_TITLE_PATTERN);
});

Cypress.Commands.add("shouldDisplayBannerLandmark", () => {
  cy.get(shellA11y.banner).should("be.visible");
});

Cypress.Commands.add("shouldDisplaySrPageHeadingMatching", (pattern) => {
  cy.get(shellA11y.documentTitleHeading).invoke("text").should("match", pattern);
});

Cypress.Commands.add("shouldDisplaySrPageHeadingMatchingStaticSitePattern", () => {
  cy.shouldDisplaySrPageHeadingMatching(STATIC_SITE_TITLE_PATTERN);
});

Cypress.Commands.add("shouldDisplayPrimaryMainLandmark", () => {
  cy.get(shellA11y.main).should("exist");
});

Cypress.Commands.add("shouldDisplayContentInfoLandmark", () => {
  cy.get(shellA11y.contentinfo).should("exist");
});

Cypress.Commands.add("shouldLabelDualPanesSplitterAndInPageSearch", () => {
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
  cy.get(shellA11y.resizeSplitter).should("be.visible");
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("be.visible");
  });
});
