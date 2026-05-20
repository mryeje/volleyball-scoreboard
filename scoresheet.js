/**
 * scoresheet.js — Volleyball Canada Scoresheet Library
 *
 * Renders and updates the official VC scoresheet DOM in response to
 * game-state objects. Designed to run in its own window/iframe and
 * receive updates via postMessage from the manager app.
 *
 * Public API (on window.ScoresheetAPI):
 *   .init(containerEl)   — build the sheet DOM inside containerEl
 *   .update(state)       — re-render all dynamic cells from a state snapshot
 *   .getState()          — return the last applied state
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  //  CSS
  // ─────────────────────────────────────────────────────────────
  const CSS = `
    :root{--line:#222;--thin:1px;--thick:2px;}
    *{box-sizing:border-box;}
    body{margin:0;padding:8px;background:#222;display:flex;flex-direction:column;align-items:flex-start;}
    #sheet-scale-wrapper{transform-origin:top left;}
    #sheet-root{
      position:relative;width:1600px;height:1020px;
      background:#fff;border:2px solid #222;
      font-family:Arial,Helvetica,sans-serif;color:#111;
      overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.6);
    }
    #sheet-root *{box-sizing:border-box;}
    .s-box{position:absolute;border:1px solid var(--line);background:#fff;overflow:hidden;}

    /* ── header rows ── */
    .main-data{display:grid;grid-template-rows:30px 30px 32px 20px;font-size:11px;}
    .main-data .row{display:grid;align-items:stretch;border-bottom:1px solid var(--line);}
    .main-data .row:last-child{border-bottom:0;}
    .r1{grid-template-columns:155px 1fr 60px 110px 55px 90px;}
    .r2{grid-template-columns:80px 1fr 115px 90px 75px 120px;}
    .r3{grid-template-columns:80px 1fr 90px 1fr 90px 120px 120px;}
    .r4{grid-template-columns:90px repeat(8,1fr);}
    .s-cell{border-right:1px solid var(--line);position:relative;min-width:0;padding:3px 5px;display:flex;align-items:center;gap:4px;}
    .s-cell:last-child{border-right:0;}
    .s-label{font-weight:700;}
    .s-write{position:absolute;left:6px;right:6px;bottom:5px;border-bottom:1px solid #666;}
    .s-check{display:inline-block;width:12px;height:12px;border:1px solid #444;background:#fff;flex:0 0 auto;}

    /* ── title block ── */
    .title-block{display:grid;grid-template-columns:1fr 84px;height:100%;}
    .title-main{border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
    .title-main .line1,.title-main .line2{font-size:28px;font-weight:700;line-height:1.05;letter-spacing:1px;}
    .logo-box{display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:700;padding:8px;}
    .logo-mark{width:52px;height:52px;border:2px solid #555;border-radius:50%;margin:0 auto 4px;}

    /* ── service boxes ── */
    .svc-inner{display:grid;grid-template-columns:28px 1fr;width:100%;height:100%;}
    .svc-team-col{position:relative;border-right:1px solid var(--line);}
    .svc-team-col .vt{position:absolute;left:7px;bottom:10px;transform:rotate(-90deg);transform-origin:left bottom;white-space:nowrap;font-size:10px;font-weight:700;}
    .svc-right{display:grid;grid-template-rows:24px 24px 1fr 1fr;height:100%;}
    .svc-ord,.svc-start{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-bottom:1px solid var(--line);text-align:center;padding:2px 4px;}
    .svc-subs-area{display:grid;grid-template-columns:1fr 52px;border-bottom:1px solid var(--line);}
    .svc-subs-lbl{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border-right:1px solid var(--line);text-align:center;padding:2px 4px;}
    .svc-subs-mini{display:grid;grid-template-rows:1fr 1fr;}
    .svc-mini-t,.svc-mini-b{display:flex;align-items:center;justify-content:center;text-align:center;padding:1px 2px;font-size:8px;font-weight:700;line-height:1.1;border-bottom:1px solid var(--line);}
    .svc-mini-b{border-bottom:0;}
    .svc-rounds{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);}
    .svc-rounds-lbl{display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;line-height:1.1;text-align:center;padding:2px;border-right:1px solid var(--line);}
    .svc-rg{display:grid;grid-template-columns:1fr 1fr;font-size:9px;}
    .svc-rg>div{display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;padding:1px;text-align:center;border-left:1px solid var(--line);border-bottom:1px solid var(--line);}
    .svc-rg>div:nth-child(odd){border-left:0;}

    /* ── set boxes ── */
    .set-box{display:grid;grid-template-columns:34px 1fr 1fr;height:100%;}
    .set-label{writing-mode:vertical-rl;text-orientation:upright;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--line);background:#e9e9e9;font-size:17px;font-weight:700;letter-spacing:1px;}
    .set-side{display:grid;grid-template-rows:34px 24px 1fr 42px;border-right:1px solid var(--line);min-width:0;}
    .set-side:last-child{border-right:0;}
    .set-top{display:grid;grid-template-columns:96px 1fr 92px;border-bottom:1px solid var(--line);}
    .start-box{border-right:1px solid var(--line);padding:4px 6px;font-weight:700;font-size:9px;position:relative;line-height:1.0;}
    .time-mini{position:absolute;left:38px;bottom:2px;font-size:7px;font-weight:700;}
    .team-box{display:grid;grid-template-columns:52px 1fr 40px 20px;align-items:center;}
    .team-word{font-weight:700;font-size:9px;text-align:center;}
    .team-write{height:18px;border:1px solid var(--line);margin:0 4px;display:flex;align-items:center;padding:0 3px;font-size:9px;font-weight:700;color:#00008b;overflow:hidden;}
    .team-circle{width:34px;height:34px;border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;justify-self:center;}
    .sr-stack{display:grid;grid-template-rows:1fr 1fr;height:34px;}
    .sr-stack div{display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-left:0;border-bottom:0;font-size:9px;font-weight:700;}
    .sr-stack div:last-child{border-bottom:1px solid var(--line);}
    .points-title{border-left:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;}
    .roman{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--line);font-size:9px;font-weight:700;}
    .roman>div{border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;}
    .roman>div:last-child{border-right:0;}
    .set-mid{display:grid;grid-template-columns:1fr 92px;min-height:0;}
    .play-grid{display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(8,1fr);border-right:1px solid #777;}
    .play-grid>div{border-right:1px solid var(--line);border-bottom:1px solid #777;display:flex;align-items:center;justify-content:center;font-size:8px;position:relative;overflow:hidden;}
    .play-grid>div:nth-child(6n){border-right:0;}
    .set-pts-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(12,1fr);}
    .set-pts-grid>div{border-right:1px solid var(--line);border-bottom:1px solid #777;display:flex;align-items:center;justify-content:center;font-size:7px;}
    .set-pts-grid>div:nth-child(4n){border-right:0;}
    .set-bottom{display:grid;grid-template-columns:1fr 92px;border-top:1px solid var(--line);min-height:0;}
    .tbox{border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;text-align:center;font-size:9px;font-weight:700;line-height:1.05;flex-direction:column;gap:1px;padding:2px;}
    .libero-box{display:flex;align-items:center;padding-left:8px;font-size:9px;font-weight:700;}

    /* ── change side ── */
    .chg-side{display:grid;grid-template-columns:34px 1fr;height:100%;}
    .chg-lbl{writing-mode:vertical-rl;text-orientation:upright;display:flex;align-items:center;justify-content:center;border-right:1px solid var(--line);background:#f2f2f2;font-size:15px;font-weight:700;letter-spacing:2px;}
    .chg-content{display:grid;grid-template-columns:1fr 52px;height:100%;}
    .chg-main{display:grid;grid-template-rows:28px 24px 1fr;border-right:1px solid var(--line);min-width:0;}
    .chg-hdr{display:grid;grid-template-columns:60px 1fr;border-bottom:1px solid var(--line);font-size:8px;font-weight:700;}
    .chg-hdr>div{border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;text-align:center;padding:2px 3px;line-height:1.1;}
    .chg-hdr>div:last-child{border-right:0;}
    .chg-roman{display:grid;grid-template-columns:60px repeat(6,1fr);border-bottom:1px solid var(--line);font-size:9px;font-weight:700;}
    .chg-roman>div{border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;}
    .chg-roman>div:last-child{border-right:0;}
    .chg-rows{display:grid;grid-template-rows:repeat(8,1fr);}
    .chg-row{display:grid;grid-template-columns:60px repeat(6,1fr);border-bottom:1px solid var(--line);}
    .chg-row:last-child{border-bottom:0;}
    .chg-row>div{border-right:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:7px;}
    .chg-row>div:last-child{border-right:0;}
    .chg-pts{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(12,1fr);font-size:7px;}
    .chg-pts>div{border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;min-width:0;}
    .chg-pts>div:nth-child(2n){border-right:0;}

    /* ── teams/roster ── */
    .teams-sect{display:grid;grid-template-rows:28px 1fr 28px 28px 1fr;height:100%;font-size:10px;}
    .teams-head,.teams-libero2,.teams-leaders-title{display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--line);font-weight:700;}
    .players-grid{display:grid;grid-template-columns:36px 1fr 36px 1fr;}
    .players-grid div,.leaders-grid div,.sigs-grid div,.approval-grid div,.results-grid div,.sanction-grid div{border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;min-width:0;padding:2px 4px;text-align:center;font-size:9px;}
    .players-grid div:nth-child(4n),.leaders-grid div:nth-child(2n),.sigs-grid div:nth-child(2n),.results-grid div:nth-child(7n){border-right:0;}
    .leaders-grid{display:grid;grid-template-columns:1fr 1fr;}
    .sigs-title{height:24px;display:flex;align-items:center;justify-content:center;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-weight:700;font-size:10px;}
    .sigs-grid{display:grid;grid-template-columns:1fr 1fr;}

    /* ── bottom sections ── */
    .sanctions-sect{display:grid;grid-template-columns:34px 1fr;height:100%;}
    .sanctions-v{writing-mode:vertical-rl;text-orientation:upright;display:flex;align-items:center;justify-content:center;background:#f2f2f2;border-right:1px solid var(--line);font-size:14px;font-weight:700;}
    .sanction-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(13,1fr);font-size:9px;height:100%;}
    .remarks-sect{display:grid;grid-template-rows:24px 1fr;height:100%;}
    .remarks-title,.approval-title,.results-title{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:1px;border-bottom:1px solid var(--line);}
    .remark-lines{background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 18px,#777 18px,#777 19px);}
    .approval-sect{display:grid;grid-template-rows:24px 1fr;height:100%;}
    .approval-grid{display:grid;grid-template-columns:78px 1.2fr 0.7fr 1fr;grid-auto-rows:23px;font-size:10px;}
    .approval-grid div:nth-child(4n){border-right:0;}
    .results-sect{display:grid;grid-template-rows:24px 1fr 28px;height:100%;}
    .results-grid{display:grid;grid-template-columns:42px 28px 28px 1fr 28px 28px 42px;grid-auto-rows:22px;font-size:10px;}
    .winner-row{display:grid;grid-template-columns:1fr 70px;align-items:center;font-size:12px;font-weight:700;padding:0 8px;}

    /* ── written / scored marks ── */
    .written{color:#1a237e;font-weight:700;}

    /* Scored point: diagonal blue hatching, like a pen drawn across the cell */
    .pt-scored{
      background-color:#fff !important;
      background-image: repeating-linear-gradient(
        -45deg,
        rgba(30,100,210,0.55) 0px,
        rgba(30,100,210,0.55) 1.5px,
        transparent 1.5px,
        transparent 5px
      ) !important;
      color:#111;
    }

    /* Side-out cell: same hatching but slightly lighter (the server lost serve here) */
    .pt-sideout{
      background-color:#fff !important;
      background-image: repeating-linear-gradient(
        -45deg,
        rgba(30,100,210,0.35) 0px,
        rgba(30,100,210,0.35) 1.5px,
        transparent 1.5px,
        transparent 5px
      ) !important;
      color:#555;
      position:relative;
    }

    /* Circled final score */
    .pt-circled{
      background:#fff !important;
      color:#111;
    }
    .pt-circled-inner{
      display:inline-flex;align-items:center;justify-content:center;
      border:2px solid #c0392b;border-radius:50%;
      width:14px;height:14px;font-size:7px;font-weight:700;
      background:#fff;
    }

    /* Unused cells after set ends: X pattern (two diagonal lines) */
    .pt-unused{
      background-color:#fff !important;
      background-image:
        repeating-linear-gradient(
          45deg,
          rgba(180,0,0,0.25) 0px,
          rgba(180,0,0,0.25) 1px,
          transparent 1px,
          transparent 6px
        ),
        repeating-linear-gradient(
          -45deg,
          rgba(180,0,0,0.25) 0px,
          rgba(180,0,0,0.25) 1px,
          transparent 1px,
          transparent 6px
        ) !important;
      color:#ccc;
      font-size:6px !important;
    }
    .pg-player{font-weight:700;font-size:8px;color:#1a237e;}
    .pg-sub-in{font-weight:700;font-size:7px;color:#1a237e;}
    .pg-sub-score{font-size:6px;color:#555;}
    .pg-check{font-size:9px;color:#000;font-weight:700;}
    .pg-entry{font-size:7px;color:#888;}
    .pg-exit{font-size:7px;color:#222;font-weight:700;}
    .srv-cell{display:flex;flex-direction:column;justify-content:space-evenly;align-items:center;font-size:7px;padding:0 1px;}
    .to-marker{font-size:7px;font-weight:700;color:#c0392b;line-height:1;}
  `;

  // ─────────────────────────────────────────────────────────────
  //  INTERNAL STATE
  // ─────────────────────────────────────────────────────────────
  let _state = null;
  let _container = null;

  // ─────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function div(cls, html) { return el('div', cls, html); }
  function txt(node, text) { node.textContent = text || ''; }

  // ─────────────────────────────────────────────────────────────
  //  BUILD — one-time DOM construction
  // ─────────────────────────────────────────────────────────────
  function buildSheet(container) {
    _container = container;

    // Inject styles
    if (!document.getElementById('ss-styles')) {
      const style = document.createElement('style');
      style.id = 'ss-styles';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // Scale wrapper
    const wrapper = div('');
    wrapper.id = 'sheet-scale-wrapper';

    const root = div('');
    root.id = 'sheet-root';
    wrapper.appendChild(root);
    container.appendChild(wrapper);

    _buildHeader(root);
    _buildServiceBoxes(root);
    _buildSetBoxes(root);
    _buildChangeSide(root);
    _buildTeams(root);
    _buildBottom(root);

    _scaleSheet();
    window.addEventListener('resize', _scaleSheet);
  }

  function _scaleSheet() {
    const wrapper = document.getElementById('sheet-scale-wrapper');
    const root = document.getElementById('sheet-root');
    if (!wrapper || !root) return;
    // On mobile we allow horizontal scroll and only scale to fit width
    // On desktop we scale to fit both dimensions
    const isMobile = window.innerWidth < 800;
    const padding = 16;
    const availW = window.innerWidth - padding;
    const scale = isMobile
      ? availW / 1600                              // mobile: fit width, scroll vertically
      : Math.min(availW / 1600, (window.innerHeight - padding) / 1020);
    root.style.transform = 'scale(' + scale + ')';
    root.style.transformOrigin = 'top left';
    wrapper.style.width  = (1600 * scale) + 'px';
    wrapper.style.height = (1020 * scale) + 'px';
    // On mobile the sheet is taller than viewport — let body scroll
    document.body.style.overflowX = isMobile ? 'hidden' : 'auto';
    document.body.style.overflowY = 'auto';
  }

  // ── HEADER ──────────────────────────────────────────────────
  function _buildHeader(root) {
    const hdr = div('s-box main-data');
    hdr.style.cssText = 'left:0;top:0;width:970px;height:112px;';
    hdr.innerHTML = `
      <div class="row r1">
        <div class="s-cell s-label">Name of the Competition:</div>
        <div class="s-cell"><span id="sh-comp" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">Date</div>
        <div class="s-cell"><span id="sh-date" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">Time</div>
        <div class="s-cell"><span id="sh-time" class="written"></span><span class="s-write"></span></div>
      </div>
      <div class="row r2">
        <div class="s-cell s-label">City</div>
        <div class="s-cell"><span id="sh-city" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">Country Code:</div>
        <div class="s-cell"><span id="sh-country" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">Match N°</div>
        <div class="s-cell"><span id="sh-matchnum" class="written"></span><span class="s-write"></span></div>
      </div>
      <div class="row r3">
        <div class="s-cell s-label">Gym</div>
        <div class="s-cell"><span id="sh-gym" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">Pool/Phase</div>
        <div class="s-cell"><span id="sh-pool" class="written"></span><span class="s-write"></span></div>
        <div class="s-cell s-label">TEAMS</div>
        <div class="s-cell"><span id="sh-teamA-hdr" class="written"></span></div>
        <div class="s-cell"><span id="sh-teamB-hdr" class="written"></span></div>
      </div>
      <div class="row r4" style="font-size:9px;">
        <div class="s-cell s-label">Division:</div>
        <div class="s-cell">Men <span class="s-check"></span></div>
        <div class="s-cell">Women <span class="s-check"></span></div>
        <div class="s-cell">Masters/35+ <span class="s-check"></span></div>
        <div class="s-cell">21 U <span class="s-check"></span></div>
        <div class="s-cell">17 U <span class="s-check"></span></div>
        <div class="s-cell">15 U <span class="s-check"></span></div>
        <div class="s-cell">Senior <span class="s-check"></span></div>
        <div class="s-cell">18 U <span class="s-check"></span> 16 U <span class="s-check"></span></div>
      </div>`;
    root.appendChild(hdr);

    const title = div('s-box');
    title.style.cssText = 'left:980px;top:0;width:620px;height:110px;';
    title.innerHTML = `<div class="title-block">
      <div class="title-main"><div class="line1">VOLLEYBALL CANADA</div><div class="line2">SCORESHEET</div></div>
      <div class="logo-box"><div><div class="logo-mark"></div>VOLLEYBALL<br>CANADA</div></div>
    </div>`;
    root.appendChild(title);
  }

  // ── SERVICE BOXES ────────────────────────────────────────────
  const SVC_BOXES = [
    { id: 'svc-1', top: 167, rounds: ['1ˢᵗ','5ᵗʰ','2ⁿᵈ','6ᵗʰ','3ʳᵈ','7ᵗʰ','4ᵗʰ','8ᵗʰ'] },
    { id: 'svc-2', top: 363, rounds: ['1ˢᵗ','5ᵗʰ','2ⁿᵈ','6ᵗʰ','3ʳᵈ','7ᵗʰ','4ᵗʰ','8ᵗʰ'] },
    { id: 'svc-5', top: 574, rounds: ['1ˢᵗ','4ᵗʰ','2ⁿᵈ','5ᵗʰ','3ʳᵈ','6ᵗʰ','',''] },
  ];

  function _buildServiceBoxes(root) {
    SVC_BOXES.forEach(cfg => {
      const box = div('s-box');
      box.id = cfg.id;
      box.style.cssText = `left:0;top:${cfg.top}px;width:155px;height:152px;`;
      const rgCells = cfg.rounds.map(r => `<div>${r}</div>`).join('');
      box.innerHTML = `<div class="svc-inner">
        <div class="svc-team-col"><div class="vt">Team line-up</div></div>
        <div class="svc-right">
          <div class="svc-ord">Service order</div>
          <div class="svc-start">N° of Starting players</div>
          <div class="svc-subs-area">
            <div class="svc-subs-lbl">Substitutes</div>
            <div class="svc-subs-mini"><div class="svc-mini-t">N° of player</div><div class="svc-mini-b">Score at change</div></div>
          </div>
          <div class="svc-rounds">
            <div class="svc-rounds-lbl">Service<br>rounds</div>
            <div class="svc-rg" id="${cfg.id}-rg">${rgCells}</div>
          </div>
        </div>
      </div>`;
      root.appendChild(box);
    });
  }

  // ── SET BOXES ────────────────────────────────────────────────
  // Layout: sets 1+2 on row 1, sets 3+4 on row 2, set 5 row 3
  const SET_LAYOUT = [
    { s:1, left:155,  top:116,  w:708, h:194, teamA_circle:'A', teamB_circle:'B' },
    { s:2, left:879,  top:116,  w:708, h:194, teamA_circle:'B', teamB_circle:'A' },
    { s:3, left:155,  top:310,  w:708, h:194, teamA_circle:'A', teamB_circle:'B' },
    { s:4, left:879,  top:310,  w:708, h:194, teamA_circle:'B', teamB_circle:'A' },
    { s:5, left:155,  top:504,  w:708, h:222, teamA_circle:'A', teamB_circle:'B' },
  ];

  function _buildSetBoxes(root) {
    SET_LAYOUT.forEach(cfg => {
      const s = cfg.s;
      const box = div('s-box');
      box.id = `setbox-${s}`;
      box.style.cssText = `left:${cfg.left}px;top:${cfg.top}px;width:${cfg.w}px;height:${cfg.h}px;`;
      box.innerHTML = `<div class="set-box">
        <div class="set-label">SET ${s}</div>
        ${_buildSetSide(s,'A',cfg.teamA_circle)}
        ${_buildSetSide(s,'B',cfg.teamB_circle)}
      </div>`;
      root.appendChild(box);
    });
  }

  function _buildSetSide(s, t, circle) {
    // Play grid: 6 cols × 8 rows = 48 cells
    // Row 0: player numbers, Row 1: sub-in numbers, Row 2-3: colon dots / sub-score
    // Rows 4-7: service sequence entry/exit (4 service rounds)
    let pgCells = '';
    // Rows 0-1: player / sub rows
    for (let r=0; r<2; r++) {
      for (let c=0; c<6; c++) {
        pgCells += `<div id="pg-${s}-${t}-r${r}-c${c}"></div>`;
      }
    }
    // Rows 2-3: colon/sub-score rows
    for (let r=2; r<4; r++) {
      for (let c=0; c<6; c++) {
        pgCells += `<div id="pg-${s}-${t}-r${r}-c${c}" style="font-size:10px;font-weight:700;">:</div>`;
      }
    }
    // Rows 4-7: service sequence rows (4 rounds × 6 positions)
    for (let row=0; row<4; row++) {
      for (let col=0; col<6; col++) {
        pgCells += `<div class="srv-cell" id="srvrow-${s}-${t}-${row}-${col}">
          <span id="srvent-${s}-${t}-${row}-${col}" class="pg-entry"></span>
          <span id="srvex-${s}-${t}-${row}-${col}" class="pg-exit"></span>
        </div>`;
      }
    }

    // Points grid: 48 cells
    let ptsCells = '';
    for (let i=1; i<=48; i++) {
      ptsCells += `<div id="ptcell-${s}-${t}-${i}">${i}</div>`;
    }

    return `<div class="set-side" id="setside-${s}-${t}">
      <div class="set-top">
        <div class="start-box">START<br><span style="font-size:7px;">Time</span>
          <div class="time-mini">H&nbsp;&nbsp;&nbsp;Mn</div>
          <div id="sh-set${s}-time${t}" class="written" style="font-size:9px;margin-top:2px;"></div>
        </div>
        <div class="team-box">
          <div class="team-word">TEAM</div>
          <div class="team-write" id="sh-set${s}-team${t}"></div>
          <div class="team-circle">${circle}</div>
          <div class="sr-stack"><div>S</div><div>R</div></div>
        </div>
        <div class="points-title">POINTS</div>
      </div>
      <div class="roman"><div>I</div><div>II</div><div>III</div><div>IV</div><div>V</div><div>VI</div></div>
      <div class="set-mid">
        <div class="play-grid" id="pg-${s}-${t}">${pgCells}</div>
        <div class="set-pts-grid" id="pts-${s}-${t}">${ptsCells}</div>
      </div>
      <div class="set-bottom">
        <div class="tbox" id="tbox-${s}-${t}">
          <span class="to-marker">"T"</span><span id="to1-${s}-${t}">:</span>
          <span class="to-marker">"T"</span><span id="to2-${s}-${t}">:</span>
        </div>
        <div class="libero-box" id="lib-${s}-${t}">LIBERO #</div>
      </div>
    </div>`;
  }

  // ── CHANGE SIDE ──────────────────────────────────────────────
  function _buildChangeSide(root) {
    const box = div('s-box');
    box.style.cssText = 'left:876px;top:516px;width:279px;height:212px;';
    const chgRows = Array.from({length:8}, () =>
      `<div class="chg-row">${Array.from({length:7}, () => '<div></div>').join('')}</div>`
    ).join('');
    const ptsCells = [13,25,14,26,15,27,16,28,17,29,18,30,19,31,20,32,21,33,22,34,23,35,24,36]
      .map(n => `<div>${n}</div>`).join('');
    box.innerHTML = `<div class="chg-side">
      <div class="chg-lbl">CHANGE SIDE</div>
      <div class="chg-content">
        <div class="chg-main">
          <div class="chg-hdr"><div>TEAM</div><div>POINTS AT CHANGE</div></div>
          <div class="chg-roman"><div></div><div>I</div><div>II</div><div>III</div><div>IV</div><div>V</div><div>VI</div></div>
          <div class="chg-rows" id="chg-rows">${chgRows}</div>
        </div>
        <div style="display:grid;grid-template-rows:28px 24px 1fr;">
          <div style="border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;">POINTS</div>
          <div style="border-bottom:1px solid var(--line);"></div>
          <div class="chg-pts">${ptsCells}</div>
        </div>
      </div>
    </div>`;
    root.appendChild(box);
  }

  // ── TEAMS / ROSTER ───────────────────────────────────────────
  function _buildTeams(root) {
    const box = div('s-box');
    box.id = 'teams-box';
    box.style.cssText = 'left:1172px;top:512px;width:414px;height:491px;';
    // 13 player rows × 4 cols
    let rows = `<div class="s-bold">N°</div><div class="s-bold">NAME OF THE PLAYER</div>
                <div class="s-bold">N°</div><div class="s-bold">NAME OF THE PLAYER</div>`;
    for (let i=0;i<13;i++) {
      rows += `<div id="rA-num-${i}" class="written"></div><div id="rA-name-${i}"></div>
               <div id="rB-num-${i}" class="written"></div><div id="rB-name-${i}"></div>`;
    }
    box.innerHTML = `<div class="teams-sect">
      <div class="teams-head">TEAMS</div>
      <div class="players-grid" id="roster-grid">${rows}</div>
      <div class="teams-libero2">LIBERO PLAYER ("L")</div>
      <div class="teams-leaders-title">TEAM LEADERS</div>
      <div>
        <div class="leaders-grid">
          <div>C</div><div></div><div>AC</div><div></div><div>T</div><div></div><div>Med.</div><div></div>
        </div>
        <div class="sigs-title">SIGNATURES</div>
        <div class="sigs-grid">
          <div>Team Captain</div><div>Team Captain</div>
          <div>Coach</div><div>Coach</div>
        </div>
      </div>
    </div>`;
    root.appendChild(box);
  }

  // ── BOTTOM SECTIONS ──────────────────────────────────────────
  function _buildBottom(root) {
    // Sanctions
    const sanctions = div('s-box');
    sanctions.style.cssText = 'left:5px;top:737px;width:340px;height:273px;';
    const sgCells = ['W','P','E','D','(A)','SET','SCORE']
      .map(h=>`<div>${h}</div>`).join('') +
      Array.from({length:12*7}, ()=>'<div></div>').join('');
    sanctions.innerHTML = `<div class="sanctions-sect">
      <div class="sanctions-v">SANCTIONS</div>
      <div class="sanction-grid">${sgCells}</div>
    </div>`;
    root.appendChild(sanctions);

    // Remarks
    const remarks = div('s-box');
    remarks.style.cssText = 'left:349px;top:737px;width:513px;height:115px;';
    remarks.innerHTML = `<div class="remarks-sect">
      <div class="remarks-title">REMARKS</div>
      <div class="remark-lines" id="sh-remarks"></div>
    </div>`;
    root.appendChild(remarks);

    // Approval
    const approval = div('s-box');
    approval.style.cssText = 'left:354px;top:869px;width:511px;height:140px;';
    approval.innerHTML = `<div class="approval-sect">
      <div class="approval-title">APPROVAL</div>
      <div class="approval-grid">
        <div>Referees</div><div style="font-weight:700;">Name</div><div style="font-weight:700;">Country</div><div style="font-weight:700;">Signature</div>
        <div>1st</div><div></div><div></div><div></div>
        <div>2nd</div><div></div><div></div><div></div>
        <div>Scorer</div><div></div><div></div><div></div>
        <div>Asst Scorer</div><div></div><div></div><div></div>
      </div>
    </div>`;
    root.appendChild(approval);

    // Results
    const results = div('s-box');
    results.style.cssText = 'left:872px;top:737px;width:283px;height:273px;';
    const resRows = [1,2,3,4,5].map(i =>
      `<div id="res-A-set${i}" class="written"></div><div></div><div></div>
       <div>${i}</div>
       <div></div><div></div><div id="res-B-set${i}" class="written"></div>`
    ).join('');
    results.innerHTML = `<div class="results-sect">
      <div class="results-title">RESULTS</div>
      <div class="results-grid">
        <div>TEAM</div><div>S</div><div>W</div><div>SET SCORE</div><div>P</div><div>W</div><div>TEAM</div>
        <div id="res-teamA" class="written"></div><div id="res-setsA" class="written"></div><div></div>
        <div>1</div><div></div><div></div>
        <div id="res-teamB" class="written"></div>
        ${resRows}
      </div>
      <div class="winner-row"><div>WINNER</div><div id="res-winner" style="text-align:center;font-size:11px;"></div></div>
    </div>`;
    root.appendChild(results);
  }

  // ─────────────────────────────────────────────────────────────
  //  UPDATE — called whenever state changes
  // ─────────────────────────────────────────────────────────────
  function update(state) {
    _state = state;
    _updateHeader(state);
    _updateRoster(state);
    for (let s=1; s<=5; s++) {
      _updateSet(state, s);
    }
    _updateResults(state);
  }

  function _set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  // ── HEADER ──────────────────────────────────────────────────
  function _updateHeader(st) {
    _set('sh-comp',       st.competition || '');
    _set('sh-date',       st.matchDate || '');
    _set('sh-time',       st.startTime || '');
    _set('sh-city',       st.city || '');
    _set('sh-country',    st.country || '');
    _set('sh-matchnum',   st.matchNum || '');
    _set('sh-gym',        st.gym || '');
    _set('sh-pool',       st.pool || '');
    _set('sh-teamA-hdr',  st.teamA || '');
    _set('sh-teamB-hdr',  st.teamB || '');
  }

  // ── ROSTER ──────────────────────────────────────────────────
  function _updateRoster(st) {
    _set('res-teamA', st.teamA || '');
    _set('res-teamB', st.teamB || '');

    const rA = st.rosterA || [];
    const rB = st.rosterB || [];
    const max = Math.max(rA.length, rB.length, 1);
    for (let i=0; i<13; i++) {
      const pa = rA[i];
      const pb = rB[i];
      _set(`rA-num-${i}`,  pa ? pa.num  : '');
      _set(`rA-name-${i}`, pa ? pa.name : '');
      _set(`rB-num-${i}`,  pb ? pb.num  : '');
      _set(`rB-name-${i}`, pb ? pb.name : '');
    }
  }

  // ── SET ──────────────────────────────────────────────────────
  function _updateSet(st, s) {
    const sd = (st.sets && st.sets[s-1]) ? st.sets[s-1] : null;

    // Team name labels
    _set(`sh-set${s}-teamA`, st.teamA || '');
    _set(`sh-set${s}-teamB`, st.teamB || '');

    // Start time
    if (sd) {
      _set(`sh-set${s}-timeA`, sd.startTime || '');
      _set(`sh-set${s}-timeB`, sd.startTime || '');
    }

    // Libero
    const libA = document.getElementById(`lib-${s}-A`);
    const libB = document.getElementById(`lib-${s}-B`);
    if (libA) libA.textContent = st.liberoA ? `LIBERO # ${st.liberoA}` : 'LIBERO #';
    if (libB) libB.textContent = st.liberoB ? `LIBERO # ${st.liberoB}` : 'LIBERO #';

    if (!sd) return;

    // ── Lineup rows (row 0 = starting players) ────────────────
    const luA = sd.rotation && sd.rotation.A ? sd.rotation.A : (st.startingLineup ? st.startingLineup.A : []);
    const luB = sd.rotation && sd.rotation.B ? sd.rotation.B : (st.startingLineup ? st.startingLineup.B : []);
    for (let c=0; c<6; c++) {
      const cA = document.getElementById(`pg-${s}-A-r0-c${c}`);
      const cB = document.getElementById(`pg-${s}-B-r0-c${c}`);
      if (cA) { cA.textContent = luA[c] || ''; cA.className = luA[c] ? 'pg-player' : ''; }
      if (cB) { cB.textContent = luB[c] || ''; cB.className = luB[c] ? 'pg-player' : ''; }
    }

    // ── Substitutions (row 1 = sub-in, row 3 = score at change) ──
    _renderSubs(s, 'A', sd.subs ? sd.subs.A : []);
    _renderSubs(s, 'B', sd.subs ? sd.subs.B : []);

    // ── Service sequence ──────────────────────────────────────
    _renderServiceRounds(s, 'A', sd.serviceRounds || [], 'A');
    _renderServiceRounds(s, 'B', sd.serviceRounds || [], 'B');

    // ── Timeouts ──────────────────────────────────────────────
    _renderTimeouts(s, 'A', sd.timeouts ? sd.timeouts.A : []);
    _renderTimeouts(s, 'B', sd.timeouts ? sd.timeouts.B : []);

    // ── Points grid ───────────────────────────────────────────
    _renderPoints(s, 'A', sd.score ? sd.score.A : 0, sd.complete, sd.winner);
    _renderPoints(s, 'B', sd.score ? sd.score.B : 0, sd.complete, sd.winner);

    // ── Side-out marks ────────────────────────────────────────
    _renderSideouts(s, sd);
  }

  function _renderSubs(s, t, subs) {
    if (!subs) return;
    subs.forEach((sub, i) => {
      // Position column: each sub uses a column pair based on rotation slot
      // We fill sequentially into row 1 (sub-in) across the 6 columns
      const col = i % 6;
      const cIn = document.getElementById(`pg-${s}-${t}-r1-c${col}`);
      const cScore = document.getElementById(`pg-${s}-${t}-r3-c${col}`);
      if (cIn) { cIn.textContent = sub.in; cIn.className = 'pg-sub-in'; }
      if (cScore) {
        cScore.textContent = `${sub.scoreA}-${sub.scoreB}`;
        cScore.style.fontSize = '6px';
        cScore.style.color = '#555';
        cScore.style.fontWeight = '700';
      }
    });
  }

  function _renderServiceRounds(s, t, allRounds, team) {
    const rounds = allRounds.filter(r => r.team === team);
    rounds.forEach((r, rowIdx) => {
      if (rowIdx >= 4) return;
      // Column based on rotation position at time of serve
      const col = r.rotationIdx !== undefined ? r.rotationIdx % 6 : rowIdx % 6;
      const entEl = document.getElementById(`srvent-${s}-${t}-${rowIdx}-${col}`);
      const exEl  = document.getElementById(`srvex-${s}-${t}-${rowIdx}-${col}`);
      if (entEl) entEl.textContent = r.start !== undefined ? String(r.start) : '';
      if (exEl)  exEl.textContent  = r.end   !== undefined ? String(r.end)   : '';
    });
  }

  function _renderTimeouts(s, t, timeouts) {
    if (!timeouts) return;
    const to1 = document.getElementById(`to1-${s}-${t}`);
    const to2 = document.getElementById(`to2-${s}-${t}`);
    if (to1) to1.textContent = timeouts[0] ? ` ${timeouts[0].scoreA}–${timeouts[0].scoreB}` : ':';
    if (to2) to2.textContent = timeouts[1] ? ` ${timeouts[1].scoreA}–${timeouts[1].scoreB}` : ':';
  }

  function _renderPoints(s, t, score, complete, winner) {
    for (let i=1; i<=48; i++) {
      const cell = document.getElementById(`ptcell-${s}-${t}-${i}`);
      if (!cell) continue;
      cell.className = '';
      cell.innerHTML = String(i);
      if (i < score) {
        cell.className = 'pt-scored';
      } else if (i === score && complete) {
        cell.className = 'pt-circled';
        cell.innerHTML = `<span class="pt-circled-inner">${i}</span>`;
      } else if (i === score) {
        cell.className = 'pt-scored';
      } else if (complete && i > score) {
        cell.className = 'pt-unused';
      }
    }
  }

  function _renderSideouts(s, sd) {
    // Mark sideout slashes in the points grid for the team that lost service
    if (!sd.serviceRounds) return;
    sd.serviceRounds.forEach((r, idx) => {
      if (r.end === undefined) return;
      const team = r.team;
      // The exit score for the serving team is the last point they scored
      // before losing service — mark that cell with a slash
      const exitScore = r.end;
      if (exitScore > 0) {
        const cell = document.getElementById(`ptcell-${s}-${team}-${exitScore}`);
        if (cell && !cell.classList.contains('pt-circled')) {
          cell.classList.add('pt-sideout');
        }
      }
    });
  }

  // ── RESULTS ─────────────────────────────────────────────────
  function _updateResults(st) {
    _set('res-teamA', st.teamA || '');
    _set('res-teamB', st.teamB || '');
    _set('res-setsA', (st.setWins && st.setWins.A !== undefined) ? String(st.setWins.A) : '');

    if (st.sets) {
      st.sets.forEach((sd, i) => {
        const s = i + 1;
        if (sd.complete || sd.score.A > 0 || sd.score.B > 0) {
          _set(`res-A-set${s}`, String(sd.score.A));
          _set(`res-B-set${s}`, String(sd.score.B));
        }
      });
    }

    if (st.matchOver) {
      const winner = st.setWins && st.setWins.A > st.setWins.B ? st.teamA : st.teamB;
      _set('res-winner', winner);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────────────────────────────────────
  global.ScoresheetAPI = {
    init: buildSheet,
    update: update,
    getState: () => _state,
    _rescale: _scaleSheet,
  };

})(window);