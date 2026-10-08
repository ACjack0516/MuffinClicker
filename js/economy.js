// All game rules and balance numbers live here.
import { state } from './state.js';

const COST_GROWTH = 1.15;

export const GENERATORS = [
    { id: 'oven',    name: 'Oven', img: 'assets/buildings/Oven.png', baseCost: 15,    cps: 0.1,  desc: 'A countertop oven, always warm.' },
    { id: 'baker',   name: 'Baker', img: 'assets/buildings/Baker.png', baseCost: 100,   cps: 1,    desc: 'Up before dawn, flour to the elbows.' },
    { id: 'bakery',  name: 'Bakery', img: 'assets/buildings/Bakery.png', baseCost: 1100,  cps: 8,    desc: 'A shopfront with a queue out the door.' },
    { id: 'factory', name: 'Muffin Factory', img: 'assets/buildings/Factory.png', baseCost: 12000, cps: 47,   desc: 'Conveyor belts of fresh muffins.' },
];

// Upgrade fields:
//   img        store icon (recipes). Cursor upgrades use their hoverImg as the icon instead.
//   muffinImg  swaps the big clickable muffin (the newest owned one wins; array order = priority)
//   cursorImg / hoverImg  swaps the player's cursor and hover cursor (newest owned wins)
export const UPGRADES = [
    { id: 'chocchip',  name: 'Choc Chip Recipe', cost: 100,  cpsMult: 2, img: 'assets/recipes/ChocRecipe.png',
      muffinImg: 'assets/muffins/Muff_ChocChip.png', desc: 'All muffin production 2×. Changes your muffin.' },
    { id: 'cursor2',   name: 'Better Cursor',    cost: 500,  clickMult: 2,
      cursorImg: 'assets/cursors/Cursor2.png', hoverImg: 'assets/cursors/Hover2.png', desc: 'Clicks are worth 2×. Changes your cursor.' },
    { id: 'blueberry', name: 'Blueberry Recipe', cost: 2500, cpsMult: 5, img: 'assets/recipes/BlueberryRecipe.png',
      muffinImg: 'assets/muffins/Muff_Blueberry.png', desc: 'All muffin production 5×. Changes your muffin.' },
];

const byId = (list, id) => list.find((item) => item.id === id);

export function owned(id) {
    return state.generators[id] ?? 0;
}

export function hasUpgrade(id) {
    return Boolean(state.upgrades[id]);
}

export function generatorCost(id) {
    const gen = byId(GENERATORS, id);
    return Math.ceil(gen.baseCost * COST_GROWTH ** owned(id));
}

export function getClickPower() {
    return UPGRADES.reduce(
        (power, up) => (hasUpgrade(up.id) && up.clickMult ? power * up.clickMult : power),
        1
    );
}

export function getCps() {
    const base = GENERATORS.reduce((sum, gen) => sum + gen.cps * owned(gen.id), 0);
    const mult = UPGRADES.reduce(
        (m, up) => (hasUpgrade(up.id) && up.cpsMult ? m * up.cpsMult : m),
        1
    );
    return base * mult;
}

export function addMuffins(amount) {
    state.muffins += amount;
    state.totalBaked += amount;
}

export function click() {
    const power = getClickPower();
    addMuffins(power);
    state.totalClicks += 1;
    state.clickBaked += power;
    return power;
}

export function tick(seconds) {
    addMuffins(getCps() * seconds);
    state.playTime += seconds;
}

export function buyGenerator(id) {
    const cost = generatorCost(id);
    if (state.muffins < cost) return false;
    state.muffins -= cost;
    state.generators[id] = owned(id) + 1;
    return true;
}

export function buyUpgrade(id) {
    const up = byId(UPGRADES, id);
    if (!up || hasUpgrade(id) || state.muffins < up.cost) return false;
    state.muffins -= up.cost;
    state.upgrades[id] = true;
    return true;
}

// ---- Bulk buy / sell ----
const SELL_RATIO = 0.25;

export function bulkCost(id, qty) {
    const g = byId(GENERATORS, id);
    const n = owned(id);
    let total = 0;
    for (let k = 0; k < qty; k++) total += Math.ceil(g.baseCost * COST_GROWTH ** (n + k));
    return total;
}

export function sellValue(id, qty) {
    const g = byId(GENERATORS, id);
    const n = owned(id);
    let total = 0;
    for (let k = 1; k <= Math.min(qty, n); k++) total += Math.ceil(g.baseCost * COST_GROWTH ** (n - k));
    return Math.floor(total * SELL_RATIO);
}

export function buyGenerators(id, qty) {
    const cost = bulkCost(id, qty);
    if (state.muffins < cost) return false;
    state.muffins -= cost;
    state.generators[id] = owned(id) + qty;
    return true;
}

export function sellGenerators(id, qty) {
    const q = Math.min(qty, owned(id));
    if (q < 1) return false;
    state.muffins += sellValue(id, q);
    state.generators[id] = owned(id) - q;
    return true;
}

// ---- Skins: which muffin / cursor to show ----
export const DEFAULT_MUFFIN = 'assets/muffins/Muff_Regular.png';
export const DEFAULT_CURSOR = { cursor: 'assets/cursors/Cursor1.png', hover: 'assets/cursors/Hover1.png' };

function latestOwned(key) {
    const list = UPGRADES.filter((u) => hasUpgrade(u.id) && u[key]);
    return list[list.length - 1];
}

export function getMuffinImage() {
    return latestOwned('muffinImg')?.muffinImg ?? DEFAULT_MUFFIN;
}

export function getCursorSkin() {
    const up = latestOwned('cursorImg');
    return up ? { cursor: up.cursorImg, hover: up.hoverImg } : DEFAULT_CURSOR;
}