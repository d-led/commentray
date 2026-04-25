import { shellA11y } from "../support/shell-a11y";

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

    cy.get("#source-markdown-pane-flip").click();
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
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
  });

  it("supports source markdown mode toggle on narrow viewport while source pane is active", () => {
    cy.viewport(390, 844);
    cy.visit("/");
    cy.get(shellA11y.mobilePaneFlip).click();
    cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane", "code");
    cy.get(shellA11y.panes.source).should("be.visible");

    cy.get("#source-markdown-pane-flip").click();
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "source");
    cy.get("#source-markdown-pane-flip").click();
    cy.get(shellA11y.shell).should("have.attr", "data-source-pane-mode", "rendered-markdown");
  });
});
