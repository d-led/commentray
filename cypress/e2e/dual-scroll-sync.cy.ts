/**
 * Dual-pane block-aware scroll sync + gutter rays ({@link scripts/lib/write-e2e-dual-scroll-fixture.mjs}).
 */
describe("given the E2E dual-scroll fixture page", () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it("then the fixture loads as a dual-pane code browser", () => {
    cy.visitE2eDualScrollSync();
    cy.get("#shell").should("have.attr", "data-layout", "dual");
  });

  it("then the gutter draws two Bézier splines per block (rays) with one active pair", () => {
    cy.visitE2eDualScrollSync();
    cy.get("span.nav-rail__pair-path").should("contain", "dual-scroll.ts");
    /** Gutter SVG is drawn after layout + rAF; allow time for non-zero gutter height. */
    cy.get("#gutter .gutter__rays svg", { timeout: 15000 }).should("be.visible");
    cy.get("#gutter .gutter__rays svg g.gutter__rays-block").should("have.length", 2);
    cy.get(
      '#gutter .gutter__rays svg g[data-commentray-block="b1"] path.gutter__rays-path:not(.gutter__rays-path--trail)',
    ).should("have.length", 2);
    cy.get(
      '#gutter .gutter__rays svg g[data-commentray-block="b2"] path.gutter__rays-path:not(.gutter__rays-path--trail)',
    ).should("have.length", 2);
    cy.get(
      "#gutter .gutter__rays svg path.gutter__rays-path--active:not(.gutter__rays-path--trail)",
    ).should("have.length", 2);
  });

  it("then scrolling the code pane down pulls the commentray pane to follow (block sync)", () => {
    cy.visitE2eDualScrollSync();
    cy.get("#doc-pane-body").invoke("scrollTop").should("eq", 0);
    cy.get("#code-pane").invoke("scrollTop").should("eq", 0);
    /** Bring the last source line into view — same gesture a reader uses to reach the end of the file. */
    cy.get("#code-pane .code-line").last().scrollIntoView();
    cy.get("#doc-pane-body").invoke("scrollTop").should("be.gt", 80);
  });

  it("then scrolling the commentray pane down pulls the code pane to follow (reverse sync)", () => {
    cy.visitE2eDualScrollSync();
    cy.get("#doc-pane-body").invoke("scrollTop").should("eq", 0);
    cy.get("#code-pane").invoke("scrollTop").should("eq", 0);
    cy.get("#doc-pane-body").contains("Second-block commentary line 45").scrollIntoView();
    cy.get("#code-pane").invoke("scrollTop").should("be.gt", 80);
  });
});
