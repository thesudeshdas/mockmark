# Mockmark

Backendless, private comments and annotations for static HTML mocks.

Mockmark adds a Figma-style review layer to HTML mockups: numbered pins, drag-to-select regions, threaded replies, reactions, resolve/delete, and an all-comments panel.

## Privacy model

Mockmark does **not** include a backend, hosted service, telemetry, database, or network sync.

- Comments stay in the reviewer's browser `localStorage`.
- Nothing is sent to Mockmark or to the project owner.
- Sharing is explicit: reviewers export a JSON file and send/commit it wherever the team chooses.
- Import merges another exported JSON file into the current browser.

That keeps ownership with the installing repository/team, not Mockmark.

## Install

```bash
npm install -D mockmark
```

Or run without installing:

```bash
npx mockmark init docs/mockups
python3 -m http.server 4317 -d docs/mockups
```

Open `http://localhost:4317` and press **C** to comment.

## Add to an existing repo

```bash
# Copies /mockmark/client.{js,css} into your mocks folder and injects every HTML mock.
npx mockmark init docs/mockups

# Later, only inject new HTML files.
npx mockmark inject docs/mockups
```

Manual opt-in for one page:

```html
<link rel="stylesheet" href="./mockmark/client.css">
<script type="module" src="./mockmark/client.js"></script>
```

## Reviewer shortcuts

- **C**: toggle comment mode
- Click: point comment
- Drag: region comment
- **L**: all comments
- **H**: hide/show markers
- Export/Import buttons: move comments by explicit JSON file handoff

## Data portability

Exported files use this shape:

```json
{
  "version": 1,
  "exportedAt": 1785560000000,
  "threads": [],
  "messages": [],
  "reactions": []
}
```

Teams can keep those files private, attach them to issues, or commit them to their own repo. Mockmark does not prescribe or host the workflow.

## Why

This started as a repo-local mock annotation tool and was extracted into a standalone open-source project so static mockups in any repository can collect review comments without adopting a design platform or sending review data to a third party.
