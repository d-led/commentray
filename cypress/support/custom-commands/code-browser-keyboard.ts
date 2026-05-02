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

/** Forces vertical overflow so ArrowDown through hits must scroll `#search-results`. */
Cypress.Commands.add("ConstrainSearchResultsPanelHeightForScrollCoverage", () => {
  cy.get(shellA11y.search.results)
    .should("be.visible")
    .then(($r) => {
      cy.wrap($r).invoke("css", "max-height", "48px").invoke("css", "overflow-y", "auto");
    });
});

/** Assumes keyboard focus is already on the first hit; walks to the last with ArrowDown. */
Cypress.Commands.add("SearchKeyboardNavigateFromFirstHitToLastHit", () => {
  cy.get(shellA11y.search.hitButton).then(($hits) => {
    const n = $hits.length;
    expect(n, "search hit count").to.be.at.least(2);
    for (let i = 0; i < n - 1; i += 1) {
      cy.PressArrowDownInFocusedElement();
    }
    cy.get(shellA11y.search.hitButton).last().should("be.focused");
  });
});

Cypress.Commands.add("SearchResultsPanelScrollTopShouldBeGreaterThan", (pixels: number) => {
  cy.get(shellA11y.search.results).invoke("scrollTop").should("be.gt", pixels);
});

Cypress.Commands.add("ConstrainCommentRayedFilesTreeHeightForScrollCoverage", () => {
  cy.get(shellA11y.documentedFiles.tree)
    .should("be.visible")
    .then(($t) => {
      cy.wrap($t).invoke("css", "max-height", "36px").invoke("css", "overflow-y", "auto");
    });
});

/** Assumes keyboard focus is already on the first tree file link. */
Cypress.Commands.add("TreeKeyboardNavigateFromFirstLinkToLastLink", () => {
  cy.get(shellA11y.documentedFiles.fileLink).then(($links) => {
    const n = $links.length;
    expect(n, "tree file link count").to.be.at.least(2);
    for (let i = 0; i < n - 1; i += 1) {
      cy.PressArrowDownInFocusedElement();
    }
    cy.get(shellA11y.documentedFiles.fileLink).last().should("be.focused");
  });
});

Cypress.Commands.add("CommentRayedFilesTreeScrollTopShouldBeGreaterThan", (pixels: number) => {
  cy.get(shellA11y.documentedFiles.tree).invoke("scrollTop").should("be.gt", pixels);
});

/** Pointer target outside the hub (`#documented-files-hub`); closes the `<details>` panel. */
Cypress.Commands.add("ClickMainLandmarkToDismissCommentRayedFilesHub", () => {
  cy.get(shellA11y.main).should("be.visible").click(12, 12);
});

Cypress.Commands.add("CommentRayedFilesHubOpenPropShouldBe", (open: boolean) => {
  cy.get(shellA11y.documentedFiles.hub).should("have.prop", "open", open);
});
