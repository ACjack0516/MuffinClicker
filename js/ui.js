// DOM only. Reads state, never changes it.
import { state } from './state.js';
import { fetchBoard } from './leaderboard.js';
import {
    GENERATORS, UPGRADES, owned, hasUpgrade, bulkCost, sellValue, getCps, getClickPower,
    getMuffinImage, getCursorSkin,
} from './economy.js';

const $ = (id) => document.getElementById(id);
const ICON = { oven: '🔥', baker: '🧑‍🍳', bakery: '🥐', factory: '🏭', chocchip: '🍫', butter: '🧈', turbo: '🧤', cursor2: '🖱️', blueberry: '🫐' };
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
const ui = { mode: 'buy', qty: 1, view: 'bakery' };
const els = {};
let handlers, rowsSig = '', lastStats = 0, cursorKey = '';

// Cursor hotspots: the pixel (x y) of the shrunken cursor image that counts as the click point.
const CURSOR_HOTSPOT = '0 0';
const HOVER_HOTSPOT = '0 0';

// Image icon for a building or upgrade. Cursor upgrades use their hover image.
// If the file is missing, the emoji fallback is shown instead.
const icon = (item) => {
    const fallback = ICON[item.id] ?? '❓';
    const src = item.img ?? item.hoverImg;
    return src ? `<img src="${src}" alt="" draggable="false" data-fallback="${fallback}">` : fallback;
};
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.fallback) img.replaceWith(img.dataset.fallback);
}, true);

// Browsers silently ignore cursor images over 128x128 (and hide ones over 32x32 near the window edge),
// so every cursor image is shrunk to CURSOR_SIZE first, whatever size the original file is.
const CURSOR_SIZE = 32; // longest side in px; raise to 48 or 64 for a bigger cursor
function sizedCursor(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, CURSOR_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(src);
            }
        };
        img.onerror = () => { console.warn(`Cursor image not found: ${src}`); resolve(src); };
        img.src = src;
    });
}

// Writes the page-wide cursor rules. Only does work when the skin changes.
function applyCursor() {
    const { cursor, hover } = getCursorSkin();
    const key = cursor + hover;
    if (key === cursorKey) return;
    cursorKey = key;
    Promise.all([sizedCursor(cursor), sizedCursor(hover)]).then(([c, h]) => {
        if (key !== cursorKey) return; // skin changed again while loading
        let tag = $('cursor-style');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cursor-style';
            document.head.appendChild(tag);
        }
        const normal = `url("${c}") ${CURSOR_HOTSPOT}, auto`;
        tag.textContent = `
            html, body, button:disabled { cursor: ${normal}; }
            button:not(:disabled) { cursor: url("${h}") ${HOVER_HOTSPOT}, pointer; }
            textarea { cursor: text; }`;
    });
}

export function formatNumber(n) {
    if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
    const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
    return (n / 1000 ** tier).toFixed(2) + SUFFIXES[tier];
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24;
    const m = Math.floor(s / 60) % 60;
    return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`, `${s % 60}s`].filter(Boolean).join(' ');
}

export function initUI(h) {
    handlers = h;
    for (const id of ['muffin-count', 'cps', 'click-power', 'muffin-btn', 'muffin-img', 'generators',
        'upgrades', 'main-view', 'bakery-name', 'news']) els[id] = $(id);

    els['muffin-btn'].addEventListener('click', (e) => h.onClick(e.clientX, e.clientY));
    els['bakery-name'].addEventListener('click', () => {
        const name = prompt('Name your baker:', state.bakeryName);
        if (name?.trim()) h.onRename(name.trim().slice(0, 28));
    });
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
        setView(ui.view === b.dataset.view ? 'bakery' : b.dataset.view);
    }));
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { ui.mode = b.dataset.mode; syncToggles(); }));
    document.querySelectorAll('[data-qty]').forEach((b) => b.addEventListener('click', () => { ui.qty = +b.dataset.qty; syncToggles(); }));
    els.generators.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (b) h.onGenerator(b.dataset.id, ui.mode, ui.qty);
    });
    els.upgrades.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (b) h.onUpgrade(b.dataset.id);
    });
    els['main-view'].addEventListener('click', (e) => {
        const t = e.target.closest('[data-board]');
        if (t) return loadBoard(t.dataset.board);
        const a = e.target.closest('[data-action]');
        if (a) h.onAction(a.dataset.action, $('save-text'));
    });

    els.generators.innerHTML = GENERATORS.map((g) => `
        <button class="shop-item" data-id="${g.id}">
            <span class="shop-icon">${icon(g)}</span>
            <span class="shop-name"></span><span class="shop-owned"></span>
            <span class="shop-cost"></span>
        </button>`).join('');
    buildUpgrades();
    syncToggles();
    setView('bakery');
    showNews();
    setInterval(showNews, 9000);
}

function syncToggles() {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === ui.mode));
    document.querySelectorAll('[data-qty]').forEach((b) => b.classList.toggle('on', +b.dataset.qty === ui.qty));
}

export function buildUpgrades() {
    els.upgrades.innerHTML = UPGRADES.filter((u) => !hasUpgrade(u.id)).map((u) =>
        `<button class="upgrade" data-id="${u.id}" title="${u.name} (${formatNumber(u.cost)} muffins)\n${u.desc}">${icon(u)}</button>`
    ).join('');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOARD_FORMAT = {
    muffins: (v) => formatNumber(v),
    clicks: (v) => Number(v).toLocaleString(),
    playtime: (v) => formatTime(v * 1000),
};
let lbBoard = 'muffins';

async function loadBoard(board) {
    lbBoard = board;
    els['main-view'].querySelectorAll('[data-board]').forEach((b) => b.classList.toggle('on', b.dataset.board === board));
    const body = $('lb-body');
    body.textContent = 'Loading...';
    const res = await fetchBoard(board);
    if (ui.view !== 'leaderboard' || lbBoard !== board) return; // user moved on while loading
    if (!res.ok) body.innerHTML = `<p class="empty">${esc(res.error)}</p>`;
    else if (!res.rows.length) body.innerHTML = '<p class="empty">No scores yet. Be the first! (Options > Save score)</p>';
    else body.innerHTML = `<ol class="lb">${res.rows.map((r) =>
        `<li><span class="lb-name">${esc(r.name)}</span><span class="lb-val">${BOARD_FORMAT[board](r.value)}</span></li>`).join('')}</ol>`;
}

function setView(view) {
    ui.view = view;
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    rowsSig = '';
    const v = els['main-view'];
    v.innerHTML = ''; // the bakery view draws nothing until you own a building
    if (view === 'options') {
        v.innerHTML = `<h2>Options</h2>
            <div class="actions">
                <button data-action="score">Save score</button>
                <button data-action="save">Save now</button>
                <button data-action="export">Export save</button>
                <button data-action="import">Import save</button>
                <button data-action="wipe" class="danger">Wipe save</button>
            </div>
            <textarea id="save-text" rows="6" placeholder="Export fills this box. To import, paste a save here and press Import."></textarea>
            <p id="opt-msg" class="msg" role="status"></p>`;
    } else if (view === 'info') {
        v.innerHTML = `<h2>Info</h2><p>Click the muffin to bake. Spend muffins on ovens, bakers and more to bake automatically.</p>
            <p>Your game saves in this browser every few seconds. Export a save to back it up or move it to another device.</p>
            <p>Selling a building returns 25% of what its last copy cost.</p>`;
    } else if (view === 'stats') {
        renderStats();
    } else if (view === 'leaderboard') {
        v.innerHTML = `<h2>Leaderboard</h2>
            <div class="actions">
                <button data-board="muffins">Muffins baked</button>
                <button data-board="clicks">Clicks</button>
                <button data-board="playtime">Playtime</button>
            </div>
            <div id="lb-body"></div>`;
        loadBoard(lbBoard);
    }
}

export function message(text) {
    const el = $('opt-msg');
    if (el) el.textContent = text;
}

function renderStats() {
    const rows = [
        ['Muffins in bank', Math.floor(state.muffins).toLocaleString()],
        ['Muffins baked (all time)', Math.floor(state.totalBaked).toLocaleString()],
        ['Muffins baked by clicking', Math.floor(state.clickBaked).toLocaleString()],
        ['Muffins per second', formatNumber(getCps())],
        ['Muffins per click', formatNumber(getClickPower())],
        ['Total clicks', state.totalClicks.toLocaleString()],
        ['Buildings owned', GENERATORS.reduce((s, g) => s + owned(g.id), 0).toLocaleString()],
        ['Recipes unlocked', `${UPGRADES.filter((u) => hasUpgrade(u.id)).length} / ${UPGRADES.length}`],
        ['Bakery opened', new Date(state.startedAt).toLocaleString()],
        ['Time played', formatTime(state.playTime * 1000)],
    ];
    els['main-view'].innerHTML = `<h2>Stats</h2><dl class="stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function renderRows() {
    const have = GENERATORS.filter((g) => owned(g.id) > 0);
    const sig = have.map((g) => g.id + owned(g.id)).join();
    if (sig === rowsSig) return;
    rowsSig = sig;
    els['main-view'].innerHTML = have.length
        ? have.map((g) => `<div class="row"><b>${g.name}</b><span class="row-items">${icon(g).repeat(Math.min(owned(g.id), 40))}</span><span class="row-n">${owned(g.id)}</span></div>`).join('')
        : '<p class="empty">Your bakery floor is empty. Bake some muffins and buy an Oven.</p>';
}

// Per-frame update: text and states only, so buttons are never replaced under the cursor.
export function render(now = performance.now()) {
    els['muffin-count'].textContent = formatNumber(state.muffins);
    els.cps.textContent = formatNumber(getCps());
    els['click-power'].textContent = formatNumber(getClickPower());
    els['bakery-name'].textContent = `${state.bakeryName}'s bakery`;
    const muffin = getMuffinImage();
    if (els['muffin-img'].getAttribute('src') !== muffin) els['muffin-img'].src = muffin;
    applyCursor();
    document.title = `${formatNumber(state.muffins)} muffins - ${state.bakeryName}'s bakery`;

    let hidden = 0;
    for (const g of GENERATORS) {
        const el = els.generators.querySelector(`[data-id="${g.id}"]`);
        const n = owned(g.id);
        const revealed = n > 0 || state.totalBaked >= g.baseCost * 0.5;
        el.hidden = !revealed && hidden++ >= 2;
        el.classList.toggle('mystery', !revealed);
        const cost = ui.mode === 'buy' ? bulkCost(g.id, ui.qty) : sellValue(g.id, ui.qty);
        el.disabled = !revealed || (ui.mode === 'buy' ? state.muffins < cost : n < 1);
        el.querySelector('.shop-name').textContent = revealed ? g.name : '???';
        el.querySelector('.shop-owned').textContent = n || '';
        el.querySelector('.shop-cost').textContent = (ui.mode === 'sell' && n ? '+' : '') + formatNumber(cost);
    }
    for (const b of els.upgrades.children) {
        b.classList.toggle('locked', state.muffins < UPGRADES.find((u) => u.id === b.dataset.id).cost);
    }
    if (ui.view === 'bakery') renderRows();
    else if (ui.view === 'stats' && now - lastStats > 500) { lastStats = now; renderStats(); }
}

function showNews() {
    const lines = [
        'Local baker insists a muffin is just a cupcake with ambition.',
        'Scientists confirm the muffin top is the best part. Muffin bottoms demand a recount.',
        'Blueberry or chocolate chip? Town hall meeting ends in a draw.',
    ];
    if (state.totalBaked > 100) lines.push('Flour shortage rumors spread as muffin demand rises.');
    if (getCps() >= 1) lines.push('Neighbors report a warm glow and a lovely smell coming from your bakery.');
    if (owned('factory') > 0) lines.push('Factory whistle heard three towns over. Muffins have no comment.');
    els.news.textContent = `News: ${lines[Math.floor(Math.random() * lines.length)]}`;
}

export function floatText(text, x, y) {
    const el = document.createElement('span');
    el.className = 'float';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}