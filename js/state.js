// Single source of truth for everything that gets saved.
export const SAVE_VERSION = 1;

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