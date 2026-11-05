/*
 * iGaming analytics dashboard (demo, synthetic data).
 * This is the source file. The page loads the compiled js/dashboard.min.js.
 * After editing, rebuild with:
 *   npx --yes esbuild@0.28.2 src/dashboard.jsx --jsx=transform --format=iife --minify --target=es2019 --outfile=js/dashboard.min.js
 * React and ReactDOM are globals loaded from /vendor before this file runs.
 */
const { useState, useEffect, useLayoutEffect, useRef, useCallback } = React;

/* ── PALETTE ── */
const C = {
  cyan:   '#00f5ff', purple: '#bf00ff',
  green:  '#00ff88', amber:  '#f5a623', red: '#ff6b6b',
};
const CARD_COLORS = {
  ggr:      { main:'#00f5ff', bg:'rgba(0,245,255,.07)',  border:'rgba(0,245,255,.2)',  glow:'rgba(0,245,255,' },
  deposits: { main:'#bf00ff', bg:'rgba(191,0,255,.07)',  border:'rgba(191,0,255,.2)', glow:'rgba(191,0,255,' },
  turnover: { main:'#f5a623', bg:'rgba(245,166,35,.07)', border:'rgba(245,166,35,.2)',glow:'rgba(245,166,35,' },
  ftds:     { main:'#00ff88', bg:'rgba(0,255,136,.07)',  border:'rgba(0,255,136,.2)', glow:'rgba(0,255,136,' },
};

/* ── DATA ── */
const MARKETS = ['Germany','United Kingdom','Finland','Norway','Canada','New Zealand','Sweden'];
const MKT_SHORT = ['DE','UK','FI','NO','CA','NZ','SE'];

const DB = {
  'Today': {
    kpis:[
      {id:'ggr',      label:'GGR',           val:21340,    prev:18200,  pfx:'€'},
      {id:'deposits', label:'Deposit Amount', val:142600,   prev:128400, pfx:'€'},
      {id:'turnover', label:'Turnover',       val:384500,   prev:412000, pfx:'€'},
      {id:'ftds',     label:'FTDs',           val:134,      prev:98,     pfx:''},
    ],
    line:{labels:['00:00','04:00','08:00','12:00','16:00','20:00','23:59'],
      ggr:[1200,800,2400,4800,5200,4900,2040],dep:[8000,5200,14000,32000,38000,32000,13400]},
    bar:{values:[28,22,18,15,19,12,20]},
  },
  '7D': {
    kpis:[
      {id:'ggr',      label:'GGR',           val:142850,   prev:127080,  pfx:'€'},
      {id:'deposits', label:'Deposit Amount', val:892340,   prev:820800,  pfx:'€'},
      {id:'turnover', label:'Turnover',       val:2145600,  prev:2217300, pfx:'€'},
      {id:'ftds',     label:'FTDs',           val:847,      prev:693,     pfx:''},
    ],
    line:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      ggr:[18200,22400,19800,25600,21300,24500,11050],dep:[112000,138000,124000,158000,142000,162000,56340]},
    bar:{values:[182,154,124,98,132,78,79]},
  },
  '30D': {
    kpis:[
      {id:'ggr',      label:'GGR',           val:524200,   prev:443800,  pfx:'€'},
      {id:'deposits', label:'Deposit Amount', val:3248900,  prev:2835600, pfx:'€'},
      {id:'turnover', label:'Turnover',       val:8924000,  prev:8356000, pfx:'€'},
      {id:'ftds',     label:'FTDs',           val:2847,     prev:2168,    pfx:''},
    ],
    line:{labels:['Week 1','Week 2','Week 3','Week 4'],
      ggr:[118000,142000,134000,130200],dep:[742000,892000,824000,790900]},
    bar:{values:[624,542,418,348,412,248,255]},
  },
  '90D': {
    kpis:[
      {id:'ggr',      label:'GGR',           val:1842600,  prev:1476200, pfx:'€'},
      {id:'deposits', label:'Deposit Amount', val:11284000, prev:9842000, pfx:'€'},
      {id:'turnover', label:'Turnover',       val:29840000, prev:27420000,pfx:'€'},
      {id:'ftds',     label:'FTDs',           val:8642,     prev:6284,    pfx:''},
    ],
    line:{labels:['January','February','March'],
      ggr:[548000,642000,652600],dep:[3248000,3842000,4194000]},
    bar:{values:[1842,1624,1248,984,1124,742,1078]},
  },
};

/* ── HELPERS ── */
const fmtVal = (v, pfx='€') => {
  const n = pfx === '' ? '' : pfx;
  if (v >= 1e6) return `${n}${(v/1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${n}${(v/1e3).toFixed(1)}K`;
  return `${n}${v.toLocaleString()}`;
};
const pct = (a, b) => ((a - b) / b * 100).toFixed(1);

/* SVG chart helpers */
// The line chart draws in a viewBox as wide as its container (capped at 560), so on
// phones its labels render at their real size instead of being scaled down to ~6px.
const W_LINE_MAX = 560, W_LINE_MIN = 240, H_LINE = 210;
const PL = 52, PR = 18, PT = 18, PB = 34;

function makeLinePts(data, W_LINE, extraMin=0) {
  const cw = W_LINE - PL - PR, ch = H_LINE - PT - PB;
  const max = Math.max(...data), min = Math.min(Math.min(...data) * .88, extraMin);
  const rng = max - min || 1;
  return data.map((d, i) => ({
    x: PL + (i / (data.length - 1)) * cw,
    y: PT + ch - ((d - min) / rng) * ch,
    val: d,
  }));
}

function pointsToPath(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function makeArea(pts) {
  const linePath = pointsToPath(pts);
  const lastX = pts[pts.length - 1].x.toFixed(1);
  const firstX = pts[0].x.toFixed(1);
  const bot = (H_LINE - PB).toFixed(1);
  return `${linePath} L${lastX},${bot} L${firstX},${bot} Z`;
}

/* ── TOOLTIP ── */
function Tooltip({ data }) {
  if (!data) return null;
  const left = Math.min(data.x + 14, innerWidth - 175);
  const top  = Math.max(data.y - 60, 8);
  return ReactDOM.createPortal(
    <div className="db-tooltip" style={{ left, top }}>
      <div className="db-tt-title">{data.label}</div>
      {data.rows.map(r => (
        <div key={r.key} className="db-tt-row">
          <span className="db-tt-key">
            <span className="db-tt-swatch" style={{ background: r.color }}></span>
            {r.key}
          </span>
          <span className="db-tt-val">{r.val}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ── ANIMATED NUMBER ── */
function AnimNum({ target, prefix = '€', animKey }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    setVal(0);
    let raf, t0;
    const dur = 1100;
    const step = now => {
      if (!t0) t0 = now;
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(e * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animKey]);
  return <span>{fmtVal(val, prefix)}</span>;
}

/* ── MINI SPARKLINE (inside KPI card) ── */
function MiniSpark({ data, color }) {
  const h = 30, w = 80;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / (max - min || 1)) * h * .85 - 2,
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/* ── KPI CARD ── */
const SPARK_DATA = {
  ggr:      [62,68,72,78,74,84,79,88,92,95],
  deposits: [44,52,58,55,64,70,67,73,78,82],
  turnover: [80,76,72,74,70,68,65,64,62,60],
  ftds:     [30,38,44,40,52,58,54,66,72,80],
};

const KPI_ICONS = {
  ggr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  deposits: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  turnover: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  ftds: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

function KPICard({ kpi, animKey, period }) {
  const cc = CARD_COLORS[kpi.id];
  const change = parseFloat(pct(kpi.val, kpi.prev));
  const up = change >= 0;
  const [hov, setHov] = useState(false);

  const handleMove = useCallback(e => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2) / (r.width/2);
    const dy = (e.clientY - r.top - r.height/2) / (r.height/2);
    el.style.transform = `perspective(900px) rotateY(${dx*7}deg) rotateX(${-dy*7}deg) translateZ(8px)`;
    el.style.transition = 'transform .07s ease, box-shadow .2s';
    el.style.boxShadow = `${-dx*10}px ${-dy*10}px 30px ${cc.glow}.12)`;
  }, [cc]);

  const handleLeave = useCallback(e => {
    const el = e.currentTarget;
    el.style.transition = 'transform .5s ease, box-shadow .5s';
    el.style.transform = '';
    el.style.boxShadow = '';
  }, []);

  return (
    <div
      className="db-card db-enter"
      style={{ background: cc.bg, borderColor: hov ? cc.main : cc.border, cursor: 'default' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={e => { setHov(false); handleLeave(e); }}
      onMouseMove={handleMove}
    >
      {/* subtle glow top edge */}
      <div style={{ position:'absolute', top:0, left:'20%', right:'20%', height:'1px', background:`linear-gradient(90deg,transparent,${cc.main},transparent)`, opacity: hov ? .8 : .35, transition:'opacity .3s' }} />

      <div className="db-card-icon" style={{ background: `${cc.glow}.15)`, color: cc.main }}>
        {KPI_ICONS[kpi.id]}
      </div>
      <div className="db-card-label">{kpi.label}</div>
      <div className="db-card-value" style={{ color: cc.main, textShadow: hov ? `0 0 20px ${cc.glow}.5)` : 'none', transition:'text-shadow .3s' }}>
        <AnimNum target={kpi.val} prefix={kpi.pfx} animKey={animKey} />
      </div>
      <div className="db-card-footer">
        <span className={`db-badge ${up ? 'up' : 'dn'}`}>
          {up ? '▲' : '▼'} {Math.abs(change)}%
        </span>
        <MiniSpark data={SPARK_DATA[kpi.id]} color={cc.main} />
      </div>
      <div className="db-period-label" style={{ marginTop: '6px' }}>vs previous {period}</div>
    </div>
  );
}

/* ── LINE CHART ── */
function LineChart({ lineData, animKey, setTooltip }) {
  const svgRef = useRef(null);
  const [W_LINE, setW] = useState(W_LINE_MAX);
  useLayoutEffect(() => {
    const el = svgRef.current; if (!el) return;
    // The SVG is width:100%, so its rendered width does not depend on the viewBox.
    const measure = () => { const w = el.getBoundingClientRect().width; if (w) setW(Math.round(Math.max(W_LINE_MIN, Math.min(W_LINE_MAX, w)))); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [lineKey, setLineKey] = useState(0);

  useEffect(() => {
    setLineKey(k => k + 1);
    setHoverIdx(null);
  }, [animKey]);

  const ggrPts  = makeLinePts(lineData.ggr, W_LINE);
  const depPts  = makeLinePts(lineData.dep, W_LINE);
  const labels  = lineData.labels;
  const chartW  = W_LINE - PL - PR;

  const xForIdx = i => PL + (i / (labels.length - 1)) * chartW;

  const handleMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX  = ((e.clientX - rect.left) / rect.width) * W_LINE;
    const rawI  = (svgX - PL) / chartW * (labels.length - 1);
    const idx   = Math.max(0, Math.min(labels.length - 1, Math.round(rawI)));
    setHoverIdx(idx);
    setTooltip({
      x: e.clientX, y: e.clientY,
      label: labels[idx],
      rows: [
        { key: 'GGR',      color: C.cyan,   val: fmtVal(lineData.ggr[idx], '€') },
        { key: 'Deposits', color: C.purple,  val: fmtVal(lineData.dep[idx], '€') },
      ],
    });
  };

  /* Y-axis ticks */
  const maxGGR = Math.max(...lineData.ggr);
  const ticks = [0, .25, .5, .75, 1].map(f => ({
    y: PT + (H_LINE - PT - PB) * (1 - f),
    label: fmtVal(Math.round(maxGGR * f), '€'),
  }));

  const ggrId  = `gg-${lineKey}`;
  const depId  = `dd-${lineKey}`;
  const ggrAreaId = `ga-${lineKey}`;
  const depAreaId = `da-${lineKey}`;

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <div className="db-chart-title">Revenue Overview</div>
          <div className="db-chart-sub">GGR &amp; Deposits trend</div>
        </div>
        <div className="db-legend">
          <div className="db-leg"><div className="db-leg-dot" style={{ background: C.cyan }}></div>GGR</div>
          <div className="db-leg"><div className="db-leg-dot" style={{ background: C.purple }}></div>Deposits</div>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="db-chart-svg"
        viewBox={`0 0 ${W_LINE} ${H_LINE}`}
        onMouseMove={handleMove}
        onMouseLeave={() => { setHoverIdx(null); setTooltip(null); }}
      >
        <defs>
          <linearGradient id={ggrAreaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.cyan} stopOpacity=".18" />
            <stop offset="100%" stopColor={C.cyan} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={depAreaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.purple} stopOpacity=".14" />
            <stop offset="100%" stopColor={C.purple} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={PL} y1={tk.y} x2={W_LINE - PR} y2={tk.y} stroke="rgba(255,255,255,.05)" strokeWidth="1" />
            <text x={PL - 6} y={tk.y + 4} className="db-axis-text" textAnchor="end">{tk.label}</text>
          </g>
        ))}

        {/* x-axis labels */}
        {labels.map((l, i) => (
          <text key={i} x={xForIdx(i)} y={H_LINE - 6} className="db-axis-text" textAnchor="middle">{l}</text>
        ))}

        {/* deposit area + line */}
        <path d={makeArea(depPts)}  fill={`url(#${depAreaId})`} />
        <path key={`dep-${lineKey}`} d={pointsToPath(depPts)} fill="none" stroke={C.purple} strokeWidth="1.8" className="db-line-anim" />

        {/* GGR area + line */}
        <path d={makeArea(ggrPts)}  fill={`url(#${ggrAreaId})`} />
        <path key={`ggr-${lineKey}`} d={pointsToPath(ggrPts)} fill="none" stroke={C.cyan} strokeWidth="2" className="db-line-anim" style={{ animationDelay:'.1s' }} />

        {/* crosshair + dots */}
        {hoverIdx !== null && (() => {
          const x = xForIdx(hoverIdx);
          return (
            <g>
              <line x1={x} y1={PT} x2={x} y2={H_LINE - PB} className="db-crosshair" />
              <circle cx={x} cy={ggrPts[hoverIdx].y} r="5" fill={C.cyan} stroke="rgba(10,10,20,.8)" strokeWidth="2" />
              <circle cx={x} cy={depPts[hoverIdx].y} r="5" fill={C.purple} stroke="rgba(10,10,20,.8)" strokeWidth="2" />
            </g>
          );
        })()}

        {/* invisible hover zone */}
        <rect x={PL} y={PT} width={W_LINE - PL - PR} height={H_LINE - PT - PB} fill="transparent" />
      </svg>
    </div>
  );
}

/* ── MARKET BAR CHART ── */
const W_BAR = 300, H_BAR = 240;
const BPL = 68, BPR = 46, BPT = 16, BPB = 14;

function MarketChart({ barData, period, setTooltip }) {
  const [hoverI, setHoverI] = useState(null);
  const max    = Math.max(...barData.values);
  const total  = barData.values.reduce((a, b) => a + b, 0);
  const rowH   = (H_BAR - BPT - BPB) / barData.values.length;
  const barMaxW = W_BAR - BPL - BPR;

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <div className="db-chart-title">FTDs by Market</div>
          <div className="db-chart-sub">First Time Depositors per region</div>
        </div>
      </div>
      <svg className="db-chart-svg" viewBox={`0 0 ${W_BAR} ${H_BAR}`}
        onMouseLeave={() => { setHoverI(null); setTooltip(null); }}
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.purple} />
          </linearGradient>
        </defs>

        {barData.values.map((v, i) => {
          const y    = BPT + i * rowH;
          const barW = (v / max) * barMaxW;
          const pctShare = ((v / total) * 100).toFixed(1);
          const isHov = hoverI === i;

          return (
            <g key={i}
              onMouseEnter={e => { setHoverI(i); setTooltip({ x: e.clientX, y: e.clientY, label: MARKETS[i], rows: [{ key:'FTDs', color:C.cyan, val: v.toLocaleString() }, { key:'Share', color:C.green, val: `${pctShare}%` }] }); }}
              onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
              style={{ cursor: 'pointer' }}
            >
              {/* bg track */}
              <rect x={BPL} y={y + 4} width={barMaxW} height={rowH - 8} rx="3" fill="rgba(255,255,255,.04)" />
              {/* fill bar */}
              <rect x={BPL} y={y + 4} width={isHov ? barW + 4 : barW} height={rowH - 8} rx="3"
                fill={isHov ? C.cyan : 'url(#barGrad)'}
                opacity={isHov ? 1 : .8}
                style={{ transition:'width .2s ease, opacity .2s' }}
              />
              {/* glow on hover */}
              {isHov && <rect x={BPL} y={y + 4} width={barW} height={rowH - 8} rx="3" fill={C.cyan} opacity=".12" filter="blur(4px)" />}
              {/* label */}
              <text x={BPL - 6} y={y + rowH/2 + 4} className="db-bar-label" textAnchor="end" fill={isHov ? C.cyan : undefined}>{MKT_SHORT[i]}</text>
              {/* value */}
              <text x={BPL + barW + 8} y={y + rowH/2 + 4} className="db-bar-val" fill={isHov ? '#fff' : undefined}>{v}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── ROOT DASHBOARD ── */
function Dashboard() {
  const [period, setPeriod]   = useState('7D');
  const [animKey, setAnimKey] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: .1 });
    if (rootRef.current) obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  const changePeriod = p => { setPeriod(p); setAnimKey(k => k + 1); };
  const data = DB[period];

  return (
    <div ref={rootRef} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)', transition: 'opacity .7s ease, transform .7s ease' }}>

      {/* Tooltip portal */}
      <Tooltip data={tooltip} />

      {/* Filter tabs */}
      <div className="db-filter">
        {['Today','7D','30D','90D'].map(p => (
          <button key={p} className={`db-tab${period === p ? ' active' : ''}`} onClick={() => changePeriod(p)}>{p}</button>
        ))}      </div>

      {/* KPI Cards */}
      <div className="db-kpi-grid">
        {data.kpis.map(kpi => <KPICard key={kpi.id} kpi={kpi} animKey={animKey} period={period} />)}
      </div>

      {/* Charts */}
      <div className="db-charts-grid">
        <LineChart   lineData={data.line} animKey={animKey} setTooltip={setTooltip} />
        <MarketChart barData={data.bar}   period={period}   setTooltip={setTooltip} />
      </div>

    </div>
  );
}

/* ── MOUNT ── */
const dbRoot = ReactDOM.createRoot(document.getElementById('db-root'));
dbRoot.render(<Dashboard />);
