# ViktorPaunovicPortfolio

Static portfolio on Netlify (viktorpaunovic.com): one home page and three case-study pages. Netlify runs no build step.

## Where things live

- Home page markup: `index.html`. Styles: `css/main.css`. Script: `js/main.js`.
- Dashboard: edit `src/dashboard.jsx`, then rebuild `js/dashboard.min.js` with the esbuild command in `README.md`. Commit both.
- Loader: `#loader` in `index.html` (its corner charts are static SVG drawings with no values); the LOADER section of `css/main.css`; `initLoaderNet()` (the network canvas) and `playIntro()` (readiness and exit) in `js/main.js`; the intro-once logic is the inline script in `<head>`.
- Molecule: the static SVG `#mol-sym` in `index.html`, the 3D version `buildMolecule()` and the loader network `initLoaderNet()` in `js/main.js` share `molGeometry()` and the same camera. If you change the geometry, regenerate the SVG to match.
- Libraries: pinned copies in `vendor/`. Fonts: `fonts/`.
- Case studies: `projects/<name>/index.html`. Each page has its own inline CSS and JS. They share only `fonts/` with the home page.
- Improvement plan: `IMPROVEMENTS.md`.

## Rules

- The data on the case-study pages and in the dashboard is synthetic. Do not present it as real results. The home page states this in small text in the footer, not in the dashboard or project cards.
- Keep the site working without a build service. Commit any compiled files.
- Keep the page usable with JavaScript off, and when a script fails to load.
- Test changes with `npx serve .` before deploying.
