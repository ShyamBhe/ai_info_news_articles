# AI Pana (एआई पाना)
React (Vite) + Node/Express + SQLite. Bilingual (ने/EN), dark/light theme, admin panel at /admin.

## Run locally
```bash
npm run install:all
cp server/.env.example server/.env     # edit ADMIN_PASSWORD and JWT_SECRET
npm run dev:server                      # terminal 1 -> http://localhost:4000
npm run dev:client                      # terminal 2 -> http://localhost:5173
```

## Production (single server)
```bash
npm run install:all && npm run build
NODE_ENV=production npm start           # serves API + React build on PORT
```
Data lives in `server/data/` (SQLite DB + uploaded images). Back it up and keep it on persistent storage.
# ai_info_news_articles
