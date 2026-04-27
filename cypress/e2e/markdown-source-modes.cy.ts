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

/** Dual-only scroll tests; on stretch assert rendered-markdown only. */
function whenHomeDualLayoutWide(dualOnly: () => void): void {
  cy.viewport(1280, 900);
  cy.visit("/");
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
       * Scroll the source pane so the `readme-user-guides` region sits at the viewport top.
       * The commentary places that block far from the proportional offset of the source line
       * (commentary has many more lines than `README.md`), so a proportional fallback would
       * land the doc pane at a clearly different scrollTop than the block anchor.
       */
      cy.get("#code-md-line-22").then(($line) => {
        const codePane = document.getElementById("code-pane");
        if (codePane === null) throw new Error("expected code pane");
        const codeRect = codePane.getBoundingClientRect();
        const lineRect = ($line[0] as HTMLElement).getBoundingClientRect();
        codePane.scrollTop = codePane.scrollTop + (lineRect.top - codeRect.top) - 4;
      });

      cy.wait(120);

      cy.get("#commentray-block-readme-user-guides").should("exist");
      cy.get(shellA11y.docPaneBody)
        .invoke("scrollTop")
        .then((scrollTop) => {
          const anchor = document.getElementById("commentray-block-readme-user-guides");
          if (anchor === null) throw new Error("expected commentray-block-readme-user-guides");
          const docPaneBody = document.getElementById("doc-pane-body");
          if (docPaneBody === null) throw new Error("expected doc pane body");
          const anchorTopWithin =
            anchor.getBoundingClientRect().top - docPaneBody.getBoundingClientRect().top;
          expect(anchorTopWithin, "block anchor near doc viewport top").to.be.within(-12, 60);
          expect(
            Number(scrollTop),
            "doc pane is region-snapped, not at proportional ratio",
          ).to.be.gt(40);
        });
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
      cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
      cy.get("#source-markdown-pane-flip").click();
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

    for (let i = 0; i < 9; i += 1) {
      cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
    }

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

      for (let i = 0; i < 6; i += 1) {
        cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
      }
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
