import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { applyBlockStretchRowBuffers } from "./block-stretch-buffer-sync.js";

function fakeDomRect(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 100,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: 100,
    toJSON(): Record<string, never> {
      return {};
    },
  } as DOMRect;
}

describe("applyBlockStretchRowBuffers", () => {
  it("pads the shorter side so both cells reach the shared region height", () => {
    const dom = new JSDOM(
      `<!doctype html><html><body>
        <table class="block-stretch"><tbody>
        <tr class="stretch-row stretch-row--block" data-commentray-stretch-sync-id="r1">
          <td class="stretch-code"><div class="stretch-cell-measure"><div class="stretch-code-stack"></div></div></td>
          <td class="stretch-doc"><div class="stretch-cell-measure"><div class="stretch-doc-inner"></div></div></td>
        </tr>
      </tbody></table></body></html>`,
      { pretendToBeVisual: true },
    );
    const { document } = dom.window;
    const table = document.querySelector("table");
    if (!(table instanceof dom.window.HTMLTableElement)) throw new Error("table");

    const stack = table.querySelector(".stretch-code-stack");
    const docInner = table.querySelector(".stretch-doc-inner");
    if (!(stack instanceof dom.window.HTMLElement)) throw new Error("stack");
    if (!(docInner instanceof dom.window.HTMLElement)) throw new Error("doc inner");
    stack.getBoundingClientRect = () => fakeDomRect(20);
    docInner.getBoundingClientRect = () => fakeDomRect(44);

    applyBlockStretchRowBuffers(table);

    const codeTd = table.querySelector("td.stretch-code");
    const docTd = table.querySelector("td.stretch-doc");
    if (!(codeTd instanceof dom.window.HTMLTableCellElement)) throw new Error("code td");
    if (!(docTd instanceof dom.window.HTMLTableCellElement)) throw new Error("doc td");

    expect(codeTd.style.paddingBottom).toBe("24px");
    expect(docTd.style.paddingBottom).toBe("");
  });
});
