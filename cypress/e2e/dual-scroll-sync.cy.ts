/**
 * Dual-pane block-aware scroll sync + gutter rays ({@link scripts/lib/write-e2e-dual-scroll-fixture.mjs}).
 */
describe("given the E2E dual-scroll fixture page", () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it("then #shell uses dual layout and ships base64 block scroll links", () => {
    cy.visitE2eDualScrollSync();
    cy.get("#shell").should("have.attr", "data-layout", "dual");
    cy.get("#shell")
      .invoke("attr", "data-scroll-block-links-b64")
      .should("be.a", "string")
      .and("have.length.gt", 16);
  });

  it("then the gutter draws two Bézier splines per block (rays) with one active pair", () => {
    cy.visitE2eDualScrollSync();
    cy.get("span.nav-rail__pair-path").should("contain", "dual-scroll.ts");
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
    cy.get("#code-pane").scrollTo("bottom");
    cy.get("#doc-pane-body").invoke("scrollTop").should("be.gt", 80);
  });

  it("then scrolling the commentray pane down pulls the code pane to follow (reverse sync)", () => {
    cy.visitE2eDualScrollSync();
    cy.get("#doc-pane-body").invoke("scrollTop").should("eq", 0);
    cy.get("#code-pane").invoke("scrollTop").should("eq", 0);
    cy.get("#doc-pane-body").scrollTo("bottom");
    cy.get("#code-pane").invoke("scrollTop").should("be.gt", 80);
  });
});
