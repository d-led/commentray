# `blocks.md` — companion

Normative spec: **Markdown layer** (human prose + optional `<!-- commentray:block id=… -->` carrier) vs **JSON index** (machine-owned ids, **`lines:`** / **`symbol:`** anchors, optional **fingerprints** for drift work later).

## In one glance

| Layer           | Owns                                                        |
| --------------- | ----------------------------------------------------------- |
| Companion `.md` | Wording, diagrams, headings                                 |
| `index.json`    | `id`, `anchor`, optional `fingerprint`, verification fields |

## Staleness (v0)

Diagnostics only — no silent rewrite of commentary on blob or branch mismatch; see same file § _Staleness (v0 rules)_.

## Editor tie-in

Markers give the extension something grep-stable for **block-aware scroll**; without markers + index rows, sync falls back to **proportional** scrolling.
