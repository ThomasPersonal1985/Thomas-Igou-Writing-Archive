const createRatingsTable = "CREATE TABLE IF NOT EXISTS ratings (work_id TEXT NOT NULL, voter_id TEXT NOT NULL, score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (work_id, voter_id))";

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function validWork(context, workId) {
  if (typeof workId !== 'string' || workId.length > 300) return false;
  const asset = await context.env.ASSETS.fetch(new Request(new URL('/archive.json', context.request.url)));
  if (!asset.ok) return false;
  const works = await asset.json();
  return works.some(work => work.Title + '||' + work.Form === workId);
}

async function getRatings(context, workId, voterId) {
  const db = context.env.DB;
  await db.prepare(createRatingsTable).run();
  const [aggregate, personal] = await Promise.all([
    db.prepare('SELECT ROUND(AVG(score), 1) AS average, COUNT(*) AS count FROM ratings WHERE work_id = ?').bind(workId).first(),
    db.prepare('SELECT score FROM ratings WHERE work_id = ? AND voter_id = ?').bind(workId, voterId).first(),
  ]);
  return {
    work_id: workId,
    average: aggregate.average == null ? null : Number(aggregate.average),
    count: Number(aggregate.count || 0),
    your_rating: personal ? Number(personal.score) : null,
  };
}

export async function onRequestGet(context) {
  try {
    const params = new URL(context.request.url).searchParams;
    const workId = params.get('work_id');
    const voterId = params.get('voter_id') || '';
    if (!await validWork(context, workId)) return json({ error: 'Unknown work' }, 404);
    if (voterId && !/^[a-f0-9-]{36}$/i.test(voterId)) return json({ error: 'Invalid voter id' }, 400);
    return json(await getRatings(context, workId, voterId));
  } catch (_) {
    return json({ error: 'Ratings are temporarily unavailable' }, 503);
  }
}

export async function onRequestPost(context) {
  try {
    const length = Number(context.request.headers.get('content-length') || 0);
    if (length > 2048) return json({ error: 'Request is too large' }, 413);
    const body = await context.request.json();
    const workId = body.work_id;
    const voterId = body.voter_id;
    const score = body.score;
    if (!await validWork(context, workId)) return json({ error: 'Unknown work' }, 404);
    if (typeof voterId !== 'string' || !/^[a-f0-9-]{36}$/i.test(voterId)) return json({ error: 'Invalid voter id' }, 400);
    if (!Number.isInteger(score) || score < 1 || score > 5) return json({ error: 'Rating must be from 1 to 5' }, 400);

    const db = context.env.DB;
    await db.prepare(createRatingsTable).run();
    const sql = 'INSERT INTO ratings (work_id, voter_id, score) VALUES (?, ?, ?) ' +
      "ON CONFLICT(work_id, voter_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')";
    await db.prepare(sql).bind(workId, voterId, score).run();
    return json(await getRatings(context, workId, voterId));
  } catch (_) {
    return json({ error: 'Rating could not be saved' }, 503);
  }
}
