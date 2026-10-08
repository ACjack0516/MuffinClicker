// Single source of truth for everything that gets saved.
export const SAVE_VERSION = 1;

// Each run (new game or wipe) gets its own id, so each run is its own leaderboard entry.
const newRunId = () => crypto.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });

export function createInitialState() {
    return {
        version: SAVE_VERSION,
        muffins: 0,
        totalBaked: 0,
        totalClicks: 0,
        clickBaked: 0,
        bakeryName: 'Muffin Baker',
        startedAt: Date.now(),
        playTime: 0,      // seconds the game has been open and visible
        tampered: false,  // set when dev tools are detected; blocks leaderboard submission
        runId: newRunId(),  // identifies this run on the leaderboard
        scoreName: '',      // name this run was last submitted under
        generators: {}, // id -> count owned
        upgrades: {},   // id -> true when bought
        lastSaved: Date.now(),
    };
}

export const state = createInitialState();

// Replace the live state in place so every module keeps the same reference.
export function loadState(data) {
    const fresh = createInitialState();
    Object.assign(state, fresh, data, {
        // Older saves had no playTime: estimate it from when the bakery opened.
        playTime: data?.playTime ?? Math.max(0, (Date.now() - (data?.startedAt ?? Date.now())) / 1000),
        generators: { ...fresh.generators, ...(data?.generators ?? {}) },
        upgrades: { ...fresh.upgrades, ...(data?.upgrades ?? {}) },
    });
}

export function resetState() {
    Object.assign(state, createInitialState());
}