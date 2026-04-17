# Commentray VS Code dogfood fixture

Minimal fixture used by `scripts/editor-extension.sh dogfood` to exercise the
Commentray extension in the Extension Development Host without colliding with
the main repository's window.

To try the extension here:

1. Run `npm run extension:dogfood` (or `bash scripts/editor-extension.sh dogfood`).
2. In the opened dev-host window, open `sample.ts`.
3. Command Palette → **Commentray: Open commentray beside source**.
4. A paired `.commentray/source/sample.ts.md` opens (created on demand), with
   scroll sync from the code editor to the Markdown.
