import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("shouldOfferSkipNavigationToMainContent", () => {
  cy.get(shellA11y.skipToMainLink)
    .should("have.attr", "href", "#main-content")
    .and(($a) => {
      expect($a.text().toLowerCase()).to.contain("skip");
    });
});

Cypress.Commands.add("shouldShowVisibleFocusIndicatorOnSearchWhenFocusedViaKeyboard", () => {
  cy.get(shellA11y.search.input).focus();
  cy.get(shellA11y.search.input).should("be.focused");
  cy.get(shellA11y.search.input).should("have.css", "outline-style").and("not.eq", "none");
});

Cypress.Commands.add("shouldAssociateSearchFieldWithItsVisibleLabel", () => {
  cy.get(shellA11y.search.label).should("contain", "Search");
});

Cypress.Commands.add("shouldGiveClearSearchControlAnAccessibleName", () => {
  cy.get(shellA11y.search.clearButton).should("be.visible").and("contain", "Clear");
});

Cypress.Commands.add("shouldUseLabeledCheckboxForLineWrap", () => {
  cy.get(shellA11y.wrapLinesLabel).should("contain", "Wrap code lines");
});

Cypress.Commands.add("shouldExposeCompactColorThemeControlWithPopoverMenu", () => {
  cy.get(shellA11y.colorThemeTrigger)
    .should("be.visible")
    .and("have.attr", "aria-haspopup", "menu")
    .and("have.attr", "aria-expanded", "false");
  cy.get(shellA11y.colorThemeMenu).should("have.attr", "hidden");
  cy.get(shellA11y.colorThemeTrigger).click();
  cy.get(shellA11y.colorThemeMenu)
    .should("be.visible")
    .find('[data-commentray-theme-value="light"]')
    .click();
  cy.get(shellA11y.colorThemeTrigger).should("have.attr", "data-commentray-trigger-mode", "light");
  cy.get(shellA11y.main).click("topLeft", { force: true });
  cy.get(shellA11y.colorThemeMenu).should("have.attr", "hidden");
});

Cypress.Commands.add("shouldExposeAngleSelectorWithProgrammaticName", () => {
  cy.get(shellA11y.angleSelect).should("exist");
});

Cypress.Commands.add("shouldMarkSearchResultsAsPoliteLiveRegion", () => {
  cy.get(shellA11y.search.results).should("have.attr", "aria-live", "polite");
});

Cypress.Commands.add("shouldOpenOffSiteLinksInNewTabWithNoopener", () => {
  cy.get('a[target="_blank"]').each(($a) => {
    cy.wrap($a).invoke("attr", "rel").should("match", /noopener/);
  });
});
