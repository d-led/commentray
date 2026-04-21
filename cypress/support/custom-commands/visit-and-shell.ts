import { shellA11y } from "../shell-a11y";

Cypress.Commands.add("VisitStaticSiteHome", () => {
  cy.visit("/");
});

Cypress.Commands.add("VisitE2eDualScrollFixture", () => {
  cy.visit("/__e2e__/dual-scroll-sync/");
});

Cypress.Commands.add("CurrentPageShouldDisplayCodeBrowserShell", () => {
  cy.get(".shell").should("exist").and("have.attr", "data-layout");
  cy.get(shellA11y.panes.source).should("be.visible");
  cy.get(shellA11y.panes.commentray).should("be.visible");
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
