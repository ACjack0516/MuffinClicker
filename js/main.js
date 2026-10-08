// Wires state, economy, save and ui together and runs the game loop.
import { state } from './state.js';
import { click, tick, buyGenerators, sellGenerators, buyUpgrade } from './economy.js';
import { loadGame, saveGame, wipeGame, startAutosave, exportSave, importSave } from './save.js';
import { initUI, buildUpgrades, render, floatText, formatNumber, message } from './ui.js';

const earnedOffline = loadGame();
if (earnedOffline >= 1) console.log(`Welcome back! Your bakers made ${formatNumber(earnedOffline)} muffins while you were away.`);

initUI({
    onClick(x, y) {
        floatText(`+${formatNumber(click())}`, x, y);
        render();
    },
    onRename(name) { state.bakeryName = name; saveGame(); render(); },
    onGenerator(id, mode, qty) {
        const ok = mode === 'buy' ? buyGenerators(id, qty) : sellGenerators(id, qty);
        if (ok) { render(); saveGame(); }
    },
    onUpgrade(id) {
        if (buyUpgrade(id)) { buildUpgrades(); render(); saveGame(); }
    },
    onAction(action, box) {
        if (action === 'save') { saveGame(); message('Game saved.'); }
        else if (action === 'export') { box.value = exportSave(); box.select(); message('Copy this text to back up your save.'); }
        else if (action === 'import') {
            if (importSave(box.value)) { buildUpgrades(); render(); message('Save imported.'); }
            else message('That save could not be read.');
        } else if (action === 'wipe' && confirm('Wipe all progress? This cannot be undone.')) {
            wipeGame(); buildUpgrades(); render(); message('Save wiped.');
        }
    },
});

startAutosave();

let last = performance.now();
function loop(now) {
    tick(Math.min((now - last) / 1000, 1)); // clamp so a stalled tab doesn't jump
    last = now;
    render(now);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);