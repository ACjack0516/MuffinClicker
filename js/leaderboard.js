// Vercel serverless function: GET ?board=muffins|clicks|playtime, POST to save a score.
// Needs env vars SUPABASE_URL and SUPABASE_SERVICE_KEY (server only, never put them in client code).
const BOARDS = new Set(['muffins', 'clicks', 'playtime']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CLICKS_PER_SECOND = 25;
const COOLDOWN_MS = 30000;
const TOP_N = 50;

async function sb(path, { method = 'GET', body, prefer } = {}) {
    const key = process.env.SUPABASE_SERVICE_KEY;
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
            apikey: key,
            // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys go in apikey only.
            ...(!key.startsWith('sb_') && { Authorization: `Bearer ${key}` }),
            'Content-Type': 'application/json',
            ...(prefer && { Prefer: prefer }),
        },
        body: body && JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const board = req.query.board;
            if (!BOARDS.has(board)) return res.status(400).json({ error: 'Unknown leaderboard.' });
            const rows = await sb(`scores?select=name,${board}&order=${board}.desc,updated_at.asc&limit=${TOP_N}`);
            res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
            return res.status(200).json({ rows: rows.map((r) => ({ name: r.name, value: r[board] })) });
        }

        if (req.method === 'POST') {
            res.setHeader('Cache-Control', 'no-store');
            const b = req.body ?? {};
            const name = String(b.name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
            const playtime = Math.floor(Number(b.playtime));
            const clicks = Math.floor(Number(b.clicks));
            const muffins = Number(b.muffins);

            if (!UUID.test(String(b.playerId)) || !name) return res.status(400).json({ error: 'Invalid name or player.' });
            if (![playtime, clicks, muffins].every(Number.isFinite) || playtime < 0 || clicks < 0 || muffins < 0) {
                return res.status(400).json({ error: 'Invalid score.' });
            }
            if (clicks > playtime * MAX_CLICKS_PER_SECOND + 200) {
                return res.status(400).json({ error: 'Score rejected: that many clicks is not plausible for that playtime.' });
            }

            const [old] = await sb(`scores?player_id=eq.${b.playerId}&select=playtime,muffins,clicks,updated_at`);
            if (old && Date.now() - Date.parse(old.updated_at) < COOLDOWN_MS) {
                return res.status(429).json({ error: 'Please wait a little before saving again.' });
            }
            // Each player keeps their best value on every board.
            await sb('scores?on_conflict=player_id', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates,return=minimal',
                body: {
                    player_id: b.playerId,
                    name,
                    playtime: Math.max(old?.playtime ?? 0, playtime),
                    muffins: Math.max(old?.muffins ?? 0, muffins),
                    clicks: Math.max(old?.clicks ?? 0, clicks),
                    updated_at: new Date().toISOString(),
                },
            });
            return res.status(200).json({ ok: true });
        }

        res.status(405).json({ error: 'Method not allowed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'The leaderboard is unavailable right now.' });
    }
};