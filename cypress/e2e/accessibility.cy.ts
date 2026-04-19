/**
 * Structural and keyboard accessibility checks for the static code browser shell
 * (`npm run pages:build` → `_site/`).
 *
 * Selectors and title patterns live in {@link ../support/shell-a11y.ts}; adjust that file
 * when the shell layout or static site title changes.
 */
import { DOCUMENT_LANG, STATIC_SITE_TITLE_PATTERN, shellA11y } from "../support/shell-a11y";

describe("Commentray static view — accessibility", () => {
  beforeEach(() => {
    cy.visitStaticSiteHome();
  });

  describe("document metadata and language", () => {
    it("exposes html language, page title, and meta description", () => {
      cy.get("html").should("have.attr", "lang", DOCUMENT_LANG);
      cy.title().should("match", STATIC_SITE_TITLE_PATTERN);
      cy.get('meta[name="description"]')
        .should("have.attr", "content")
        .and("match", STATIC_SITE_TITLE_PATTERN);
    });
  });

  describe("landmarks and heading", () => {
    it("provides a banner, primary main region, and a screen-reader page heading", () => {
      cy.get(shellA11y.banner).should("be.visible");
      cy.get(shellA11y.documentTitleHeading)
        .invoke("text")
        .should("match", STATIC_SITE_TITLE_PATTERN);
      cy.get(shellA11y.main).should("exist");
      cy.get(shellA11y.contentinfo).should("exist");
    });

    it("labels the dual panes, splitter, and in-page search region", () => {
      cy.get(shellA11y.panes.source).should("be.visible");
      cy.get(shellA11y.panes.commentray).should("be.visible");
      cy.get(shellA11y.resizeSplitter).should("be.visible");
      cy.get(shellA11y.search.region).within(() => {
        cy.get('input[type="search"]').should("be.visible");
      });
    });
  });

  describe("skip link and focus", () => {
    it("offers skip navigation to main content", () => {
      cy.get(shellA11y.skipToMainLink)
        .should("have.attr", "href", "#main-content")
        .and(($a) => {
          expect($a.text().toLowerCase()).to.contain("skip");
        });
    });

    it("shows a visible focus indicator on the search field when focused via keyboard", () => {
      cy.get(shellA11y.search.input).focus();
      cy.get(shellA11y.search.input).should("be.focused");
      cy.get(shellA11y.search.input).should("have.css", "outline-style").and("not.eq", "none");
    });
  });

  describe("interactive controls", () => {
    it("associates the search field with its visible label", () => {
      cy.get(shellA11y.search.label).should("contain", "Search");
    });

    it("gives the clear-search control an accessible name", () => {
      cy.get(shellA11y.search.clearButton).should("be.visible").and("contain", "Clear");
    });

    it("uses a labeled checkbox for line wrap", () => {
      cy.get(shellA11y.wrapLinesLabel).should("contain", "Wrap code lines");
    });

    it("exposes the angle selector with a programmatic name", () => {
      cy.get(shellA11y.angleSelect).should("exist");
    });
  });

  describe("live regions and external links", () => {
    it("marks search results as a polite live region when hidden state is toggled", () => {
      cy.get(shellA11y.search.results).should("have.attr", "aria-live", "polite");
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
      cy.shouldHideDecorativeSvgsInDocPairLinks();
    });
  });
});

describe("E2E dual-scroll fixture — accessibility shell", () => {
  it("reuses the same main landmark and skip link as the site root", () => {
    cy.visitE2eDualScrollSync();
    cy.get(shellA11y.main).should("exist");
    cy.get(shellA11y.skipToMainLink).should("exist");
  });
});
