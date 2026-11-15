const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const schema = "CREATE TABLE IF NOT EXISTS contact_attempts (ip_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))";
async function hashIp(ip) { const bytes = new TextEncoder().encode(ip || 'unknown'); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function onRequestPost(context) {
  try {
    const origin = context.request.headers.get('origin');
    if (origin && new URL(origin).host !== new URL(context.request.url).host) return json({ error: 'Request could not be accepted.' }, 403);
    const length = Number(context.request.headers.get('content-length') || 0);
    if (length > 8192) return json({ error: 'Message is too long.' }, 413);
    const body = await context.request.json();
    const { name, email, message, website, started_at: startedAt } = body;
    if (website) return json({ accepted: true });
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 2500 || Date.now() - startedAt > 3 * 60 * 60 * 1000) return json({ error: 'Please wait a moment and try again.' }, 400);
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || typeof message !== 'string' || message.trim().length < 5 || message.length > 3000) return json({ error: 'Please check the name, email and message fields.' }, 400);
    const db = context.env.DB; await db.prepare(schema).run();
    const ipHash = await hashIp(context.request.headers.get('cf-connecting-ip'));
    const recent = await db.prepare("SELECT COUNT(*) AS count FROM contact_attempts WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')").bind(ipHash).first();
    if (Number(recent?.count || 0) >= 3) return json({ error: 'Please try again later.' }, 429);
    await db.prepare('INSERT INTO contact_attempts (ip_hash) VALUES (?)').bind(ipHash).run();
    await db.prepare("DELETE FROM contact_attempts WHERE created_at < datetime('now', '-2 days')").run();
    return json({ accepted: true });
  } catch (_) { return json({ error: 'The contact form is temporarily unavailable.' }, 503); }
}
