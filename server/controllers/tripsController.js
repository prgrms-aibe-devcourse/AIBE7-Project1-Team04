const { createClient } = require('@supabase/supabase-js');
const mainSupabase = require('../config/supabaseClient');

function userClient(token) {
  return createClient(
    process.env.SUPABASE_URL.trim(),
    process.env.SUPABASE_ANON_KEY.trim(),
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function resolveUser(token) {
  const { data: { user }, error } = await mainSupabase.auth.getUser(token);
  if (error || !user) {
    const err = new Error('인증이 필요합니다.');
    err.status = 401;
    throw err;
  }
  return user;
}

async function listTrips(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });

    const user = await resolveUser(token);
    const client = userClient(token);

    const { data, error } = await client
      .from('trips')
      .select('id, title, created_at, payload')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ trips: data || [] });
  } catch (err) {
    next(err);
  }
}

async function getTrip(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });

    const user = await resolveUser(token);
    const client = userClient(token);

    const { data, error } = await client
      .from('trips')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    res.json({ trip: data });
  } catch (err) {
    next(err);
  }
}

async function saveTrip(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });

    const user = await resolveUser(token);
    const client = userClient(token);

    const { title, payload, itinerary } = req.body;
    if (!itinerary) return res.status(400).json({ message: 'itinerary가 필요합니다.' });

    const { data, error } = await client
      .from('trips')
      .insert({
        user_id: user.id,
        title: title || itinerary.headline || '새 여행 일정',
        payload: payload || {},
        itinerary,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ trip: data });
  } catch (err) {
    next(err);
  }
}

async function updateTrip(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });

    const user = await resolveUser(token);
    const client = userClient(token);

    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'title이 필요합니다.' });

    const { data, error } = await client
      .from('trips')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
    res.json({ trip: data });
  } catch (err) {
    next(err);
  }
}

async function deleteTrip(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: '인증이 필요합니다.' });

    const user = await resolveUser(token);
    const client = userClient(token);

    const { error } = await client
      .from('trips')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTrips, getTrip, saveTrip, updateTrip, deleteTrip };
