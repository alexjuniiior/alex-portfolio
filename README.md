# Alex Lisovski — portfolio

Live at **alexlisovski.com**. Hosted on Netlify, content edited with Pages CMS.

## Editing content (no code)
1. Go to **app.pagescms.org** and sign in with GitHub.
2. Open the `alex-portfolio` repository.
3. **Projects** — add, remove, drag to reorder, upload images, edit heading/subtext, pick the desktop column.
   **Intro & button** — your name, intro paragraphs, button text and link.
4. Click **Save**. Netlify rebuilds and publishes in about a minute.

Images can be any size; the build resizes them to 1032px wide and compresses them.

## How it fits together
- `content/projects.json`, `content/site.json` — the content (what the CMS edits)
- `images/` — original uploads
- `src/` — design: page template, styles, scripts, fonts
- `build.js` — turns content + design into the finished site in `dist/`
- `.pages.yml` — CMS form setup · `netlify.toml` — Netlify build settings

## Running it locally (optional)
```
npm install
npm run preview
```

## Font licence
PP Formula is a Pangram Pangram typeface; public web use needs their web licence.
JetBrains Mono is free (OFL).
