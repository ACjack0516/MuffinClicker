// Wires state, economy, save and ui together and runs the game loop.
import { state } from './state.js';
import { click, tick, buyGenerators, sellGenerators, buyUpgrade } from './economy.js';
import { loadGame, saveGame, wipeGame, startAutosave, exportSave, importSave } from './save.js';
import { startIntegrityWatch } from './integrity.js';
import { submitScore, savedName } from '../api/leaderboard.js';
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
        else if (action === 'score') submitScoreFlow();
        else if (action === 'export') { box.value = exportSave(); box.select(); message('Copy this text to back up your save.'); }
        else if (action === 'import') {
            if (importSave(box.value)) { buildUpgrades(); render(); message('Save imported.'); }
            else message('That save could not be read.');
        } else if (action === 'wipe' && confirm('Wipe all progress? This cannot be undone.')) {
            wipeGame(); buildUpgrades(); render(); message('Save wiped.');
        }
    },
});

async function submitScoreFlow() {
    if (state.tampered) {
        message("This save can't be submitted: the browser console was opened (or the save was imported), so its numbers can't be trusted. Wipe the save and start a new run to be eligible again.");
        return;
    }
    const name = prompt('Choose a name for the leaderboard (max 20 characters):', savedName());
    if (!name?.trim()) return;
    message('Saving score...');
    const res = await submitScore(name.trim().slice(0, 20));
    message(res.ok ? 'Score saved! Open the Leaderboard to see where you rank.' : res.error);
}

startIntegrityWatch(saveGame);
startAutosave();

let last = performance.now();
function loop(now) {
    tick(Math.min((now - last) / 1000, 1)); // clamp so a stalled tab doesn't jump
    last = now;
    render(now);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);