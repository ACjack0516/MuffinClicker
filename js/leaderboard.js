// Talks to the /api/leaderboard serverless function. No accounts: each browser gets a random
// private player id, which is how a returning player updates their own row.
import { state } from './state.js';

const ID_KEY = 'muffinClicker.playerId';
const NAME_KEY = 'muffinClicker.leaderboardName';

function playerId() {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(ID_KEY, id);
    }
    return id;
}

export const savedName = () => localStorage.getItem(NAME_KEY) ?? '';

async function call(url, options) {
    try {
        const res = await fetch(url, options);
        if (res.status === 404) return { ok: false, error: 'Leaderboard API not found. Use the deployed site or run "vercel dev" locally.' };
        const data = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, ...data } : { ok: false, error: data.error ?? 'Something went wrong.' };
    } catch {
        return { ok: false, error: 'Could not reach the leaderboard.' };
    }
}

export const fetchBoard = (board) => call(`/api/leaderboard?board=${encodeURIComponent(board)}`);

export async function submitScore(name) {
    const res = await call('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            playerId: playerId(),
            name,
            playtime: Math.floor(state.playTime),
            muffins: state.totalBaked,
            clicks: state.totalClicks,
        }),
    });
    if (res.ok) localStorage.setItem(NAME_KEY, name);
    return res;
}