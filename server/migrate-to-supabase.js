// One-time script: copies the posts and images from the old local SQLite file
// (server/data/aipana.db) into Supabase.
//
// Run it ONCE on your own computer, from the server folder:
//     npm install
//     node migrate-to-supabase.js
//
// It refuses to run if the Supabase "posts" table already has rows
// (use --force to run anyway).

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BUCKET = process.env.SUPABASE_BUCKET || 'images';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.SUPABASE_URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the root .env file first.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const dbFile = path.join(__dirname, 'data', 'aipana.db');
const upDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(dbFile)) {
  console.error('Cannot find', dbFile);
  process.exit(1);
}

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// 1. make sure the table exists and is empty
const { count, error: cErr } = await supabase
  .from('posts')
  .select('id', { count: 'exact', head: true });
if (cErr) {
  console.error('Cannot read the "posts" table. Did you run supabase-setup.sql?\n', cErr.message);
  process.exit(1);
}
if (count > 0 && !process.argv.includes('--force')) {
  console.error(`The Supabase table already has ${count} posts. Nothing copied (use --force to copy anyway).`);
  process.exit(1);
}

// 2. make sure the bucket exists
const { error: bErr } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
});
if (bErr && !/already exists|duplicate/i.test(bErr.message)) {
  console.error('Bucket error:', bErr.message);
  process.exit(1);
}

// 3. copy post by post, oldest first, so the ids keep their order
const old = new Database(dbFile, { readonly: true }).prepare('SELECT * FROM posts ORDER BY id ASC').all();
console.log(`Copying ${old.length} posts...`);

let done = 0;
for (const p of old) {
  let image = p.image;

  if (image && image.startsWith('/uploads/')) {
    const file = path.join(upDir, path.basename(image));
    if (fs.existsSync(file)) {
      const name = path.basename(image);
      const { error } = await supabase.storage.from(BUCKET).upload(name, fs.readFileSync(file), {
        contentType: MIME[path.extname(name).toLowerCase()] || 'application/octet-stream',
        upsert: true,
      });
      if (error) {
        console.error(`Image ${name} failed:`, error.message);
        process.exit(1);
      }
      image = supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
    } else {
      console.warn(`Image file missing for post ${p.id} (${image}) - saving post without image`);
      image = null;
    }
  }

  // SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC
  const created_at = new Date(String(p.created_at).replace(' ', 'T') + 'Z').toISOString();

  const { error } = await supabase.from('posts').insert({
    title_en: p.title_en,
    title_ne: p.title_ne,
    body_en: p.body_en,
    body_ne: p.body_ne,
    category: p.category,
    image,
    views: p.views || 0,
    created_at,
  });
  if (error) {
    console.error(`Post ${p.id} failed:`, error.message);
    process.exit(1);
  }
  done++;
}

console.log(`Done. ${done} posts copied to Supabase.`);
