
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import express from 'express';
import Database from 'better-sqlite3';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { seed } from './seed.js';

// Resolve server directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (one level above server)
dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

// Environment variables
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD = 'change-me',
  JWT_SECRET = 'dev-secret',
  PORT = 4000
} = process.env;

console.log('ADMIN_EMAIL loaded:', ADMIN_EMAIL ? 'YES' : 'NO');
console.log(
  'ADMIN_PASSWORD loaded:',
  process.env.ADMIN_PASSWORD ? 'YES' : 'NO (default "change-me" is active)'
);
console.log(
  'JWT_SECRET loaded:',
  process.env.JWT_SECRET ? 'YES' : 'NO (default "dev-secret" is active)'
);

// Directories
const dataDir = path.join(__dirname, 'data');
const upDir = path.join(dataDir, 'uploads');

fs.mkdirSync(upDir, { recursive: true });

// Database
const db = new Database(path.join(dataDir, 'aipana.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_en TEXT,
    title_ne TEXT,
    body_en TEXT,
    body_ne TEXT,
    category TEXT DEFAULT 'news',
    image TEXT,
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

seed(db, upDir);

// Image upload configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: upDir,
    filename: (_r, f, cb) =>
      cb(null, Date.now() + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) =>
    cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(f.mimetype)),
});

// Authentication middleware
const auth = (req, res, next) => {
  try {
    jwt.verify(
      (req.headers.authorization || '').replace('Bearer ', ''),
      JWT_SECRET
    );
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Express application
const app = express();

app.use(express.json());
app.use('/uploads', express.static(upDir, { maxAge: '7d' }));

// Admin login
app.post('/api/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  res.json({
    token: jwt.sign({ admin: true }, JWT_SECRET, {
      expiresIn: '7d',
    }),
  });
});

// Get posts
app.get('/api/posts', (req, res) => {
  const limit = Math.min(+req.query.limit || 9, 50);
  const offset = ((+req.query.page || 1) - 1) * limit;
  const cats = (req.query.category || '').split(',').filter(Boolean);
  const q = (req.query.q || '').trim();

  const w = [];
  const args = [];

  if (cats.length) {
    w.push(`category IN (${cats.map(() => '?').join()})`);
    args.push(...cats);
  }

  if (q) {
    w.push(
      '(title_en LIKE ? OR title_ne LIKE ? OR body_en LIKE ? OR body_ne LIKE ?)'
    );
    args.push(...Array(4).fill(`%${q}%`));
  }

  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const order =
    req.query.sort === 'views' ? 'views DESC, id DESC' : 'id DESC';

  const items = db
    .prepare(
      `SELECT * FROM posts ${where} ORDER BY ${order} LIMIT ? OFFSET ?`
    )
    .all(...args, limit, offset);

  const total = db
    .prepare(`SELECT COUNT(*) c FROM posts ${where}`)
    .get(...args).c;

  res.json({
    items,
    total,
    pages: Math.ceil(total / limit),
  });
});

// Get individual post
app.get('/api/posts/:id', (req, res) => {
  db.prepare('UPDATE posts SET views=views+1 WHERE id=?').run(req.params.id);

  const p = db
    .prepare('SELECT * FROM posts WHERE id=?')
    .get(req.params.id);

  p ? res.json(p) : res.status(404).json({ error: 'Not found' });
});

// Post fields
const fields = (b) => [
  b.title_en,
  b.title_ne,
  b.body_en,
  b.body_ne,
  b.category || 'news',
];

// Create post
app.post('/api/posts', auth, upload.single('image'), (req, res) => {
  const r = db
    .prepare(
      'INSERT INTO posts(title_en,title_ne,body_en,body_ne,category,image) VALUES(?,?,?,?,?,?)'
    )
    .run(
      ...fields(req.body),
      req.file ? '/uploads/' + req.file.filename : null
    );

  res.json({ id: r.lastInsertRowid });
});

// Update post
app.put('/api/posts/:id', auth, upload.single('image'), (req, res) => {
  const old = db
    .prepare('SELECT image FROM posts WHERE id=?')
    .get(req.params.id);

  if (!old) {
    return res.status(404).json({ error: 'Not found' });
  }

  const img = req.file ? '/uploads/' + req.file.filename : old.image;

  db.prepare(
    'UPDATE posts SET title_en=?,title_ne=?,body_en=?,body_ne=?,category=?,image=? WHERE id=?'
  ).run(...fields(req.body), img, req.params.id);

  res.json({ ok: true });
});

// Delete post
app.delete('/api/posts/:id', auth, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Serve frontend production build
const dist = path.join(__dirname, '../client/dist');

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(dist, 'index.html'))
  );
}

// Start server
app.listen(PORT, () => {
  console.log(`AI Pana running on http://localhost:${PORT}`);
});
