# Viktor Paunovic — Data Analyst Portfolio

A static personal portfolio with a self-contained home page and three project case-study pages. There is no build step or dependency installation; just open and edit the HTML files.

**Live demo:** _(add your Netlify URL here after deploying)_

---

## What's inside

- Three.js animated molecule (hero centerpiece)
- React 18 iGaming Analytics Dashboard (KPIs, charts, filters, tooltips) — loaded via Babel standalone, no build step
- Custom neon cursor with particle trail
- Typewriter hero subtitle, animated counters, tilt-card effects
- 60fps smooth scroll for nav + back-to-top
- Mobile hamburger drawer with staggered link animation
- Scroll progress bar, Web Audio click/whoosh SFX
- Glassmorphism dark theme (cyan / purple / green)
- Three responsive project case studies with clearly labelled synthetic demonstration data

---

## Push to GitHub

From inside the `portfolio` folder, open a terminal and run:

```bash
git init
git add .
git commit -m "Initial portfolio"
git branch -M main
```

Then create a new empty repo on https://github.com/new (name it `portfolio` or `viktor-paunovic.github.io` — anything you like, no README/license/gitignore on the GitHub side).

GitHub will show you the remote URL. Paste it into the next command:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

That's it — your code is on GitHub.

---

## Deploy to Netlify (connected to GitHub)

1. Go to https://app.netlify.com/start and sign in with your GitHub account.
2. Click **Import an existing project** → **Deploy with GitHub**.
3. Authorize Netlify, then pick the repo you just pushed.
4. Settings — leave everything at default:
   - **Build command:** (leave empty)
   - **Publish directory:** `.` (a single dot, meaning the project root)
5. Click **Deploy site**.

In ~10 seconds you'll have a live URL like `https://random-name-12345.netlify.app`.

### Rename the URL

In your Netlify site dashboard:
**Site configuration → Change site name** → set it to something like `viktor-paunovic` → your URL becomes `viktor-paunovic.netlify.app`.

### Custom domain (optional, free)

If you buy a domain (e.g. on Namecheap, Cloudflare, or Porkbun), Netlify's **Domain management** lets you connect it and provisions HTTPS automatically.

### Automatic deploys

Any future `git push` to `main` triggers a redeploy. To update the site:

```bash
git add .
git commit -m "Update content"
git push
```

Netlify rebuilds in seconds.

---

## Alternative: Netlify drag-and-drop (no GitHub needed)

If you just want to test quickly without GitHub:

1. Go to https://app.netlify.com/drop
2. Drag the entire `portfolio` folder into the browser window
3. Site is live in 5 seconds

You lose auto-redeploys this way — every update means dragging the folder again.

---

## Project data and links

The three project cards are connected to their case-study pages by a small script immediately after the unchanged Projects section in `index.html`.

All project metrics are invented, synthetic demonstration data. Replace them with validated source data before presenting the pages as real business results.

---

## Local preview

Any static file server works. Two easy options:

```bash
# Option 1: Node (no install needed if you have npx)
npx serve . --listen 3000

# Option 2: Python
python -m http.server 8080
```

Then open http://localhost:3000 (or 8080).

---

## Project structure

```
portfolio/
  index.html                        ← portfolio home page
  projects/
    igaming-kpi-dashboard/
      index.html                    ← iGaming KPI case study
    player-segmentation-model/
      index.html                    ← player clustering case study
    revenue-trend-report/
      index.html                    ← revenue reporting case study
  sitemap.xml                       ← public URLs for search engines
  robots.txt                        ← crawler rules and sitemap location
  README.md                         ← you're reading it
```

No build step, package manager, or framework lock-in is required.
