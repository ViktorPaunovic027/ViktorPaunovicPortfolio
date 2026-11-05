# viktorpaunovic.com: improvements

Audit date: 3 November 2026. Code reviewed at commit `8660830` of `ViktorPaunovicPortfolio`. Line numbers refer to `index.html` unless stated otherwise.

## The short version

The site looks good and the three case-study pages are already light. The home page has one problem behind most of the slowness: it downloads a 2.37 MB compiler (Babel) on every visit to compile 19 KB of dashboard code. Removing that cuts the JavaScript download by 77%.

The most urgent fix is a different one. If any CDN script fails, visitors stay on the loading screen forever.

| Priority | Fix | Why it matters | Effort | Tested? |
|---|---|---|---:|---|
| 1 | Stop the loader getting stuck | A CDN failure leaves a dead page for a recruiter | 15 min | Yes |
| 2 | Show the intro once per session, for less time | Every visit costs about 3 s, including returning from a project page | 15 min | Yes |
| 3 | Pre-compile the dashboard and remove Babel | Removes 556 KB of the 725 KB of JavaScript | 30 min | Compile only |
| 4 | Lazy-load React and the dashboard on scroll | The hero needs neither | 45 min | No |
| 5 | Fix text contrast and small text | The main muted colour fails the accessibility minimum | 20 min | Calculated |
| 6 | Add labels to the loader's background charts | The panels look unfinished, and the labels already exist in the code | 10 min | Yes |
| 7 | Correct the content issues in section 5 | Recruiters will read these before they notice the speed | 30 min | n/a |
| 8 | Split `index.html` into separate files | Better caching, and far fewer tokens per Claude Code edit | 1 hour | No |

## What was measured

Measured in Chrome on the live site, on a fast desktop connection. Treat these as best-case figures: a phone on mobile data will be much slower.

| Measure | Result |
|---|---|
| First paint (the loader only) | 148 ms |
| Earliest content appears | About 3 s, set by a timer in the code |
| Largest contentful paint | First real candidate at 3.5 s |
| Layout shift | 0 |
| HTML | 109 KB, 28 KB compressed |
| Images (`<img>`) | 0 |

| Script | Size | Gzipped | Share of JS (gzipped) |
|---|---:|---:|---:|
| Babel standalone 8.1.1 | 2,367 KB | 556 KB | 77% |
| three.js r128 | 603 KB | 121 KB | 17% |
| react-dom 18.3.1 | 132 KB | 43 KB | 6% |
| react 18.3.1 | 11 KB | 4 KB | 1% |
| **Total** | **3,113 KB** | **725 KB** | |

At 1.6 Mbit/s, a common slow-4G test speed, 725 KB takes about 3.6 s to download before anything runs. That figure is a calculation, not a phone measurement.

**Not measured:** Lighthouse and real phone performance. The PageSpeed API wasn't reachable from this environment, so run [PageSpeed Insights](https://pagespeed.web.dev/) on mobile before you start and again after step 4. The mobile layout wasn't reviewed either. The browser also recorded an odd LCP entry at 20.5 s while automation was driving the tab. Don't rely on that number until Lighthouse confirms it.

## 1. Loading screen

### 1.1 The page can get stuck on the loader forever (urgent)

`index.html` runs one large script. `new THREE.WebGLRenderer` at line 746 throws an error if three.js didn't load, and that stops the script before the loader exit code at line 771 can run.

I tested this with the CDNs blocked: the loader never left, the page stayed at opacity 0, and the mouse cursor stayed hidden. The console showed `THREE is not defined`. With JavaScript turned off, the result was the same. A device without WebGL should fail in the same place, but I didn't test that case.

**Fix (tested: the page recovers with the CDNs blocked and with JavaScript off):**

```html
<!-- Add just before </head> -->
<noscript><style>
  #loader{display:none}.page{opacity:1}
  .fade-in,.stagger>*{opacity:1;transform:none}
  body{cursor:auto}
  #cursor,#cursor-ring,#cursor-trail,#particle-canvas{display:none}
</style></noscript>
```

```js
// Line 743: first line inside the molecule function
if(!window.THREE)return;

// Line 788: guard the resize call
resizeMolecule&&resizeMolecule();
```

Wrapping the WebGL setup in `try/catch` also covers devices without WebGL.

### 1.2 Every visit costs about 3 seconds

The minimum is `MIN=2000` (line 772) plus a 980 ms exit (line 788), so content is hidden for about 3 s even with everything cached. It replays when someone clicks back from a project page, because those links are normal page loads (`../../index.html#projects`).

**Fix (tested locally: first visit about 2.7 s, repeat visit about 1.1 s):**

```js
// Line 772
let seen=false;
try{seen=sessionStorage.getItem('intro-seen')==='1';sessionStorage.setItem('intro-seen','1');}catch(_){}
const MIN=seen?0:1200,st=Date.now();
```

The remaining 1.1 s on repeat visits is the exit animation. The next step is to skip the loader completely when `seen` is true. Hide `#loader` and show `.page` from a small script in `<head>`, so nothing flashes.

### 1.3 The loader's animation starts late on slow connections

The dashboard and molecule code sits after the blocking CDN scripts (lines 689–692). On a slow connection the charts and molecule can't start until those downloads finish. The 2 s timer also starts only then, so the wait is download time plus 3 s. Moving the loader code above the CDN scripts fixes the order, and steps 3 and 4 remove most of the wait.

### 1.4 The progress bar isn't real

It's a fixed CSS animation (line 139) that starts at 1 s and runs for 1.8 s, and has no link to loading. The text fades at about 2 s, so on a fast connection the bar disappears at about three-quarters full. Either shorten it to finish with the loader or replace it with something that doesn't imply progress.

### 1.5 No mouse cursor during the loader

`body{cursor:none}` applies from the start (line 112), but the custom cursor only starts after the loader ends (line 792). Desktop visitors have no cursor for 3 s. Run `initCursor()` at the start, or set `cursor:none` from JavaScript only once the custom cursor is running.

## 2. Speed

### 2.1 Pre-compile the dashboard and remove Babel (biggest win)

The browser is doing a job that only needs to happen once on your machine. Babel's own console warning says to precompile for production.

```bash
# 1. Move lines 1001–1464 of index.html into dashboard.jsx
# 2. Compile it
npx esbuild dashboard.jsx --jsx=transform --minify --outfile=dashboard.min.js
```

```html
<!-- 3. Delete the Babel script (line 997) and the text/babel block (lines 1000–1465) -->
<!-- 4. Load the compiled file instead -->
<script src="dashboard.min.js"></script>
```

I compiled the same code with TypeScript as a check: there were no errors, and the output was 5.75 KB gzipped without minifying, compared with Babel's 556 KB. esbuild wasn't available here, and I didn't render the compiled dashboard in a browser, so check it after the change.

Keep `dashboard.jsx` as the file you edit, and rerun the command after each change. Commit `dashboard.min.js` so Netlify still needs no build step.

### 2.2 Pin versions and host the libraries yourself

`react@18`, `react-dom@18` and `@babel/standalone` have no exact version, so each one redirects before downloading. Babel has already moved to a new major version on your live site without you changing anything. It still works, but a future release could break the dashboard with no warning.

Save exact versions to a `/vendor` folder in the repo and load them from there. This removes the redirects and also removes unpkg as a way for the site to go down.

### 2.3 The background animation never pauses

The comment at line 728 says the particles pause when scrolled past, but the condition can't become true. The canvas is `position:fixed`, so the observer always reports it as visible. I confirmed `isIntersecting: true` at scroll position 6229. The O(n²) loop therefore runs for the whole visit.

The comment also says the background sits behind a dark page, but the dots are still visible further down the page. So a pause should freeze the dots instead of hiding them. Replace the check with `if(document.hidden)return;`, and consider running the loop at 30 fps once past the hero.

### 2.4 Fonts

Google Fonts loads a blocking stylesheet plus 69 KB of font files. Host the two `.woff2` files yourself, add a `<link rel="preload">` for the heading font, and use the same weights on all four pages, since the case studies currently request different sets.

### 2.5 Dead code

`initSparkline` (lines 878–885) and the CSS at line 181 look for `#sparkline-canvas`, which isn't in the page. Delete them.

## 3. Lazy loading

The page has no `<img>` tags, so `loading="lazy"` won't do anything here. All the weight is in scripts, so those are what to lazy-load. `content-visibility:auto` on `.section` (line 203) is already a good choice. Changing `contain-intrinsic-size:1px 800px` to `auto 800px` will make the scrollbar steadier, because the browser then remembers each section's real height.

### 3.1 Load React and the dashboard on approach

The dashboard starts about 3,800 px down the page, but its code loads at the start. Not yet tested, so check the dashboard after adding it:

```js
function loadScript(src){
  return new Promise((ok,fail)=>{
    const s=document.createElement('script');
    s.src=src;s.onload=ok;s.onerror=fail;
    document.head.appendChild(s);
  });
}

const root=document.getElementById('db-root');
new IntersectionObserver(async([entry],obs)=>{
  if(!entry.isIntersecting)return;
  obs.disconnect();
  try{
    await loadScript('/vendor/react.production.min.js');
    await loadScript('/vendor/react-dom.production.min.js');
    await loadScript('/dashboard.min.js');
  }catch{
    root.textContent='The dashboard could not load. Please refresh the page.';
  }
},{rootMargin:'600px'}).observe(document.getElementById('analytics'));
```

Give `#db-root` a `min-height` close to its real height, so the page doesn't jump when the dashboard appears.

### 3.2 Three.js

Three.js is the second-largest script, and the molecule is your signature visual, so I'd keep it. Show a static SVG molecule first, then load three.js after the hero is visible and swap it in. On phones and for visitors with reduced motion turned on, keep the SVG and skip the 121 KB download.

### 3.3 Expected result

| | JS downloaded before the hero is ready (gzipped) |
|---|---:|
| Today | 725 KB |
| After removing Babel | About 174 KB |
| After lazy-loading React, the dashboard and three.js | About 0 KB from libraries, only your own code |

These figures are calculated from the measured file sizes.

## 4. Background and text

"Background text" could mean a few things, so this covers all three likely meanings.

### 4.1 Text in the loader's background

The chart panels have no text, although the code already gives them labels: `label:'SESSIONS'`, `'REVENUE'`, `'EVENTS'`, `'USERS'` (line 713). `draw()` (line 707) never renders them. Add this at the end of `draw()`, after `brk(...)`:

```js
cx.font='600 11px Inter,system-ui,sans-serif';
cx.textAlign='left';
cx.fillStyle=`rgba(${r},${g},${b},.75)`;
cx.fillText(this.label,this.x+12,this.y+20);
cx.textAlign='right';
cx.fillStyle='rgba(240,240,255,.6)';
cx.fillText(Math.round(sl[sl.length-1]*1000).toLocaleString('en-GB'),this.x+this.w-12,this.y+20);
cx.textAlign='left';
```

This worked when tested, with two refinements needed:

- The chart line can run through the text, which I saw on the `REVENUE` panel. Keep the line out of the top 28 px of each panel.
- The canvases ignore `devicePixelRatio` (lines 699 and 723), so text will look soft on high-resolution screens. Scale the canvas by the pixel ratio.

The two bar panels would also need a `label` value.

### 4.2 Text sitting on the dark background

Contrast against `#0a0a0f`. The accessibility minimum for normal text is 4.5:1.

| Text | Now | Fix | After |
|---|---:|---|---:|
| `--muted`, used 17 times (line 108) | 4.12:1, fails | Change `.45` to `.6` | 6.58:1 |
| Form placeholders (line 380) | 2.03:1, fails | Change `.25` to `.55` | 5.67:1 |
| "Malta · CET" label (line 156) | 3.84:1, fails | Remove `opacity:.55` | Passes |
| Purple `#bf00ff` | 4.38:1 | Large text only | |

Several labels are also very small. Raise anything below `.8rem` (about 13 px) to at least that size, starting with `.mnav-eyebrow` (.65rem), `.db-period-label` and `.db-tt-title` (.68rem), `.db-card-label`, `.db-chart-sub`, `.db-leg` and `.ci-link` (.7rem), and `.stat-label` (.72rem). The `--muted` change is the best single edit in this section: one value improves text across the whole page.

The home page also needs a `@media(prefers-reduced-motion:reduce)` rule, so visitors who turn off animation aren't shown the typewriter, particles and tilt effects. All three case-study pages already have one.

### 4.3 Empty space on wide screens

Content widths don't match. `.about-card` stops at 820 px, `.timeline` at 860 px and `.contact-wrap` at 1,080 px, while Skills, the dashboard and Projects fill the full width. At 2,122 px wide, the right half of those sections is empty. Give all sections one shared maximum width, centred.

Large faint text could also fill that space and add character. This is an optional design idea and hasn't been tested:

```css
.section::before{
  content:attr(data-bg);position:absolute;right:6%;top:4rem;
  font:700 clamp(5rem,14vw,13rem)/1 'Space Grotesk',sans-serif;
  color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.05);
  pointer-events:none;
}
@media(max-width:1100px){.section::before{display:none}}
```

```html
<section id="about" class="section" data-bg="01">
```

## 5. Other issues found

**Check these facts. They read as out of date or inconsistent. Only you know the correct version:**

- Dates: the MCAST diploma says 2023–2026 and the About text says "while completing" it (lines 507, 522, 523). It's now November 2026.
- Experience: "close to 2 years" (line 507) doesn't fit "2024 - Present".
- Certificate dates: line 524 says the Google certificate was completed in 2021–2023, while line 607 says 2024–2025. The Data Science Specialisation has the same conflict at line 608.
- Footer: `© 2025` (line 657), while the case studies say 2026.

**Label the demo data on the home page.** The case-study pages state that their data is synthetic, and the README says the metrics are invented. The home page never says so. It has a section labelled "Live Demo" showing "Last updated: just now" (line 1443) with fixed numbers, and project cards that read like real work ("enabling daily stakeholder reporting across multiple markets"). An employer could take those as real results, so add "Demo with sample data" and remove "Last updated".

**Numbers and links missing from the HTML:**

- The stats are `0` in the HTML (lines 509–512), so anything that doesn't run JavaScript reads "0 Dashboards Built". I saw this in a page fetch. Put the real numbers in the HTML and let the animation count up to them.
- "View Project" links are `#` until a script fixes them (lines 581–598). Put the real `href` in the HTML and delete the script.

**SEO and sharing:**

- `og-image.svg` is unlikely to show when the link is shared, because major social platforms don't support SVG preview images. Export a 1200×630 PNG. This matters for a portfolio you share on LinkedIn.
- Section titles are `<div>`s (for example, line 505). The page has only one `<h1>`, one `<h2>` and one `<h3>`. Make the section titles `<h2>`.

**Accessibility:** form labels aren't linked to their inputs (lines 649–650). Add `for` and `id`.

**Skills:** bars such as HTML 92%, SQL 90% and Python 80% can't be verified, and they rank HTML above your core data skills. English is also listed under "Languages & Tech". Grouping skills by what you've built with them would say more.

**Worth a quick check:** on my first load, the hero molecule wasn't visible about 7 s in. On the next load it was there, so I couldn't reproduce it. It may just have been the tab being in the background.

**README:** it still says to add your Netlify URL and describes a first-time setup.

## 6. Suggested order

1. Run PageSpeed Insights on mobile and save the score.
2. Apply 1.1, 1.2 and 1.5, and deploy. The site is safer straight away.
3. Apply 4.1 and 4.2.
4. Apply 2.1, 2.2 and 3.1, then rerun PageSpeed.
5. Correct the content in section 5.
6. Split `index.html` into `css/`, `js/` and `dashboard.jsx`, apply 3.2, then run Graphify as described below.

## 7. Saving tokens in Claude Code

Two things are included: `project-map/` and a `CLAUDE.md`. Copy both into the repo root. Claude Code reads `CLAUDE.md` automatically, and it points to a 6 KB line-by-line map.

| What Claude reads | Size | Rough tokens |
|---|---:|---:|
| `index.html` in full | 109 KB | 27,000 |
| All four HTML pages | 244 KB | 61,000 |
| `PROJECT_MAP.md` | 6 KB | 1,500 |

Token counts are estimates at 4 characters per token. After you edit the code, line numbers go out of date, so rebuild the map with:

```bash
python project-map/build_map.py
```

### About Graphify

**This map was not made by Graphify.** Graphify couldn't be installed here, because the package registries were blocked and running a copy from GitHub wasn't allowed. So I built a smaller tool that does the same job for this repo. You can run the real thing on your own machine:

```bash
uv tool install graphifyy     # note the double y; pipx or pip also work
graphify install
```

Then, in Claude Code, from the repo folder:

```text
/graphify .
```

And in your terminal, once the graph exists:

```bash
graphify claude install
```

Graphify's source lists `.html` as a document type (`detect.py`, line 49), not code. Its free local code parser therefore won't read the JavaScript inside your pages. They go through its AI pass instead, which costs tokens once. If you do step 6 of the order above first, your JavaScript becomes real `.js` files that Graphify should be able to parse locally, and the graph will be more detailed. Until then, `PROJECT_MAP.md` is likely to be the better guide to this repo.
