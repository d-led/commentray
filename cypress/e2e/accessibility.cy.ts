/**
 * Structural and keyboard accessibility checks for the static code browser shell
 * (`npm run pages:build` → `_site/`).
 */
describe("Commentray static view — accessibility", () => {
  beforeEach(() => {
    cy.visitStaticSiteHome();
  });

  describe("document metadata and language", () => {
    it("exposes html language, page title, and meta description", () => {
      cy.get("html").should("have.attr", "lang", "en");
      cy.title().should("contain", "Commentray");
      cy.get('meta[name="description"]')
        .should("have.attr", "content")
        .and("match", /Commentray/);
    });
  });

  describe("landmarks and heading", () => {
    it("provides a banner, primary main region, and a single screen-reader page heading", () => {
      cy.get('[role="banner"][aria-label="View options"]').should("be.visible");
      cy.get("main#main-content.app__main").should("exist");
      cy.get("main#main-content h1.sr-only").should("contain", "Commentray");
      cy.get('[role="contentinfo"]').should("exist");
    });

    it("labels the dual panes, splitter, and in-page search region", () => {
      cy.get('[aria-label="Source code"]').should("be.visible");
      cy.get('[aria-label="Commentray"]').should("be.visible");
      cy.get('[role="separator"][aria-label="Resize panes"]').should("be.visible");
      cy.get('[role="region"][aria-label="Search"]').within(() => {
        cy.get('input[type="search"]#search-q').should("be.visible");
      });
    });
  });

  describe("skip link and focus", () => {
    it("offers skip navigation to main content", () => {
      cy.get('a.skip-link[href="#main-content"]').should("contain", "Skip to main content");
    });

    it("shows a visible focus indicator on the search field when focused via keyboard", () => {
      cy.get("#search-q").focus();
      cy.get("#search-q").should("be.focused");
      cy.get("#search-q").should("have.css", "outline-style").and("not.eq", "none");
    });
  });

  describe("interactive controls", () => {
    it("associates the search field with its visible label", () => {
      cy.get('label[for="search-q"]').should("contain", "Search");
    });

    it("gives the clear-search control an accessible name", () => {
      cy.get("#search-clear").should("be.visible").and("contain", "Clear");
    });

    it("uses a labeled checkbox for line wrap", () => {
      cy.get("label:has(#wrap-lines)").should("contain", "Wrap code lines");
    });

    it("exposes the angle selector with a programmatic name", () => {
      cy.get('select[aria-label="Commentray angle"]').should("exist");
    });
  });

  describe("live regions and external links", () => {
    it("marks search results as a polite live region when hidden state is toggled", () => {
      cy.get("#search-results").should("have.attr", "aria-live", "polite");
    });

    it("opens off-site links in a new tab with noopener", () => {
      cy.get('a[target="_blank"]').each(($a) => {
        cy.wrap($a)
          .invoke("attr", "rel")
          .should("match", /noopener/);
      });
    });
  });

  describe("decorative GitHub icons in the toolbar", () => {
    it("marks icon-only control affordances as hidden from assistive tech where used", () => {
      cy.get(".nav-rail__pair-gh[aria-label]").each(($a) => {
        cy.wrap($a).find('svg[aria-hidden="true"]').should("exist");
      });
    });
  });
});

describe("E2E dual-scroll fixture — accessibility shell", () => {
  it("reuses the same main landmark and skip link as the site root", () => {
    cy.visitE2eDualScrollSync();
    cy.get("main#main-content").should("exist");
    cy.get('a.skip-link[href="#main-content"]').should("exist");
  });
});
