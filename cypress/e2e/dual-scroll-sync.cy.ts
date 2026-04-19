/**
 * Dual-pane block-aware scroll sync + gutter rays ({@link scripts/lib/write-e2e-dual-scroll-fixture.mjs}).
 */
describe("given the E2E dual-scroll fixture page", () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it("then the fixture loads as a dual-pane code browser", () => {
    cy.visitE2eDualScrollSync();
    cy.get('[aria-label="Source code"]').should("be.visible");
    cy.get('[aria-label="Commentray"]').should("be.visible");
    cy.get('[role="separator"][aria-label="Resize panes"]').should("be.visible");
  });

  it("then the gutter shows connector artwork between the two panes after layout", () => {
    cy.visitE2eDualScrollSync();
    cy.get('[aria-label="Current documentation pair"]').should("contain", "dual-scroll.ts");
    /** Gutter SVG is drawn after layout + rAF; allow time for non-zero gutter height. */
    cy.get('[aria-label="Resize panes"] .gutter__rays', { timeout: 15000 }).should("be.visible");
    cy.get('[aria-label="Resize panes"] svg path').should("have.length.at.least", 4);
  });

  it("then scrolling the code pane down pulls the commentray pane to follow (block sync)", () => {
    cy.visitE2eDualScrollSync();
    cy.get('[aria-label="Commentray"] .doc-pane-body').invoke("scrollTop").should("eq", 0);
    cy.get('[aria-label="Source code"]').invoke("scrollTop").should("eq", 0);
    /** Bring the last source line into view — same gesture a reader uses to reach the end of the file. */
    cy.get('[aria-label="Source code"] .code-line').last().scrollIntoView();
    cy.get('[aria-label="Commentray"] .doc-pane-body').invoke("scrollTop").should("be.gt", 80);
  });

  it("then scrolling the commentray pane down pulls the code pane to follow (reverse sync)", () => {
    cy.visitE2eDualScrollSync();
    cy.get('[aria-label="Commentray"] .doc-pane-body').invoke("scrollTop").should("eq", 0);
    cy.get('[aria-label="Source code"]').invoke("scrollTop").should("eq", 0);
    cy.get('[aria-label="Commentray"] .doc-pane-body')
      .contains("Second-block commentary line 45")
      .scrollIntoView();
    cy.get('[aria-label="Source code"]').invoke("scrollTop").should("be.gt", 80);
  });
});
