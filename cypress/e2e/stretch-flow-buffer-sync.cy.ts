import { shellA11y } from "../support/shell-a11y";

/** Same path shape as `staticBrowseIndexRelPathFromPair` for this repo’s pair. */
const STRETCH_FLOW_BUFFER_BROWSE =
  "/browse/e2e/stretch-flow-buffer.ts/index.html";

describe("Stretch layout — flow-synchronizer buffer (static browse page)", () => {
  it("exposes the shell flag and applies slack padding on the shorter code cell", () => {
    cy.visit(STRETCH_FLOW_BUFFER_BROWSE, {
      onBeforeLoad(win) {
        win.localStorage.setItem("commentray.codeCommentrayStatic.wideModeIntro.v1", "1");
      },
    });

    cy.get(shellA11y.shell).should("have.attr", "data-layout", "stretch");
    cy.get(shellA11y.shell).should("have.attr", "data-stretch-buffer-sync", "flow-synchronizer");

    cy.get("table#code-pane.block-stretch").should("exist");
    cy.get("#code-pane tbody tr.stretch-row--block").should("have.length.at.least", 1);
    cy.get("table#code-pane.block-stretch td.stretch-code").should(($cells) => {
      const win = $cells[0]?.ownerDocument.defaultView;
      if (win === null) throw new Error("expected window");
      const maxPb = Math.max(
        ...[...$cells].map((td) => Number.parseFloat(win.getComputedStyle(td).paddingBottom)),
      );
      expect(
        maxPb,
        "flow-synchronizer adds bottom slack on a code cell (block row and/or trailing gap row)",
      ).to.be.greaterThan(8);
    });

    cy.get(`${shellA11y.shell} .stretch-doc-inner`)
      .first()
      .should(($el) => {
        const win = $el[0].ownerDocument.defaultView;
        if (win === null) throw new Error("expected window");
        const oy = win.getComputedStyle($el[0]).overflowY;
        expect(
          oy,
          "doc prose must not create its own vertical scrollport (wheel stays on #shell)",
        ).to.eq("hidden");
      });
  });
});
