# Commentray VS Code dogfood fixture

Minimal workspace opened by `npm run extension:dogfood` when no folder argument is passed (see `scripts/editor-extension.sh`).

1. `npm run extension:dogfood` — build and install the extension from this repo, then open this folder in the editor.
2. Open `sample.ts`.
3. Command Palette → **Commentray: Open commentray beside source**.
4. Paired `.commentray/source/sample.ts.md` is created on demand, with scroll sync from the code editor to the Markdown.
