import { shellA11y } from "../support/shell-a11y";

const WIDE_MODE_INTRO_STORAGE_KEY = "commentray.codeCommentrayStatic.wideModeIntro.v1";
const SOURCE_PANE_MODE_STORAGE_KEY = "commentray.codeCommentrayStatic.sourceMarkdownPaneMode";

function expectVisibleArrows(count: number): void {
  cy.get("#commentray-wide-intro-arrows .commentray-wide-intro-arrow")
    .should("have.length", count)
    .each(($arrow) => {
      const el = $arrow[0];
      const style = getComputedStyle(el);
      const width = Number.parseFloat(style.width);
      expect(width).to.be.greaterThan(16);
      expect(style.opacity).to.not.eq("0");
      expect(style.display).to.not.eq("none");
    });
}

function expectArrowStartsOutsideBubble(): void {
  cy.get("#commentray-wide-intro").then(($bubble) => {
    const bubbleRect = $bubble[0].getBoundingClientRect();
    cy.get("#commentray-wide-intro-arrows .commentray-wide-intro-arrow").each(($arrow) => {
      const arrowRect = $arrow[0].getBoundingClientRect();
      const startInsideBubble =
        arrowRect.left >= bubbleRect.left &&
        arrowRect.left <= bubbleRect.right &&
        arrowRect.top >= bubbleRect.top &&
        arrowRect.top <= bubbleRect.bottom;
      expect(startInsideBubble).to.eq(false);
    });
  });
}

function visitWithFreshWideIntroStorage(): void {
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.removeItem(WIDE_MODE_INTRO_STORAGE_KEY);
    },
  });
}

/** Advance the wide intro with Next until the title contains `fragment` (tolerates auto-skipped steps). */
function clickWideIntroNextUntilTitle(fragment: string, maxNextClicks: number): void {
  if (maxNextClicks < 0) {
    throw new Error(`Wide intro did not reach a title containing "${fragment}".`);
  }
  cy.get("#commentray-wide-intro .commentray-wide-intro-title").then(($title) => {
    if ($title.text().includes(fragment)) return;
    cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
    clickWideIntroNextUntilTitle(fragment, maxNextClicks - 1);
  });
}

/** Dual-only scroll tests; on stretch assert rendered-markdown only. */
function whenHomeDualLayoutWide(dualOnly: () => void): void {
  cy.viewport(1280, 900);
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
      win.localStorage.removeItem(SOURCE_PANE_MODE_STORAGE_KEY);
    },
  });
  cy.get(shellA11y.shell).then(($shell) => {
    if ($shell.attr("data-layout") !== "dual") {
      cy.wrap($shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
      return;
    }
    cy.wrap($shell)
      .should("have.attr", "data-layout", "dual")
      .and("have.attr", "data-source-pane-mode", "rendered-markdown");
    dualOnly();
  });
}

describe("Markdown source rendering modes", () => {
  /** Reset after other specs (e.g. dual-scroll fixture uses a short viewport). Narrow tests override before `visit`. */
  beforeEach(() => {
    cy.viewport(1280, 900);
  });

  it("starts in rendered markdown even if prior storage asked for source", () => {
    cy.viewport(1280, 900);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem(SOURCE_PANE_MODE_STORAGE_KEY, "source");
      },
    });
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
  });

  it("keeps doc-to-source scroll sync when left pane shows rendered markdown (wide)", () => {
    whenHomeDualLayoutWide(() => {
      cy.get("#source-markdown-pane-flip").should("be.visible");
      cy.get(shellA11y.docPaneBody).then(($body) => {
        const el = $body[0];
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      });
      cy.get("#code-pane").invoke("scrollTop").should("be.gt", 40);
    });
  });

  it("snaps the doc pane to the matching block when the rendered-markdown source pane scrolls into a region", () => {
    whenHomeDualLayoutWide(() => {
      /**
       * Scroll the code pane so the `readme-user-guides` heading sits near the pane top.
       * `scrollIntoView()` can scroll the window instead of `#code-pane`’s internal scrollport,
       * so we set `scrollTop` on `#code-pane` to reliably emit the driver scroll the client syncs on.
       * The commentary places that block far from the proportional offset of the source line
       * (commentary has many more lines than `README.md`), so a proportional fallback would
       * land the doc pane at a clearly different scrollTop than the block anchor.
       */
      /** Use nodes from Cypress chains — top-level `document` is the runner frame, not the AUT. */
      cy.get("#using-commentray").then(($heading) => {
        const heading = $heading[0];
        const codePane = heading.closest("#code-pane");
        if (!(codePane instanceof HTMLElement))
          throw new Error("expected #code-pane ancestor of #using-commentray");
        const codeRect = codePane.getBoundingClientRect();
        const lineRect = heading.getBoundingClientRect();
        codePane.scrollTop = codePane.scrollTop + (lineRect.top - codeRect.top) - 4;
      });
      cy.AwaitDualPaneScrollSyncFlush();

      cy.get("#commentray-block-readme-user-guides").should("exist");
      cy.get(shellA11y.docPaneBody, { timeout: 15000 }).should(($body) => {
        const docPaneBody = $body[0];
        const anchor = docPaneBody.ownerDocument.getElementById(
          "commentray-block-readme-user-guides",
        );
        if (anchor === null) throw new Error("expected commentray-block-readme-user-guides");
        const anchorTopWithin =
          anchor.getBoundingClientRect().top - docPaneBody.getBoundingClientRect().top;
        expect(anchorTopWithin, "block anchor near doc viewport top").to.be.within(-12, 60);
        expect(
          docPaneBody.scrollTop,
          "doc pane is region-snapped, not at proportional ratio",
        ).to.be.gt(40);
      });
    });
  });

  it("uses single-pane dual layout on narrow viewports (only the active column is visible)", () => {
    cy.viewport(390, 844);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
      },
    });
    cy.get(shellA11y.shell).then(($shell) => {
      if ($shell.attr("data-layout") !== "dual") {
        cy.wrap($shell).should("have.attr", "data-layout", "stretch");
        return;
      }
      cy.wrap($shell).should("have.attr", "data-dual-mobile-pane", "doc");
      cy.get(shellA11y.panes.commentray).should("be.visible");
      cy.get(shellA11y.panes.source).should("not.be.visible");
      cy.get(shellA11y.resizeSplitter).should("not.be.visible");
      cy.get(shellA11y.mobilePaneFlip).should("be.visible").click();
      cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
      cy.get(shellA11y.panes.source).should("be.visible");
      cy.get(shellA11y.panes.commentray).should("not.be.visible");
    });
  });

  it("preserves source scroll sync after toggling source markdown mode and changing angle", () => {
    cy.viewport(1280, 900);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
      },
    });
    cy.get(shellA11y.shell).then(($shell) => {
      if ($shell.attr("data-layout") !== "dual") {
        cy.wrap($shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
        cy.get(shellA11y.angleSelect).select("architecture");
        cy.get(shellA11y.angleSelect).should("have.value", "architecture");
        cy.get(shellA11y.angleSelect).select("main");
        cy.get(shellA11y.angleSelect).should("have.value", "main");
        return;
      }
      cy.wrap($shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
      cy.get("#source-markdown-pane-flip").should("contain.text", "Render");
      cy.get("#source-markdown-pane-flip").should("have.attr", "aria-pressed", "true");
      cy.get(shellA11y.wrapLinesLabel).should("not.be.visible");

      cy.get("#source-markdown-pane-flip").click();
      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
      cy.get("#source-markdown-pane-flip").should("have.attr", "aria-pressed", "false");
      cy.get(shellA11y.wrapLinesLabel).should("be.visible");
      cy.get(shellA11y.docPaneBody).then(($body) => {
        const el = $body[0];
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      });
      cy.get("#code-pane").invoke("scrollTop").should("be.gt", 40);

      cy.get(shellA11y.angleSelect).select("architecture");
      cy.get(shellA11y.angleSelect).should("have.value", "architecture");
      cy.location("pathname").should(
        "match",
        /\/browse\/README\.md\/architecture(?:\/index\.html)?$/,
      );
      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
      cy.get("#source-markdown-pane-flip").should("have.attr", "aria-pressed", "true");
      cy.get(shellA11y.wrapLinesLabel).should("not.be.visible");
    });
  });

  it("supports source markdown mode toggle on narrow viewport while source pane is active", () => {
    cy.viewport(390, 844);
    cy.visit("/");
    cy.get(shellA11y.shell).then(($shell) => {
      if ($shell.attr("data-layout") !== "dual") {
        return;
      }
      cy.get(shellA11y.mobilePaneFlip).click();
      cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
      cy.get(shellA11y.panes.source).should("be.visible");

      cy.get("#source-markdown-pane-flip").click();
      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
      cy.get(shellA11y.wrapLinesLabel).should("be.visible");
      cy.get("#source-markdown-pane-flip").click();
      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
      cy.get(shellA11y.wrapLinesLabel).should("not.be.visible");
      cy.get(shellA11y.wrapLinesLabel).should("have.css", "display", "none");
    });
  });

  it("keeps the narrow source/render toggle square", () => {
    cy.viewport(390, 844);
    cy.visit("/");
    cy.get(shellA11y.shell).then(($shell) => {
      if ($shell.attr("data-layout") !== "dual") {
        return;
      }
      cy.get(shellA11y.mobilePaneFlip).click();
      cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
      cy.get("#source-markdown-pane-flip")
        .should("be.visible")
        .then(($btn) => {
          const rect = $btn[0].getBoundingClientRect();
          expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1.5);
        });
    });
  });

  it("shows wide-mode intro tour once and persists dismissal", () => {
    cy.viewport(1280, 900);
    visitWithFreshWideIntroStorage();

    cy.get("#commentray-wide-intro").should("be.visible");
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Welcome").should(
      "be.visible",
    );
    cy.get('#commentray-wide-intro button[data-wide-intro="skip"]').click();
    cy.get("#commentray-wide-intro").should("not.exist");
    cy.window()
      .its("localStorage")
      .invoke("getItem", WIDE_MODE_INTRO_STORAGE_KEY)
      .should("eq", "1");

    cy.reload();
    cy.get("#commentray-wide-intro").should("not.exist");

    cy.get("#commentray-help-tour").click();
    cy.get("#commentray-wide-intro").should("be.visible");
  });

  it("draws two visible intro arrows in wide mode without crossing the bubble text area", () => {
    cy.viewport(1280, 900);
    visitWithFreshWideIntroStorage();

    cy.get("#commentray-wide-intro").should("be.visible");
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Welcome").should(
      "be.visible",
    );
    expectVisibleArrows(2);
    expectArrowStartsOutsideBubble();

    cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Two views").should(
      "be.visible",
    );
    expectVisibleArrows(2);
    expectArrowStartsOutsideBubble();
  });

  it("recomputes intro arrows when viewport switches between wide and narrow", () => {
    cy.viewport(1280, 900);
    visitWithFreshWideIntroStorage();

    cy.get("#commentray-wide-intro").should("be.visible");
    expectVisibleArrows(2);

    cy.viewport(390, 844);
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Welcome").should(
      "be.visible",
    );
    expectVisibleArrows(1);

    cy.viewport(1280, 900);
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Welcome").should(
      "be.visible",
    );
    expectVisibleArrows(2);
  });

  it("shows intro tour on narrow viewports with narrow-view copy", () => {
    cy.viewport(390, 844);
    visitWithFreshWideIntroStorage();
    cy.get("#commentray-wide-intro").should("be.visible");
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Welcome").should(
      "be.visible",
    );
    cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Two views").should(
      "be.visible",
    );
    cy.contains("#commentray-wide-intro .commentray-wide-intro-body", "narrow view").should(
      "be.visible",
    );
  });

  it("ends with a help-button reminder and introduces share link", () => {
    cy.viewport(1280, 900);
    visitWithFreshWideIntroStorage();
    cy.get("#commentray-wide-intro").should("be.visible");

    clickWideIntroNextUntilTitle("Need a refresher?", 18);

    cy.contains("#commentray-wide-intro .commentray-wide-intro-title", "Need a refresher?").should(
      "be.visible",
    );
    cy.contains(
      "#commentray-wide-intro .commentray-wide-intro-body",
      "You can always go back to this tutorial via the help button.",
    ).should("be.visible");
    cy.get("#commentray-wide-intro-arrows .commentray-wide-intro-arrow").should("have.length", 1);
  });

  it("shows a fallback intro action when wrap-lines toggle is hidden", () => {
    cy.viewport(1280, 900);
    visitWithFreshWideIntroStorage();

    cy.get(shellA11y.shell).then(($shell) => {
      if ($shell.attr("data-layout") !== "dual") {
        cy.get("#commentray-wide-intro").should("be.visible");
        return;
      }
      cy.wrap($shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
      cy.get(shellA11y.wrapLinesLabel).should("not.be.visible");

      clickWideIntroNextUntilTitle("Readability controls", 14);
      cy.contains(
        "#commentray-wide-intro .commentray-wide-intro-title",
        "Readability controls",
      ).should("be.visible");
      cy.get("#commentray-wide-intro .commentray-wide-intro-step-action")
        .should("be.visible")
        .and("contain.text", "Switch to markdown source")
        .click();

      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
      cy.get(shellA11y.wrapLinesLabel).should("be.visible");
      cy.get("#commentray-wide-intro-arrows .commentray-wide-intro-arrow").should("have.length", 1);
    });
  });
});
