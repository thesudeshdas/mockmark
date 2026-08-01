# Mockmark

Drop-in comments and annotations for static HTML mocks. It gives any repo a Figma-style review layer: numbered pins, drag-to-select regions, threaded replies, reactions, resolve/delete, and a tiny self-hosted API.

## Install

```bash
npm install -D mockmark
```

Or run without installing:

```bash
npx mockmark init docs/mockups
npx mockmark serve docs/mockups --port 4317
```

Open `http://localhost:4317` and press **C** to comment.

## Add to an existing repo

```bash
# Copies /mockmark/client.{js,css} into your mocks folder and injects every HTML mock.
npx mockmark init docs/mockups

# Later, only inject new HTML files.
npx mockmark inject docs/mockups

# Serve mocks with annotation persistence in .mockmark/data.json.
npx mockmark serve docs/mockups --data .mockmark/data.json --port 4317
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

Author names are stored in browser `localStorage`. Comments are stored in the JSON file passed to `mockmark serve`.

## Deploy

Mockmark has no SaaS dependency. Run the Node server wherever your mock previews are hosted:

```bash
mockmark serve ./public/mocks --port ${PORT:-4317} --data /data/mockmark.json
```

The browser client calls `/api/mockmark/*` on the same origin by default. Override it if needed:

```html
<meta name="mockmark-api-base" content="https://review.example.com/api/mockmark">
```

## API

- `GET /api/mockmark/threads?mockPath=...`
- `POST /api/mockmark/threads`
- `POST /api/mockmark/messages`
- `POST /api/mockmark/reactions`
- `POST /api/mockmark/resolve`
- `POST /api/mockmark/delete`

## Why

This started as a repo-local mock annotation tool and was extracted into a standalone open-source project so static mockups in any repository can collect review comments without adopting a design platform.
