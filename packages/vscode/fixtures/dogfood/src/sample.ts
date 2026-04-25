// Sample source file for exercising the Commentray VS Code extension.
//
// Open this file and run **Commentray: Open paired markdown beside editor** (or
// the angle / rendered-preview commands) to work with the companion Markdown
// under `.commentray/source/src/sample.ts/`. README screenshots use longer
// companion prose plus a page break so the rendered preview is readable in
// small frames.

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}.`;
}
