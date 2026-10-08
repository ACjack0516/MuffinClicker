// Talks to the /api/leaderboard serverless function. No accounts: every run (see state.runId) is
// its own leaderboard entry, and submitting the same run again updates that entry.
import { state } from './state.js';

export const savedName = () => state.scoreName;

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
            playerId: state.runId,
            name,
            playtime: Math.floor(state.playTime),
            muffins: state.totalBaked,
            clicks: state.totalClicks,
        }),
    });
    if (res.ok) state.scoreName = name;
    return res;
}