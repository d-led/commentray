/**
 * Entry point for Cypress custom commands (implementations under `./custom-commands/`).
 *
 * Naming: actions read as short phrases (`GoToStaticSiteHome`, `TapMobilePaneFlipControl`,
 * `ChooseValueOfAngleSelect`, `TypeTextInSearchField`, `Click…Of…`); checks use `…Should…` so `cy`
 * chains read like sentences. Keyboard helpers for the static code browser live in
 * `custom-commands/code-browser-keyboard.ts` (see `e2e/code-browser-keyboard.cy.ts`).
 */
import "./custom-commands";

export {};
