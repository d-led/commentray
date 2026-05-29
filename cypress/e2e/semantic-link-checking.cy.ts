describe("Semantic link checking and permalink verification", () => {
  beforeEach(() => {
    cy.GoToStaticSiteHome();
  });

  it("checks if in-page same-origin/relative links point to valid locations", () => {
    const localLinks = new Set<string>();

    cy.get("a, img, link, script").each(($el) => {
      const href = $el.attr("href");
      const src = $el.attr("src");

      for (const attr of [href, src]) {
        if (attr) {
          const trimmed = attr.trim();
          if (
            trimmed !== "" &&
            !trimmed.startsWith("#") &&
            !trimmed.startsWith("mailto:") &&
            !trimmed.startsWith("tel:") &&
            !trimmed.startsWith("data:") &&
            !trimmed.startsWith("javascript:")
          ) {
            if (/^https?:\/\//i.test(trimmed)) {
              const baseUrl = Cypress.config("baseUrl");
              if (baseUrl && trimmed.startsWith(baseUrl)) {
                localLinks.add(trimmed);
              }
            } else {
              localLinks.add(trimmed);
            }
          }
        }
      }
    }).then(() => {
      localLinks.forEach((link) => {
        cy.request({
          url: link,
          failOnStatusCode: true,
        }).its("status").should("eq", 200);
      });
    });
  });

  it("verifies the shareable permalink copying functionality and destination correctness", () => {
    cy.window().then((win) => {
      if (!win.navigator.clipboard) {
        Object.defineProperty(win.navigator, "clipboard", {
          value: {
            writeText: () => Promise.resolve(),
          },
          writable: true,
          configurable: true,
        });
      }
      cy.stub(win.navigator.clipboard, "writeText").as("clipboardWrite");
    });

    cy.get("#commentray-share-link").click();

    cy.get("@clipboardWrite").should("have.been.calledOnce");
    cy.get("@clipboardWrite").then((stub: any) => {
      const copiedUrl = stub.firstCall.args[0];
      expect(copiedUrl).to.be.a("string").and.not.be.empty;

      cy.request(copiedUrl).its("status").should("eq", 200);

      cy.visit(copiedUrl);
      cy.CurrentPageShouldDisplayCodeBrowserShell();
    });
  });

  it("verifies that the copied permalink changes according to selected angle", () => {
    cy.ChooseValueOfAngleSelect("architecture");
    cy.DisplayedValueOfAngleSelectShouldBe("architecture");

    cy.window().then((win) => {
      if (!win.navigator.clipboard) {
        Object.defineProperty(win.navigator, "clipboard", {
          value: {
            writeText: () => Promise.resolve(),
          },
          writable: true,
          configurable: true,
        });
      }
      cy.stub(win.navigator.clipboard, "writeText").as("clipboardWriteArch");
    });

    cy.get("#commentray-share-link").click();

    cy.get("@clipboardWriteArch").should("have.been.calledOnce");
    cy.get("@clipboardWriteArch").then((stub: any) => {
      const copiedUrl = stub.firstCall.args[0];
      expect(copiedUrl).to.contain("/architecture/");
      
      cy.request(copiedUrl).its("status").should("eq", 200);

      cy.visit(copiedUrl);
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.DisplayedValueOfAngleSelectShouldBe("architecture");
      cy.CommentrayPaneShouldContainText("architecture angle");
    });
  });

  it("verifies that the copied permalink preserves vertical scroll position hash", () => {
    cy.ApplyDualPaneScrollTestViewport();
    cy.GoToStaticSiteHomeForDualPaneScrollTests();

    cy.CurrentPageShouldDisplayCodeBrowserShell();
    cy.ScrollDocPaneBodyToMaximum();

    cy.window().then((win) => {
      if (!win.navigator.clipboard) {
        Object.defineProperty(win.navigator, "clipboard", {
          value: {
            writeText: () => Promise.resolve(),
          },
          writable: true,
          configurable: true,
        });
      }
      cy.stub(win.navigator.clipboard, "writeText").as("clipboardWriteScroll");
    });

    cy.get("#commentray-share-link").click();

    cy.get("@clipboardWriteScroll").should("have.been.calledOnce");
    cy.get("@clipboardWriteScroll").then((stub: any) => {
      const copiedUrl = stub.firstCall.args[0];
      expect(copiedUrl).to.match(/#.*commentray-md-line-\d+/);

      cy.visit(copiedUrl, {
        onBeforeLoad(win) {
          win.localStorage.setItem("commentray.codeCommentrayStatic.wideModeIntro.v1", "1");
        },
      });
      cy.CurrentPageShouldDisplayCodeBrowserShell();
      cy.AwaitDualPaneScrollSyncFlush();

      cy.DocPaneBodyScrollTopShouldExceed(20);
    });
  });
});
