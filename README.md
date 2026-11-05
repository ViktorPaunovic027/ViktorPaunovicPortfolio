# Viktor Paunovic — Data Analyst Portfolio

Live site: **https://viktorpaunovic.com** (Netlify, deployed from `main`).

A static portfolio: one home page and three project case-study pages. Netlify runs no build. The only compiled file, `js/dashboard.min.js`, is committed.

---

## Structure

```
index.html                 home page markup (meta tags, sections, static SVG molecule)
css/main.css               home page styles
js/main.js                 home page script: loader, particles, cursor, nav, lazy loading
src/dashboard.jsx          dashboard source (React + JSX). Edit this file…
js/dashboard.min.js        …then rebuild this one (see below). Committed.
vendor/                    pinned React 18.3.1, ReactDOM 18.3.1, three.js r128
fonts/                     self-hosted Inter and Space Grotesk (variable, latin subset)
projects/<name>/index.html case studies; each has its own inline CSS and JS
og-image.svg / .png        social preview image (the PNG is what the meta tags use)
_headers                   Netlify cache rules for vendor/ and fonts/
sitemap.xml, robots.txt
```

## How the home page loads

- **Intro:** the loader plays when a visitor enters the site, once per tab. Reloads, arrivals from a case-study page, and visitors who prefer reduced motion go straight to the page. It shows for at least 2 s from the start of the visit (`MIN_SHOW` in `js/main.js`), then leaves once the page is ready (DOM parsed, web fonts loaded, window `load`) and its short name reveal has finished; a slow asset can hold it for at most 4 s. Its bar is indeterminate, because real progress can't be measured. The network in the middle is the hero molecule (`molGeometry()`), and it settles into the hero as the page appears. The corner charts are drawings with no data. A failsafe in `<head>` shows the page after 5 s if `js/main.js` never runs.
- **Molecule:** the hero shows a static SVG molecule first. On desktop, three.js loads after the hero is visible and fades the 3D version in. Phones and reduced-motion visitors keep the SVG.
- **Dashboard:** React and the dashboard load only when the visitor scrolls near the Analytics section.
- **Without JavaScript:** all content still shows.

## Editing the dashboard

Edit `src/dashboard.jsx`, then rebuild (needs Node; nothing is added to the repo):

```bash
npx --yes esbuild@0.28.2 src/dashboard.jsx --jsx=transform --format=iife --minify --target=es2019 --outfile=js/dashboard.min.js
```

Commit both files. If the dashboard's layout changes height, update the `#db-root` `min-height` values in `css/main.css`, which reserve its space while it loads.

## Updating the libraries

The libraries are saved in `vendor/` with the version in the file name, so they never change silently. To upgrade, download the new file under a new name and update the path in `js/main.js`.

## Demo data

The dashboard and the three case studies use synthetic data. The home page says so in the footer, and each case study says so on its own page. Replace the data with validated source data before presenting anything as real results.

## Local preview

```bash
npx serve .
# or
python -m http.server 8080
```

Test the changes locally before pushing. Every push to `main` deploys.
