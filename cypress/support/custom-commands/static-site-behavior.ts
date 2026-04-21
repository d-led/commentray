import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("CommentrayPaneReadmeLinksShouldUseGithubBlobUrls", () => {
  cy.get(shellA11y.panes.commentray)
    .invoke("html")
    .should("match", /https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/README\.md/)
    .and("not.match", /href="\.\.\/README\.md"/);
});

Cypress.Commands.add("CommentrayPaneEmphasisShouldRenderAfterBlocks", () => {
  cy.get(shellA11y.panes.commentray).find("em").should("have.length.at.least", 1);
  cy.get(`${shellA11y.panes.commentray} em`).first().should("contain.text", "You have the main");
});

Cypress.Commands.add("DocumentationHomeLinkShouldPointToRelativeIndex", () => {
  cy.get('a[aria-label="Documentation home"]').should("have.attr", "href", "./");
});

Cypress.Commands.add("ShellPairBrowseLinkShouldAdvertiseOnSiteBrowsePage", () => {
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("match", /\.\/browse\/[^/]+\.html$/)
    .and("not.include", "github.com");
});

Cypress.Commands.add("CommentRayedFilesSummaryClick", () => {
  cy.contains("summary", "Comment-rayed files").click();
});

Cypress.Commands.add("CommentRayedFilesTreeShouldExposeAtLeastOneFileLink", () => {
  cy.get('[role="tree"]', { timeout: 15000 })
    .find("a")
    .should("have.length.at.least", 1)
    .first()
    .should("be.visible");
});

Cypress.Commands.add("TreeFirstBrowseFileLinkVisit", () => {
  cy.get('[role="tree"]', { timeout: 15000 })
    .find('a.tree-file-link[href*="/browse/"]')
    .first()
    .then(($a) => {
      const href = $a.attr("href");
      expect(href)
        .to.be.a("string")
        .and.match(/\/browse\/[^/]+\.html(\?.*)?$/);
      if (typeof href !== "string") {
        throw new Error("Expected browse tree link href");
      }
      cy.visit(href);
    });
});

Cypress.Commands.add("ShellPairBrowseLinkShouldAvoidStackedBrowseSegments", () => {
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("match", /\.\/browse\/[^/]+\.html(\?.*)?$/)
    .and("not.contain", "/browse/browse/");
});

Cypress.Commands.add("NavSearchIndexGetInterceptAsUnavailable", () => {
  cy.intercept("GET", "**/commentray-nav-search.json", { statusCode: 503, body: "{}" }).as(
    "navJsonFail",
  );
});

Cypress.Commands.add("CommentRayedFilesTreeShouldContainReadmeLink", () => {
  cy.get('[role="tree"]', { timeout: 15000 }).contains("a", "README.md");
});

Cypress.Commands.add("SearchFieldType", (text) => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type(text);
  });
});

Cypress.Commands.add("SearchResultsPanelShouldBeVisible", () => {
  cy.get("#search-results").should("be.visible");
});

Cypress.Commands.add("SearchFieldEscapeKeyPress", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type("{esc}");
  });
});

Cypress.Commands.add("SearchFieldValueShouldBeEmpty", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("have.value", "");
  });
});

Cypress.Commands.add("SearchResultsPanelShouldBeHidden", () => {
  cy.get("#search-results").should("not.be.visible");
});

Cypress.Commands.add("SearchResultsHitMarksShouldExist", () => {
  cy.get("#search-results mark").should("have.length.at.least", 1);
});

Cypress.Commands.add("SearchFieldArrowDownKeyPress", () => {
  cy.get(shellA11y.search.input).type("{downarrow}");
});

Cypress.Commands.add("SearchResultsShouldMentionIndexedSourceFiles", () => {
  cy.get("#search-results .hint").first().should("contain", "Indexed source files");
});

Cypress.Commands.add("SearchResultsHitButtonsShouldExist", () => {
  cy.get("#search-results button.hit").should("have.length.at.least", 1);
});

Cypress.Commands.add("AngleSelectShouldExposeMainAndArchitectureOptions", () => {
  cy.get(shellA11y.angleSelect).should("exist");
  cy.get(`${shellA11y.angleSelect} option`).should("have.length.at.least", 2);
  cy.get(`${shellA11y.angleSelect} option[value="main"]`).should("exist");
  cy.get(`${shellA11y.angleSelect} option[value="architecture"]`).should("exist");
});

Cypress.Commands.add("AngleSelectShouldHaveValue", (value) => {
  cy.get(shellA11y.angleSelect).should("have.value", value);
});

Cypress.Commands.add("AngleSelectChooseValue", (value) => {
  cy.get(shellA11y.angleSelect).select(value);
});

Cypress.Commands.add("CommentrayPaneShouldContainText", (text) => {
  cy.get(shellA11y.panes.commentray).should("contain", text);
});

Cypress.Commands.add("ShellPairBrowseLinkShouldMatchRelativeBrowseHtml", () => {
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("match", /\.\/browse\/[^/]+\.html$/);
});

Cypress.Commands.add("ShellPairBrowseLinkShouldNotPointAtGithubHost", () => {
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("not.include", "github.com");
});

Cypress.Commands.add("DocPaneMermaidShouldShowDiagramOrMarkup", () => {
  cy.get("#doc-pane-body").should(($body) => {
    const unrendered = $body.find(".commentray-mermaid pre.mermaid").length;
    const rendered = $body.find("svg").length;
    expect(unrendered + rendered).to.be.at.least(1);
  });
  cy.get("#doc-pane-body").should("not.contain", "Syntax error in text");
});
