import { shellA11y } from "../support/shell-a11y";

const WIDE_MODE_INTRO_STORAGE_KEY = "commentray.codeCommentrayStatic.wideModeIntro.v1";

describe("Markdown source rendering modes", () => {
  it("keeps doc-to-source scroll sync when left pane shows rendered markdown (wide)", () => {
    cy.viewport(1280, 900);
    cy.visit("/");
    cy.get(shellA11y.shell)
      .should("have.attr", "data-layout", "dual")
      .and("have.attr", "data-source-pane-mode", "rendered-markdown");

    cy.get("#source-markdown-pane-flip").should("be.visible");
    cy.get(shellA11y.docPaneBody).then(($body) => {
      const el = $body[0];
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    });
    cy.get("#code-pane").invoke("scrollTop").should("be.gt", 40);
  });

  it("preserves source scroll sync after toggling source markdown mode and changing angle", () => {
    cy.viewport(1280, 900);
    cy.visit("/");
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
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

  it("supports source markdown mode toggle on narrow viewport while source pane is active", () => {
    cy.viewport(390, 844);
    cy.visit("/");
    cy.get(shellA11y.mobilePaneFlip).click();
    cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
    cy.get(shellA11y.panes.source).should("be.visible");

    cy.get("#source-markdown-pane-flip").click();
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
    cy.get(shellA11y.wrapLinesLabel).should("be.visible");
    cy.get("#source-markdown-pane-flip").click();
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
    cy.get(shellA11y.wrapLinesLabel).should("not.be.visible");
  });

  it("shows wide-mode intro tour once and persists dismissal", () => {
    cy.viewport(1280, 900);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.removeItem(WIDE_MODE_INTRO_STORAGE_KEY);
      },
    });

    cy.get("#commentray-wide-intro").should("be.visible");
    cy.contains("#commentray-wide-intro .commentray-wide-intro__title", "Welcome").should(
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

  it("shows intro tour on narrow viewports with narrow-view copy", () => {
    cy.viewport(390, 844);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.removeItem(WIDE_MODE_INTRO_STORAGE_KEY);
      },
    });
    cy.get("#commentray-wide-intro").should("be.visible");
    cy.contains("#commentray-wide-intro .commentray-wide-intro__title", "Welcome").should(
      "be.visible",
    );
    cy.get('#commentray-wide-intro button[data-wide-intro="next"]').click();
    cy.contains("#commentray-wide-intro .commentray-wide-intro__title", "Two views").should(
      "be.visible",
    );
    cy.contains("#commentray-wide-intro .commentray-wide-intro__body", "narrow view").should(
      "be.visible",
    );
  });
});
