import { describe, expect, it } from "vitest";
import { generateBlockId } from "./blocks.js";
import {
  CallbackRegionMarkerNamingStrategy,
  CodeStructureHintStrategy,
  CompositeRegionMarkerNamingStrategy,
  EnclosingSymbolHintStrategy,
  MarkdownHeadingHintStrategy,
  TomlTableHeaderHintStrategy,
  defaultRegionMarkerNamingStrategy,
  tryCodeStructureNameHint,
  tryMarkdownHeadingTitleAbove,
  tryNormaliseContextLabelToMarkerId,
  tryTomlTablePathAboveSelection,
} from "./region-marker-naming.js";

function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("Given TOML source with standard and array-of-tables headers", () => {
  describe("tryTomlTablePathAboveSelection", () => {
    it("when the caret starts under [anchors], then the path is anchors", () => {
      const src = ["[anchors]", 'key = "v"', "", "[other]", "x = 1"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 2)).toBe("anchors");
    });

    it("when the selection is under [[angles.definitions]], then the dotted path is returned", () => {
      const src = ["[[angles.definitions]]", "id = 1", "", "[plain]", "y = 2"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 2)).toBe("angles.definitions");
    });

    it("when an array-of-tables line sits above a normal table, then the nearer array header wins", () => {
      const src = ["[[a]]", "x=1", "[b]", "y=2"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 4)).toBe("b");
    });

    it("when a line has a trailing comment, then the header is still recognised", () => {
      const src = ["[storage] # main store", "dir = 1"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 2)).toBe("storage");
    });

    it("when there is no header above, then null is returned", () => {
      const src = ["plain = 1", "x = 2"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 2)).toBeNull();
    });

    it("when startLine1 is before the first line, then the first header in file is used", () => {
      const src = ["[root]", "a=1"].join("\n");
      expect(tryTomlTablePathAboveSelection(src, 0)).toBe("root");
    });

    it("when the file uses CRLF newlines, then headers are still found", () => {
      const src = ["[anchors]", "x = 1"].join("\r\n");
      expect(tryTomlTablePathAboveSelection(src, 2)).toBe("anchors");
    });
  });
});

describe("Given Markdown with ATX headings", () => {
  describe("tryMarkdownHeadingTitleAbove", () => {
    it("when a ## heading sits directly above the range, then its text is returned", () => {
      const src = ["# Doc", "## Region title", "body line"].join("\n");
      expect(tryMarkdownHeadingTitleAbove(src, 3)).toBe("Region title");
    });

    it("when the heading uses emphasis, then inline markers are stripped", () => {
      const src = ["## **Bold** and *italic*"].join("\n");
      expect(tryMarkdownHeadingTitleAbove(src, 1)).toBe("Bold and italic");
    });

    it("when the heading contains a link, then the label is kept", () => {
      const src = ["## See [API](https://x) now"].join("\n");
      expect(tryMarkdownHeadingTitleAbove(src, 1)).toBe("See API now");
    });

    it("when there is no heading, then null is returned", () => {
      const src = ["just prose", "more"].join("\n");
      expect(tryMarkdownHeadingTitleAbove(src, 2)).toBeNull();
    });
  });
});

describe("Given TypeScript-like declarations", () => {
  it("when the selection spans a function declaration, then the function name is preferred", () => {
    const src = ["export async function loadUser(id: string) {", "  return id;", "}"].join("\n");
    expect(tryCodeStructureNameHint("typescript", src, { startLine: 1, endLine: 3 })).toBe(
      "loadUser",
    );
  });

  it("when the selection is inside a class body, then the class name is found when scanning upward", () => {
    const src = ["export class AccountService {", "  reset() {}", "}"].join("\n");
    expect(tryCodeStructureNameHint("typescript", src, { startLine: 2, endLine: 2 })).toBe(
      "AccountService",
    );
  });

  it("when a const holds an arrow function, then the const binding wins", () => {
    const src = ["export const makeId = () => Math.random();"].join("\n");
    expect(tryCodeStructureNameHint("typescript", src, { startLine: 1, endLine: 1 })).toBe(
      "makeId",
    );
  });

  it("when languageId is toml, then no code hint runs", () => {
    const src = ["def foo():", "  pass"].join("\n");
    expect(tryCodeStructureNameHint("toml", src, { startLine: 1, endLine: 2 })).toBeNull();
  });

  it("when the buffer has no declaration patterns, then null is returned", () => {
    const src = ["// line one", "// line two"].join("\n");
    expect(tryCodeStructureNameHint("typescript", src, { startLine: 1, endLine: 2 })).toBeNull();
  });
});

describe("Given Python modules", () => {
  it("when a def is on the first selected line, then the function name is returned", () => {
    const src = ["async def fetch(url):", "    return url"].join("\n");
    expect(tryCodeStructureNameHint("python", src, { startLine: 1, endLine: 2 })).toBe("fetch");
  });

  it("when a class wraps the selection, then the class name is returned from above", () => {
    const src = ["class Box:", "    def size(self):", "        return 1"].join("\n");
    expect(tryCodeStructureNameHint("python", src, { startLine: 2, endLine: 3 })).toBe("Box");
  });

  it("when there is no enclosing class, then the def name on the selection is used", () => {
    const src = ["def standalone():", "    return 2"].join("\n");
    expect(tryCodeStructureNameHint("python", src, { startLine: 1, endLine: 2 })).toBe(
      "standalone",
    );
  });
});

describe("Given Rust, Go, Ruby, C#, Swift, and C++ sources", () => {
  it("extracts a Rust fn name", () => {
    const src = ["pub(crate) async fn run() {", "  Ok(())", "}"].join("\n");
    expect(tryCodeStructureNameHint("rust", src, { startLine: 1, endLine: 3 })).toBe("run");
  });

  it("extracts a Go func name", () => {
    const src = ["func (s *Server) Handle() {", "}"].join("\n");
    expect(tryCodeStructureNameHint("go", src, { startLine: 1, endLine: 2 })).toBe("Handle");
  });

  it("extracts a Ruby def", () => {
    const src = ["module Api", "  def show", "  end", "end"].join("\n");
    expect(tryCodeStructureNameHint("ruby", src, { startLine: 2, endLine: 3 })).toBe("show");
  });

  it("extracts a C# class", () => {
    const src = ["public sealed class Program {", "}"].join("\n");
    expect(tryCodeStructureNameHint("csharp", src, { startLine: 1, endLine: 2 })).toBe("Program");
  });

  it("extracts a Swift struct", () => {
    const src = ["public struct Model {", "}"].join("\n");
    expect(tryCodeStructureNameHint("swift", src, { startLine: 1, endLine: 2 })).toBe("Model");
  });

  it("extracts a C++ class", () => {
    const src = ["class Buffer {", "};"].join("\n");
    expect(tryCodeStructureNameHint("cpp", src, { startLine: 1, endLine: 2 })).toBe("Buffer");
  });

  it("extracts a Java interface", () => {
    const src = "public interface RowSet { }";
    expect(tryCodeStructureNameHint("java", src, { startLine: 1, endLine: 1 })).toBe("RowSet");
  });

  it("extracts a Kotlin fun or object", () => {
    expect(
      tryCodeStructureNameHint("kotlin", "private fun build() {}", { startLine: 1, endLine: 1 }),
    ).toBe("build");
    expect(
      tryCodeStructureNameHint("kotlin", "object Registry { }", { startLine: 1, endLine: 1 }),
    ).toBe("Registry");
  });

  it("extracts PHP class and function declarations", () => {
    expect(
      tryCodeStructureNameHint("php", "abstract class Handler { }", { startLine: 1, endLine: 1 }),
    ).toBe("Handler");
    expect(
      tryCodeStructureNameHint("php", "function wp_load() { }", { startLine: 1, endLine: 1 }),
    ).toBe("wp_load");
  });

  it("treats Jupyter cells like Python", () => {
    const src = ["def jupyter_cell():", "    return 1"].join("\n");
    expect(tryCodeStructureNameHint("jupyter", src, { startLine: 1, endLine: 2 })).toBe(
      "jupyter_cell",
    );
  });

  it("extracts Rust struct and enum keywords", () => {
    expect(
      tryCodeStructureNameHint("rust", "pub struct Point { }", { startLine: 1, endLine: 1 }),
    ).toBe("Point");
    expect(
      tryCodeStructureNameHint("rust", "pub enum Kind { A }", { startLine: 1, endLine: 1 }),
    ).toBe("Kind");
  });

  it("extracts Rust trait and impl targets", () => {
    expect(
      tryCodeStructureNameHint("rust", "pub trait Readable { }", { startLine: 1, endLine: 1 }),
    ).toBe("Readable");
    expect(
      tryCodeStructureNameHint("rust", "impl Buf for Bytes { }", { startLine: 1, endLine: 1 }),
    ).toBe("Bytes");
  });

  it("extracts a Go named type", () => {
    expect(
      tryCodeStructureNameHint("go", "type Reader struct { }", { startLine: 1, endLine: 1 }),
    ).toBe("Reader");
  });

  it("extracts a Swift function", () => {
    expect(
      tryCodeStructureNameHint("swift", "  func reset() { }", { startLine: 1, endLine: 1 }),
    ).toBe("reset");
  });

  it("extracts a C# namespace segment as the hint", () => {
    expect(
      tryCodeStructureNameHint("csharp", "namespace My.App { }", { startLine: 1, endLine: 1 }),
    ).toBe("My.App");
  });
});

describe("tryNormaliseContextLabelToMarkerId", () => {
  it("given a phrase with spaces, then a valid slug is produced", () => {
    expect(tryNormaliseContextLabelToMarkerId("Auth flow v2")).toBe("auth-flow-v2");
  });

  it("given a very long label, then the result still satisfies marker rules", () => {
    const long = `x${"a".repeat(90)}`;
    const id = tryNormaliseContextLabelToMarkerId(long);
    expect(id).toMatch(/^[a-z0-9][a-z0-9_-]{0,63}$/);
    expect(id?.length).toBeLessThanOrEqual(64);
  });

  it("given only punctuation, then null is returned", () => {
    expect(tryNormaliseContextLabelToMarkerId("!!!")).toBeNull();
  });

  it("given a label that never yields a valid marker prefix, then null is returned", () => {
    expect(tryNormaliseContextLabelToMarkerId("---___")).toBeNull();
  });
});

describe("CompositeRegionMarkerNamingStrategy", () => {
  it("given no usable hints, when rng is fixed, then the fallback is a stable six-character marker id", () => {
    const composite = new CompositeRegionMarkerNamingStrategy([], Math.random);
    const a = composite.suggestMarkerId({
      languageId: "plaintext",
      sourceText: "nope",
      range: { startLine: 1, endLine: 1 },
      rng: seeded([0.01, 0.01, 0.01, 0.01, 0.01, 0.01]),
    });
    const b = composite.suggestMarkerId({
      languageId: "plaintext",
      sourceText: "nope",
      range: { startLine: 1, endLine: 1 },
      rng: seeded([0.01, 0.01, 0.01, 0.01, 0.01, 0.01]),
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z0-9]{6}$/);
    expect(generateBlockId(seeded([0.01, 0.01, 0.01, 0.01, 0.01, 0.01]))).toBe(a);
  });

  it("given an enclosing symbol, then that slug wins over TOML context", () => {
    const composite = new CompositeRegionMarkerNamingStrategy([
      new EnclosingSymbolHintStrategy(),
      new TomlTableHeaderHintStrategy(),
    ]);
    const src = ["[anchors]", "x = 1"].join("\n");
    expect(
      composite.suggestMarkerId({
        languageId: "toml",
        sourceText: src,
        range: { startLine: 2, endLine: 2 },
        enclosingSymbolName: "My Feature",
      }),
    ).toBe("my-feature");
  });

  it("given an invalid hint return, when the next hint succeeds, then the valid one is used", () => {
    const composite = new CompositeRegionMarkerNamingStrategy([
      {
        trySuggestMarkerId: () => "bad id!",
      },
      new TomlTableHeaderHintStrategy(),
    ]);
    const src = ["[ok]", "v=1"].join("\n");
    expect(
      composite.suggestMarkerId({
        languageId: "toml",
        sourceText: src,
        range: { startLine: 2, endLine: 2 },
        rng: seeded([0.5]),
      }),
    ).toBe("ok");
  });
});

describe("defaultRegionMarkerNamingStrategy", () => {
  it("given a TOML file under [[angles.definitions]], then the id slugifies the table path", () => {
    const src = ["[[angles.definitions]]", 'id = "x"'].join("\n");
    expect(
      defaultRegionMarkerNamingStrategy.suggestMarkerId({
        languageId: "toml",
        sourceText: src,
        range: { startLine: 2, endLine: 2 },
        rng: seeded([0.99]),
      }),
    ).toBe("angles-definitions");
  });

  it("given TypeScript with a named function, then that name becomes the marker id", () => {
    const src = ["function alpha() {", "  return 1", "}"].join("\n");
    expect(
      defaultRegionMarkerNamingStrategy.suggestMarkerId({
        languageId: "typescript",
        sourceText: src,
        range: { startLine: 2, endLine: 2 },
        rng: seeded([0.99]),
      }),
    ).toBe("alpha");
  });

  it("given Markdown with a heading above the range, then the heading slug becomes the marker id", () => {
    const src = ["# Doc", "## API surface", "Details here."].join("\n");
    expect(
      defaultRegionMarkerNamingStrategy.suggestMarkerId({
        languageId: "md",
        sourceText: src,
        range: { startLine: 3, endLine: 3 },
        rng: seeded([0.99]),
      }),
    ).toBe("api-surface");
  });
});

describe("CallbackRegionMarkerNamingStrategy", () => {
  it("given a callback that returns a valid id, then that id is returned", () => {
    const s = new CallbackRegionMarkerNamingStrategy(() => "custom");
    expect(
      s.suggestMarkerId({
        languageId: "typescript",
        sourceText: "",
        range: { startLine: 1, endLine: 1 },
      }),
    ).toBe("custom");
  });

  it("given a callback that returns an invalid id, then construction-time validation is not applied to suggest — throws at suggestMarkerId", () => {
    const s = new CallbackRegionMarkerNamingStrategy(() => "bad!");
    expect(() =>
      s.suggestMarkerId({
        languageId: "typescript",
        sourceText: "",
        range: { startLine: 1, endLine: 1 },
      }),
    ).toThrow(/Invalid marker id/);
  });
});

describe("Isolated hint strategies", () => {
  it("EnclosingSymbolHintStrategy returns null when name is absent", () => {
    const h = new EnclosingSymbolHintStrategy();
    expect(
      h.trySuggestMarkerId({
        languageId: "ts",
        sourceText: "",
        range: { startLine: 1, endLine: 1 },
      }),
    ).toBeNull();
  });

  it("TomlTableHeaderHintStrategy returns null for non-TOML languages", () => {
    const h = new TomlTableHeaderHintStrategy();
    expect(
      h.trySuggestMarkerId({
        languageId: "typescript",
        sourceText: "[x]\na=1",
        range: { startLine: 2, endLine: 2 },
      }),
    ).toBeNull();
  });

  it("MarkdownHeadingHintStrategy returns null for TypeScript", () => {
    const h = new MarkdownHeadingHintStrategy();
    expect(
      h.trySuggestMarkerId({
        languageId: "typescript",
        sourceText: "# Hi",
        range: { startLine: 1, endLine: 1 },
      }),
    ).toBeNull();
  });

  it("MarkdownHeadingHintStrategy returns null when Markdown has no ATX heading above the range", () => {
    const h = new MarkdownHeadingHintStrategy();
    expect(
      h.trySuggestMarkerId({
        languageId: "markdown",
        sourceText: ["plain prose", "more lines"].join("\n"),
        range: { startLine: 2, endLine: 2 },
      }),
    ).toBeNull();
  });

  it("CodeStructureHintStrategy returns null for TOML", () => {
    const h = new CodeStructureHintStrategy();
    expect(
      h.trySuggestMarkerId({
        languageId: "toml",
        sourceText: "function x() {}",
        range: { startLine: 1, endLine: 1 },
      }),
    ).toBeNull();
  });
});
