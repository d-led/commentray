/**
 * BDD-style labels: static Pages output from `npm run pages:build` (_site/).
 */
describe("Commentray static site (GitHub Pages build)", () => {
  describe("given the built index is served at /", () => {
    it("then the code browser shell, panes, and search are present", () => {
      cy.visitStaticSiteHome();
      cy.shouldDisplayCodeBrowserShell();
    });

    it("then the nav search JSON artifact is reachable", () => {
      cy.shouldExposeNavSearchArtifact();
    });

    it("then commentray pane links to README stay on github.com blob URLs (not ../README.md on Pages)", () => {
      cy.visitStaticSiteHome();
      cy.get('[aria-label="Commentray"]')
        .invoke("html")
        .should("match", /https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/README\.md/)
        .and("not.match", /href="\.\.\/README\.md"/);
    });

    it("then the commentray pane renders inline markdown after block markers (not raw underscores)", () => {
      cy.visitStaticSiteHome();
      cy.get('[aria-label="Commentray"]').find("em").should("have.length.at.least", 1);
      cy.get('[aria-label="Commentray"] em').first().should("contain.text", "You have the main");
    });

    it("then the hub exposes a same-site home link, GitHub source link, same-site Doc browse link, and a collapsible Comment-rayed files tree", () => {
      cy.visitStaticSiteHome();
      cy.get('a[aria-label="Documentation home"]').should("have.attr", "href", "./");
      cy.get('a[aria-label="Source file on GitHub"]')
        .should("have.attr", "href")
        .and("match", /github\.com/);
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /\/browse\/[^/]+\.html$/)
        .and("not.include", "github.com");
      cy.contains("summary", "Comment-rayed files").click();
      cy.get('[role="tree"]', { timeout: 15000 })
        .find("a")
        .should("have.length.at.least", 1)
        .first()
        .should("be.visible");
    });

    it("then the Comment-rayed files list still appears when the nav search index cannot be fetched", () => {
      cy.intercept("GET", "**/commentray-nav-search.json", { statusCode: 503, body: "{}" }).as(
        "navJsonFail",
      );
      cy.visitStaticSiteHome();
      cy.contains("summary", "Comment-rayed files").click();
      cy.get('[role="tree"]', { timeout: 15000 }).contains("a", "README.md");
    });

    it("then Escape clears in-page search and hides hit results", () => {
      cy.visitStaticSiteHome();
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').type("commentray");
      });
      cy.get("#search-results").should("be.visible");
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').type("{esc}");
        cy.get('input[type="search"]').should("have.value", "");
      });
      cy.get("#search-results").should("not.be.visible");
    });

    it("then search hit snippets highlight matched query tokens", () => {
      cy.visitStaticSiteHome();
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').type("commentray");
      });
      cy.get("#search-results").should("be.visible");
      cy.get("#search-results mark").should("have.length.at.least", 1);
    });

    it("then ArrowDown on an empty search shows a capped list of indexed source files", () => {
      cy.visitStaticSiteHome();
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').focus().type("{downarrow}");
      });
      cy.get("#search-results").should("be.visible");
      cy.get("#search-results .hint").first().should("contain", "Indexed source files");
      cy.get("#search-results button.hit").should("have.length.at.least", 1);
    });

    it("then the Angle selector lists main and architecture and swaps commentray bodies both ways", () => {
      cy.visitStaticSiteHome();
      cy.get('select[aria-label="Commentray angle"]').should("exist");
      cy.get('select[aria-label="Commentray angle"] option').should("have.length.at.least", 2);
      cy.get('select[aria-label="Commentray angle"] option[value="main"]').should("exist");
      cy.get('select[aria-label="Commentray angle"] option[value="architecture"]').should("exist");
      cy.get('select[aria-label="Commentray angle"]').should("have.value", "main");

      cy.get('[aria-label="Commentray"]').should("contain", "quick-start");

      cy.get('select[aria-label="Commentray angle"]').select("architecture");
      cy.get('select[aria-label="Commentray angle"]').should("have.value", "architecture");
      cy.get('[aria-label="Commentray"]').should("contain", "architecture angle");
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /\/browse\/[^/]+\.html$/)
        .and("not.include", "github.com");

      cy.get('select[aria-label="Commentray angle"]').select("main");
      cy.get('select[aria-label="Commentray angle"]').should("have.value", "main");
      cy.get('[aria-label="Commentray"]').should("contain", "quick-start");
      cy.get("#toolbar-commentray-github")
        .should("have.attr", "href")
        .and("match", /\/browse\/[^/]+\.html$/)
        .and("not.include", "github.com");
    });

    it("then switching Angle clears the in-page search field and hides results", () => {
      cy.visitStaticSiteHome();
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').type("quickstart");
      });
      cy.get("#search-results").should("be.visible");
      cy.get('select[aria-label="Commentray angle"]').select("architecture");
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]').should("have.value", "");
      });
      cy.get("#search-results").should("not.be.visible");
    });

    it("then Mermaid diagram blocks are present in the commentray pane (Main and Architecture)", () => {
      /**
       * Runtime rendering pulls Mermaid from a CDN; Cypress cannot reliably await SVG output across
       * async ESM load + DOM replacement. We assert the shipped diagram markup (or rendered SVG)
       * instead of coupling the smoke test to network timing.
       */
      const assertMermaidDiagramPresent = () => {
        cy.get("#doc-pane-body").should(($body) => {
          const unrendered = $body.find(".commentray-mermaid pre.mermaid").length;
          const rendered = $body.find("svg").length;
          expect(unrendered + rendered).to.be.at.least(1);
        });
        cy.get("#doc-pane-body").should("not.contain", "Syntax error in text");
      };

      cy.visitStaticSiteHome();
      assertMermaidDiagramPresent();

      cy.get('select[aria-label="Commentray angle"]').select("architecture");
      cy.get('select[aria-label="Commentray angle"]').should("have.value", "architecture");
      assertMermaidDiagramPresent();
    });
  });
});
