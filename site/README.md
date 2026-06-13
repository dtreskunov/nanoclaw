# BananaClaw marketing site

Single-page landing site for [BananaClaw](https://github.com/dtreskunov/nanoclaw).
Deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to
`main` that touches `site/`, `assets/screenshots/`, or the workflow itself.

## Local preview

Screenshots live in `../assets/screenshots/` (so they can also be referenced
from `README.md` directly on GitHub). The workflow copies them into
`site/screenshots/` before deploying. To preview locally:

```sh
mkdir -p screenshots
cp ../assets/screenshots/*.png screenshots/
python3 -m http.server 8000
# open http://localhost:8000
```

`screenshots/` is gitignored.

## Enabling GH Pages

In the repo settings → Pages → **Source: GitHub Actions**. Then push a change
under `site/` (or trigger the workflow manually). The deployed URL is
`https://denis.adsoconsulting.org/nanoclaw/`.

## Editing

Pure HTML + inline CSS, no build step, no JS framework. Edit
`site/index.html` and push.
