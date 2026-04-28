import { shellA11y } from "../support/shell-a11y";

/** Narrow mobile uses document scrolling; drive `scrollTop` and emit `scroll` so flip-scroll `tick()` runs. */
function scrollDocumentToBottom(): void {
  cy.window().then((win) => {
    const root = win.document.scrollingElement ?? win.document.documentElement;
    root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
    win.dispatchEvent(new Event("scroll"));
    root.dispatchEvent(new Event("scroll"));
    win.dispatchEvent(new Event("resize"));
  });
  cy.AwaitDualPaneScrollSyncFlush();
}

describe("Mobile flip at README tail on the shipped static home", () => {
  it("keeps the secondary flip hidden until the toolbar flip scrolls away, then syncs tail after flip", () => {
    cy.PrepareStaticSiteHomeForMobileFlipTailCheck();

    cy.window().then((win) => {
      const root = win.document.scrollingElement ?? win.document.documentElement;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      expect(maxScroll, "page should scroll past the viewport on narrow mobile").to.be.gt(200);
    });

    cy.scrollTo("bottom", { ensureScrollable: false });
    scrollDocumentToBottom();

    cy.get(shellA11y.mobilePaneFlipScroll, { timeout: 12000 })
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
    /**
     * Default source pane is rendered markdown: links become `<a>…</a>`, so assert visible text,
     * not the raw `[Development](docs/development.md)` source span.
     */
    cy.get(shellA11y.panes.source).should("contain.text", "See CONTRIBUTING.md and Development");

    scrollDocumentToBottom();
    cy.get(shellA11y.mobilePaneFlipScroll).should("be.visible");
    cy.TapMobilePaneFlipControl();
    cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "doc");
    cy.contains(shellA11y.docPaneBody, "second flip control").should("be.visible");
  });
});
