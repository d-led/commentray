import { shellA11y } from "../support/shell-a11y";

function scrollRange(el: HTMLElement): number {
  return Math.max(0, el.scrollHeight - el.clientHeight);
}

describe("Dual-pane scroll sync on the shipped static home", () => {
  beforeEach(() => {
    cy.GoToStaticSiteHomeForDualPaneScrollTests();
    cy.get(shellA11y.shell).should("have.attr", "data-layout", "dual");
    cy.get("#code-pane").should(($code) => {
      expect(scrollRange($code[0]), "code pane overflow").to.be.greaterThan(80);
    });
    cy.get(shellA11y.docPaneBody).should(($doc) => {
      expect(scrollRange($doc[0]), "doc pane overflow").to.be.greaterThan(80);
    });
  });

  it("renders paired panes with gutter connector artwork", () => {
    cy.CurrentPageShouldDisplayDualPaneCodeBrowserChrome();
    cy.DocumentationPairStripShouldMentionReadmeSourceFile();
    cy.ResizeSplitterGutterShouldExposeConnectorPaths();
  });

  it("couples documentation scroll position to code-pane scroll", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollCodePaneToMaximum();
    cy.window().then((win) => {
      const code = win.document.getElementById("code-pane");
      const doc = win.document.getElementById("doc-pane-body");
      expect(code).to.be.instanceOf(win.HTMLElement);
      expect(doc).to.be.instanceOf(win.HTMLElement);
      if (!(code instanceof win.HTMLElement) || !(doc instanceof win.HTMLElement)) return;
      const codeMax = scrollRange(code);
      expect(code.scrollTop, "code pane driven to its lower range").to.be.greaterThan(codeMax - 8);
      expect(doc.scrollTop, "doc followed code scroll").to.be.greaterThan(80);
    });
  });

  it("couples code-pane scroll position to documentation scroll", () => {
    cy.CodeAndDocPanesScrollTopShouldBeZero();
    cy.ScrollDocPaneBodyToMaximum();
    cy.window().then((win) => {
      const code = win.document.getElementById("code-pane");
      const doc = win.document.getElementById("doc-pane-body");
      expect(code).to.be.instanceOf(win.HTMLElement);
      expect(doc).to.be.instanceOf(win.HTMLElement);
      if (!(code instanceof win.HTMLElement) || !(doc instanceof win.HTMLElement)) return;
      const docMax = scrollRange(doc);
      expect(doc.scrollTop, "doc pane driven to its lower range").to.be.greaterThan(docMax - 8);
      expect(code.scrollTop, "code followed doc scroll").to.be.greaterThan(80);
    });
  });
});
