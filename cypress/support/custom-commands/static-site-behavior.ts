import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("shouldLinkCommentrayReadmeToGithubBlobUrls", () => {
  cy.get(shellA11y.panes.commentray)
    .invoke("html")
    .should("match", /https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/README\.md/)
    .and("not.match", /href="\.\.\/README\.md"/);
});

Cypress.Commands.add("shouldRenderCommentrayInlineMarkdownEmphasis", () => {
  cy.get(shellA11y.panes.commentray).find("em").should("have.length.at.least", 1);
  cy.get(`${shellA11y.panes.commentray} em`).first().should("contain.text", "You have the main");
});

Cypress.Commands.add("shouldExposeHubHomeLinkPairBrowseOnShellAndCollapsibleFileTree", () => {
  cy.get('a[aria-label="Documentation home"]').should("have.attr", "href", "./");
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("match", /\.\/browse\/[^/]+\.html$/)
    .and("not.include", "github.com");
  cy.contains("summary", "Comment-rayed files").click();
  cy.get('[role="tree"]', { timeout: 15000 })
    .find("a")
    .should("have.length.at.least", 1)
    .first()
    .should("be.visible");
});

Cypress.Commands.add("shouldServeBrowsePageWithoutStackedBrowsePathSegments", () => {
  cy.contains("summary", "Comment-rayed files").click();
  cy.get('[role="tree"]', { timeout: 15000 })
    .find('a.tree-file-link[href*="/browse/"]')
    .first()
    .then(($a) => {
      const href = $a.attr("href");
      expect(href)
        .to.be.a("string")
        .and.match(/\/browse\/[^/]+\.html(\?.*)?$/);
      cy.visit(href!);
    });
  cy.shouldDisplayCodeBrowserShell();
  cy.get("#shell")
    .should("have.attr", "data-commentray-pair-browse-href")
    .and("match", /\.\/browse\/[^/]+\.html(\?.*)?$/)
    .and("not.contain", "/browse/browse/");
});

Cypress.Commands.add("interceptNavSearchIndexAsUnavailable", () => {
  cy.intercept("GET", "**/commentray-nav-search.json", { statusCode: 503, body: "{}" }).as(
    "navJsonFail",
  );
});

Cypress.Commands.add("shouldShowCommentrayedFilesTreeIncludingReadme", () => {
  cy.contains("summary", "Comment-rayed files").click();
  cy.get('[role="tree"]', { timeout: 15000 }).contains("a", "README.md");
});

Cypress.Commands.add("shouldClearInPageSearchAndHideResultsOnEscape", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type("commentray");
  });
  cy.get("#search-results").should("be.visible");
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type("{esc}");
    cy.get('input[type="search"]').should("have.value", "");
  });
  cy.get("#search-results").should("not.be.visible");
});

Cypress.Commands.add("shouldHighlightSearchHitSnippetsWithMark", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type("commentray");
  });
  cy.get("#search-results").should("be.visible");
  cy.get("#search-results mark").should("have.length.at.least", 1);
});

Cypress.Commands.add("shouldListIndexedSourceFilesWhenArrowDownOnEmptySearch", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').focus().type("{downarrow}");
  });
  cy.get("#search-results").should("be.visible");
  cy.get("#search-results .hint").first().should("contain", "Indexed source files");
  cy.get("#search-results button.hit").should("have.length.at.least", 1);
});

Cypress.Commands.add(
  "shouldSwapAngleBetweenMainAndArchitectureWithExpectedBodiesAndBrowseHref",
  () => {
    cy.get(shellA11y.angleSelect).should("exist");
    cy.get(`${shellA11y.angleSelect} option`).should("have.length.at.least", 2);
    cy.get(`${shellA11y.angleSelect} option[value="main"]`).should("exist");
    cy.get(`${shellA11y.angleSelect} option[value="architecture"]`).should("exist");
    cy.get(shellA11y.angleSelect).should("have.value", "main");
    cy.get(shellA11y.panes.commentray).should("contain", "quick-start");

    cy.get(shellA11y.angleSelect).select("architecture");
    cy.get(shellA11y.angleSelect).should("have.value", "architecture");
    cy.get(shellA11y.panes.commentray).should("contain", "architecture angle");
    cy.get("#shell")
      .should("have.attr", "data-commentray-pair-browse-href")
      .and("match", /\.\/browse\/[^/]+\.html$/)
      .and("not.include", "github.com");

    cy.get(shellA11y.angleSelect).select("main");
    cy.get(shellA11y.angleSelect).should("have.value", "main");
    cy.get(shellA11y.panes.commentray).should("contain", "quick-start");
    cy.get("#shell")
      .should("have.attr", "data-commentray-pair-browse-href")
      .and("match", /\.\/browse\/[^/]+\.html$/)
      .and("not.include", "github.com");
  },
);

Cypress.Commands.add("shouldClearSearchWhenSwitchingAngle", () => {
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').type("quickstart");
  });
  cy.get("#search-results").should("be.visible");
  cy.get(shellA11y.angleSelect).select("architecture");
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("have.value", "");
  });
  cy.get("#search-results").should("not.be.visible");
});

Cypress.Commands.add("shouldShowMermaidDiagramOrMarkupInDocPaneForCurrentAngle", () => {
  cy.get("#doc-pane-body").should(($body) => {
    const unrendered = $body.find(".commentray-mermaid pre.mermaid").length;
    const rendered = $body.find("svg").length;
    expect(unrendered + rendered).to.be.at.least(1);
  });
  cy.get("#doc-pane-body").should("not.contain", "Syntax error in text");
});

Cypress.Commands.add("shouldShowMermaidInCommentrayForMainAndArchitectureAngles", () => {
  cy.shouldShowMermaidDiagramOrMarkupInDocPaneForCurrentAngle();
  cy.get(shellA11y.angleSelect).select("architecture");
  cy.get(shellA11y.angleSelect).should("have.value", "architecture");
  cy.shouldShowMermaidDiagramOrMarkupInDocPaneForCurrentAngle();
});
