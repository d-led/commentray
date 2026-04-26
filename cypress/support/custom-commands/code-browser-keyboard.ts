import { shellA11y } from "../shell-a11y";

/**
 * Keyboard UX for the static code browser (search hits + documented-files tree).
 * Specs should compose these so scenarios read as BDD-style sentences.
 */

Cypress.Commands.add("SearchResultsHitButtonCountShouldBeAtLeast", (min: number) => {
  cy.get(shellA11y.search.hitButton).should("have.length.at.least", min);
});

Cypress.Commands.add("FirstSearchHitButtonShouldBeFocused", () => {
  cy.get(shellA11y.search.hitButton).first().should("be.focused");
});

Cypress.Commands.add("SearchHitButtonAtIndexShouldBeFocused", (zeroBasedIndex: number) => {
  cy.get(shellA11y.search.hitButton).eq(zeroBasedIndex).should("be.focused");
});

/** Assumes the search field is focused and a hit list is already visible (browse preview or query hits). */
Cypress.Commands.add("MoveSearchKeyboardFocusFromFieldToFirstHit", () => {
  cy.get(shellA11y.search.input).should("be.focused");
  cy.PressArrowDownInSearchField();
  cy.FirstSearchHitButtonShouldBeFocused();
});

Cypress.Commands.add("PressArrowUpInFocusedElement", () => {
  cy.focused().type("{uparrow}");
});

Cypress.Commands.add("PressArrowDownInFocusedElement", () => {
  cy.focused().type("{downarrow}");
});

Cypress.Commands.add("PressEnterInFocusedSearchField", () => {
  cy.get(shellA11y.search.input).should("be.focused");
  cy.get(shellA11y.search.input).type("{enter}");
});

Cypress.Commands.add("FocusCommentRayedFilesFilter", () => {
  cy.get(shellA11y.documentedFiles.filter).focus();
});

Cypress.Commands.add("CommentRayedFilesFilterShouldBeFocused", () => {
  cy.get(shellA11y.documentedFiles.filter).should("be.focused");
});

Cypress.Commands.add("MoveKeyboardFocusFromCommentRayedFilterToFirstTreeLink", () => {
  cy.FocusCommentRayedFilesFilter();
  cy.PressArrowDownInFocusedElement();
});

Cypress.Commands.add("FirstCommentRayedTreeFileLinkShouldBeFocused", () => {
  cy.get(shellA11y.documentedFiles.fileLink).first().should("be.focused");
});

Cypress.Commands.add("CommentRayedTreeFileLinkAtIndexShouldBeFocused", (zeroBasedIndex: number) => {
  cy.get(shellA11y.documentedFiles.fileLink).eq(zeroBasedIndex).should("be.focused");
});

Cypress.Commands.add("CommentRayedFilesTreeFileLinksShouldBeAtLeast", (min: number) => {
  cy.get(shellA11y.documentedFiles.fileLink).should("have.length.at.least", min);
});

Cypress.Commands.add("OpenCommentRayedFilesHubWithTreeVisible", () => {
  cy.OpenCommentRayedFilesDisclosure();
  cy.CommentRayedFilesTreeShouldExposeAtLeastOneFileLink();
});
