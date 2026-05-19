# Viktor Paunovic — Data Analyst Portfolio

A single-page personal portfolio built as a self-contained `index.html` — no build step, no dependencies to install. Just open and edit.

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

## Before going live — fill in these placeholders

Open `index.html` and search-and-replace:

| Find | Replace with |
|---|---|
| `YOUR_FORM_ID` (line ~459, in the contact form) | Your Formspree form ID — get one free at https://formspree.io |
| `Your University Name` | Your real university |
| `Bachelor's Degree in [Your Field]` | Your real degree |
| `Year of Graduation` | The year |
| `viktor@email.com` (appears twice) | Your real email |
| `linkedin.com/in/viktor-paunovic` (appears in 2 places) | Your real LinkedIn URL |
| `github.com/viktor` | Your real GitHub URL |
| `href="#"` on the three project cards | Real project links |

The Download CV button (`<a href="#" class="btn-cv">`) should point at a hosted PDF — easiest path: upload your CV PDF to the project folder as `cv.pdf` and change the link to `href="cv.pdf" download`.

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
  index.html       ← entire site (HTML + CSS + JS + React + Three.js, all inline)
  README.md        ← you're reading it
```

That's literally the whole project. No build step, no dependencies, no framework lock-in.
