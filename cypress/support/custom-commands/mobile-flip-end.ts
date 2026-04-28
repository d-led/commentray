import { shellA11y } from "../shell-a11y";

/** Matches `code-browser.ts` / client narrow single-pane breakpoint. */
const MOBILE_VIEWPORT_WIDTH = 390;
const MOBILE_VIEWPORT_HEIGHT = 844;
const WIDE_MODE_INTRO_STORAGE_KEY = "commentray.codeCommentrayStatic.wideModeIntro.v1";

/** Visit `/` at the narrow mobile breakpoint with wide-mode intro dismissed; shell must be dual + mobile flip chrome. */
Cypress.Commands.add("PrepareStaticSiteHomeForMobileFlipTailCheck", () => {
  cy.clearLocalStorage();
  cy.viewport(MOBILE_VIEWPORT_WIDTH, MOBILE_VIEWPORT_HEIGHT);
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
    },
  });
  cy.get(shellA11y.shell).should("exist").and("have.attr", "data-layout", "dual");
  cy.get(shellA11y.shell).should("have.attr", "data-dual-mobile-pane");
  cy.get(shellA11y.mobilePaneFlip).should("be.visible");
  cy.get(shellA11y.mobilePaneFlipScroll).should("exist").and("not.have.class", "is-visible");
});
