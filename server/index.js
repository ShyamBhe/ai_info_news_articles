import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Resolve server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (one level above server). On Render the values
// come from the dashboard "Environment" tab instead, so a missing file is fine.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  ADMIN_PASSWORD = 'change-me',
  JWT_SECRET = 'dev-secret',
  PORT = 4000,
  SUPABASE_URL,
  SUPABASE_BUCKET = 'images',
} = process.env;

// Supabase "secret" key (sb_secret_...) or the older "service_role" key.
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '\nMissing Supabase settings. Set SUPABASE_URL and SUPABASE_SECRET_KEY ' +
      '(in the root .env file locally, or in Render > Environment).\n'
  );
  process.exit(1);
}

if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
  console.warn(
    'WARNING: ADMIN_PASSWORD and/or JWT_SECRET are not set - insecure defaults are active.'
  );
}

// Supabase client (server side only: the secret key must never reach the browser)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Make sure the public image bucket exists (does nothing if it already does)
(async () => {
  try {
    const { error } = await supabase.storage.createBucket(SUPABASE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn('Could not create storage bucket:', error.message);
    }
  } catch (e) {
    console.warn('Could not reach Supabase storage:', e.message);
  }
})();

// Wraps async route handlers so errors reach the error handler below
const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) =>
  Object.assign(new Error(message), { status, expose: true });

// Image upload: kept in memory, then sent to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, f, cb) =>
    IMAGE_EXT[f.mimetype]
      ? cb(null, true)
      : cb(httpError(400, 'Only PNG, JPG, WEBP or GIF images are allowed.')),
});

async function uploadImage(file) {
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${IMAGE_EXT[file.mimetype]}`;
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(name, file.buffer, { contentType: file.mimetype });
  if (error) throw error;
  return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(name).data.publicUrl;
}

// Deletes an image from Storage when we know it lives in our bucket
async function removeImage(url) {
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  if (i < 0) return;
  try {
    const name = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
    await supabase.storage.from(SUPABASE_BUCKET).remove([name]);
  } catch (e) {
    console.warn('Could not delete old image:', e.message);
  }
}

// Authentication middleware
const auth = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Express application
const app = express();

app.use(express.json());

// Never let browsers cache API answers, so edits show up straight away
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health check. Pinging this regularly also keeps Render awake and counts as
// database activity, so the free Supabase project is not paused for inactivity.
app.get(
  '/api/health',
  ah(async (_req, res) => {
    const { error } = await supabase.from('posts').select('id').limit(1);
    if (error) throw error;
    res.json({ ok: true });
  })
);

// Admin login
app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.json({
    token: jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' }),
  });
});

// Get posts
app.get(
  '/api/posts',
  ah(async (req, res) => {
    const limit = Math.min(+req.query.limit || 9, 50);
    const page = Math.max(+req.query.page || 1, 1);
    const offset = (page - 1) * limit;
    const cats = (req.query.category || '').split(',').filter(Boolean);
    // strip characters that have a special meaning inside a PostgREST filter
    const q = (req.query.q || '').trim().replace(/[,()"\\]/g, ' ');

    let query = supabase.from('posts').select('*', { count: 'exact' });

    if (cats.length) query = query.in('category', cats);
    if (q) {
      query = query.or(
        ['title_en', 'title_ne', 'body_en', 'body_ne']
          .map((f) => `${f}.ilike.%${q}%`)
          .join(',')
      );
    }

    query =
      req.query.sort === 'views'
        ? query.order('views', { ascending: false }).order('id', { ascending: false })
        : query.order('id', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({
      items: data,
      total: count,
      pages: Math.ceil(count / limit),
    });
  })
);

// Get individual post (also counts a view)
app.get(
  '/api/posts/:id',
  ah(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const { data, error } = await supabase.rpc('increment_views', {
      post_id: Number(req.params.id),
    });
    if (error) throw error;
    data && data.length
      ? res.json(data[0])
      : res.status(404).json({ error: 'Not found' });
  })
);

// Post fields
const fields = (b) => ({
  title_en: b.title_en,
  title_ne: b.title_ne,
  body_en: b.body_en,
  body_ne: b.body_ne,
  category: b.category || 'news',
});

// Create post
app.post(
  '/api/posts',
  auth,
  upload.single('image'),
  ah(async (req, res) => {
    const image = req.file ? await uploadImage(req.file) : null;
    const { data, error } = await supabase
      .from('posts')
      .insert({ ...fields(req.body), image })
      .select('id')
      .single();
    if (error) {
      await removeImage(image); // do not leave an orphan image behind
      throw error;
    }
    res.json({ id: data.id });
  })
);

// Update post
app.put(
  '/api/posts/:id',
  auth,
  upload.single('image'),
  ah(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) throw httpError(404, 'Not found');
    const id = Number(req.params.id);

    const { data: old, error: e1 } = await supabase
      .from('posts')
      .select('image')
      .eq('id', id)
      .maybeSingle();
    if (e1) throw e1;
    if (!old) throw httpError(404, 'Not found');

    const newImage = req.file ? await uploadImage(req.file) : null;
    const { error } = await supabase
      .from('posts')
      .update({ ...fields(req.body), image: newImage || old.image })
      .eq('id', id);
    if (error) {
      await removeImage(newImage);
      throw error;
    }
    if (newImage) await removeImage(old.image); // replaced, so delete the old file
    res.json({ ok: true });
  })
);

// Delete post
app.delete(
  '/api/posts/:id',
  auth,
  ah(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) throw httpError(404, 'Not found');
    const id = Number(req.params.id);

    const { data: old } = await supabase
      .from('posts')
      .select('image')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw error;
    if (old) await removeImage(old.image);
    res.json({ ok: true });
  })
);

// Serve frontend production build
const dist = path.join(__dirname, '../client/dist');

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Error handler: always answers with JSON so the admin panel can show the message
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Maximum size is 5 MB.'
        : err.message;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg });
  }
  if (err.expose) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Pana running on http://localhost:${PORT}`);
});
