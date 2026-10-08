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
        generators: { ...fresh.generators, ...(data?.generators ?? {}) },
        upgrades: { ...fresh.upgrades, ...(data?.upgrades ?? {}) },
    });
}

export function resetState() {
    Object.assign(state, createInitialState());
}