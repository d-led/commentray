import { shellA11y } from "../support/shell-a11y";

describe("E2E mobile flip end fixture — scroll sync at document end", () => {
  it("keeps the secondary flip hidden until the toolbar flip scrolls away, then syncs tail after flip", () => {
    cy.PrepareE2eMobileFlipEndFixtureAtMobileViewport();

    cy.window().then((win) => {
      const root = win.document.scrollingElement ?? win.document.documentElement;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      expect(maxScroll, "fixture should be taller than the viewport").to.be.gt(400);
    });
    cy.scrollTo("bottom", { ensureScrollable: false });
    cy.get(shellA11y.mobilePaneFlipScroll, { timeout: 6000 })
      .should("be.visible")
      .and("have.class", "is-visible");
    cy.get(shellA11y.mobilePaneFlip).should(($btn) => {
      expect(
        $btn[0].getBoundingClientRect().bottom,
        "toolbar flip should sit above the viewport",
      ).to.be.lt(12);
    });

    cy.TapMobilePaneFlipControl();
    cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
    cy.get(shellA11y.panes.source).contains("const v73").should("be.visible");

    cy.window().then((win) => {
      const root = win.document.scrollingElement ?? win.document.documentElement;
      root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
    });
    cy.get(shellA11y.mobilePaneFlipScroll).should("be.visible");
    cy.TapMobilePaneFlipControl();
    cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "doc");
    cy.contains(shellA11y.docPaneBody, "E2E_MOBILE_FLIP_TAIL_LBL").should("be.visible");
  });
});
