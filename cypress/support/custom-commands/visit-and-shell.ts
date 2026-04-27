import { shellA11y } from "../shell-a11y";

const WIDE_MODE_INTRO_STORAGE_KEY = "commentray.codeCommentrayStatic.wideModeIntro.v1";

Cypress.Commands.add("GoToStaticSiteHome", () => {
  cy.visit("/", {
    onBeforeLoad(win) {
      win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
    },
  });
});

Cypress.Commands.add("GoToE2eDualScrollFixturePage", () => {
  cy.visit("/__e2e__/dual-scroll-sync/", {
    onBeforeLoad(win) {
      win.localStorage.setItem(WIDE_MODE_INTRO_STORAGE_KEY, "1");
    },
  });
});

Cypress.Commands.add("CurrentPageShouldDisplayCodeBrowserShell", () => {
  cy.get(".shell").should("exist").and("have.attr", "data-layout");
  cy.get(".shell").then(($shell) => {
    const layout = $shell.attr("data-layout");
    if (layout === "stretch") {
      cy.get(`${shellA11y.shell} #code-pane`).should("be.visible");
      cy.get(`${shellA11y.shell} .stretch-doc-inner`).first().should("be.visible");
    } else {
      cy.get(shellA11y.panes.source).should("be.visible");
      cy.get(shellA11y.panes.commentray).should("be.visible");
    }
  });
  cy.get(shellA11y.search.region).within(() => {
    cy.get('input[type="search"]').should("be.visible");
  });
  cy.get(shellA11y.colorThemeTrigger).should("exist");
  cy.get(shellA11y.contentinfo).should("be.visible");
  cy.get(`${shellA11y.contentinfo} time`).should("be.visible");
});

Cypress.Commands.add("NavSearchArtifactGetRequestShouldReturnSchemaVersion", () => {
  cy.request("/commentray-nav-search.json").then((res) => {
    expect(res.status).to.eq(200);
    expect(res.body).to.have.property("schemaVersion");
  });
});

Cypress.Commands.add("DocPairGithubToolbarLinksShouldMarkSvgsDecorative", () => {
  cy.get(`${shellA11y.banner} a.toolbar-github`).each(($a) => {
    cy.wrap($a).find('svg[aria-hidden="true"]').should("exist");
  });
});
