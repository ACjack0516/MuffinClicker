// localStorage persistence.
import { state, loadState, resetState, SAVE_VERSION } from './state.js';
import { getCps, addMuffins } from './economy.js';

const SAVE_KEY = 'muffinClicker.save';
const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // cap offline earnings at 8 hours

export function saveGame() {
    try {
        state.lastSaved = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        return true;
    } catch (err) {
        console.warn('Could not save game:', err);
        return false;
    }
}

// Returns the number of muffins earned while away (0 if none).
export function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return 0;
        const data = JSON.parse(raw);
        if (data.version !== SAVE_VERSION) {
            // Add migrations here when the save format changes.
        }
        loadState(data);

        const awaySeconds = Math.min((Date.now() - state.lastSaved) / 1000, MAX_OFFLINE_SECONDS);
        const before = state.muffins;
        if (awaySeconds > 1) addMuffins(getCps() * awaySeconds);
        return state.muffins - before;
    } catch (err) {
        console.warn('Could not load save, starting fresh:', err);
        return 0;
    }
}

export function wipeGame() {
    localStorage.removeItem(SAVE_KEY);
    resetState();
}

export function startAutosave(intervalMs = 10000) {
    setInterval(saveGame, intervalMs);
    window.addEventListener('beforeunload', saveGame);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) saveGame();
    });
}

// ---- Export / import (base64 text) ----
export function exportSave() {
    saveGame();
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text) {
    try {
        const data = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
        if (typeof data.muffins !== 'number') return false;
        loadState(data);
        saveGame();
        return true;
    } catch {
        return false;
    }
}