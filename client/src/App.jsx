import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Link, NavLink, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { T } from './i18n.js';
import { MENU, LEAVES, label, slugsOf, parentOf } from './menu.js';

const Ctx = createContext();
const useApp = () => useContext(Ctx);
const X = {
  en: { trending: 'Trending', viewAll: 'View all', search: 'Search…', results: 'Search results', learn: 'New to AI? Start here' },
  ne: { trending: 'ट्रेन्डिङ', viewAll: 'सबै हेर्नुहोस्', search: 'खोज्नुहोस्…', results: 'खोजका नतिजा', learn: 'एआईमा नयाँ? यहाँबाट सुरु गर्नुहोस्' },
};

const api = async (url, opts = {}) => {
  const token = localStorage.getItem('token');
  const r = await fetch(url, { ...opts, headers: { ...(token && { Authorization: 'Bearer ' + token }), ...opts.headers } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Error');
  return r.json();
};
const pick = (p, f, lang) => p[`${f}_${lang}`] || p[`${f}_${lang === 'ne' ? 'en' : 'ne'}`] || '';
const catName = (c, lang) => label(c, lang);
const loc = (lang) => (lang === 'ne' ? 'ne-NP' : 'en-US');
const fmt = (p, lang) => new Date(p.created_at + 'Z').toLocaleDateString(loc(lang), { dateStyle: 'medium' });

function Card({ p }) {
  const { lang, t } = useApp();
  return (
    <article className="card">
      <Link to={`/news/${p.id}`} className="thumb">{p.image ? <img src={p.image} alt="" loading="lazy" /> : <span>AI</span>}</Link>
      <div className="card-body">
        <small>{catName(p.category, lang)} · {fmt(p, lang)}</small>
        <h3><Link to={`/news/${p.id}`}>{pick(p, 'title', lang)}</Link></h3>
        <p>{pick(p, 'body', lang).slice(0, 110)}…</p>
        <Link className="more" to={`/news/${p.id}`}>{t.readMore}</Link>
      </div>
    </article>
  );
}

function Ticker({ items }) {
  const { lang } = useApp();
  const list = [...items, ...items];
  return (
    <div className="ticker"><div>{list.map((p, i) => <Link key={i} to={`/news/${p.id}`}>● {pick(p, 'title', lang)}</Link>)}</div></div>
  );
}

function Hero({ items }) {
  const { lang } = useApp();
  const [a, ...rest] = items;
  if (!a) return null;
  const bg = (p) => ({ backgroundImage: `url(${p.image})` });
  return (
    <div className="hero-grid">
      <Link to={`/news/${a.id}`} className="big" style={bg(a)}><div><small>{catName(a.category, lang)}</small><h2>{pick(a, 'title', lang)}</h2></div></Link>
      {rest.slice(0, 4).map((p) => <Link key={p.id} to={`/news/${p.id}`} className="mini" style={bg(p)}><div><h4>{pick(p, 'title', lang)}</h4></div></Link>)}
    </div>
  );
}

function Sidebar({ hot }) {
  const { lang } = useApp();
  const x = X[lang];
  return (
    <aside>
      <div className="side">
        <h3 className="side-h">{x.trending}</h3>
        <ol>{hot.map((p, i) => (
          <li key={p.id}><b>{i + 1}</b>{p.image && <img src={p.image} alt="" loading="lazy" />}<Link to={`/news/${p.id}`}>{pick(p, 'title', lang)}</Link></li>
        ))}</ol>
      </div>
      <div className="side" style={{ marginTop: 16 }}>
        <h3 className="side-h">{x.learn}</h3>
        {MENU[0].kids.map((k) => <Link key={k[0]} className="side-link" to={`/c/${k[0]}`}>› {k[lang === 'ne' ? 2 : 1]}</Link>)}
      </div>
    </aside>
  );
}

function Home() {
  const { lang, t } = useApp();
  const x = X[lang];
  const [all, setAll] = useState(null);
  const [hot, setHot] = useState([]);
  useEffect(() => {
    api('/api/posts?limit=50').then((d) => setAll(d.items)).catch(() => setAll([]));
    api('/api/posts?limit=6&sort=views').then((d) => setHot(d.items)).catch(() => {});
  }, []);
  if (!all) return <p className="wrap">{t.loading}</p>;
  return (
    <>
      <Ticker items={all.slice(0, 8)} />
      <div className="wrap two"><Hero items={all.slice(0, 5)} /><Sidebar hot={hot} /></div>
      {MENU.map((m) => {
        const l = all.filter((p) => parentOf(p.category) === m.slug).slice(0, 4);
        return l.length ? (
          <section className="wrap" key={m.slug}>
            <div className="sec-h"><h2>{m[lang]}</h2><Link to={`/c/${m.slug}`}>{x.viewAll} →</Link></div>
            <div className="grid">{l.map((p) => <Card key={p.id} p={p} />)}</div>
          </section>
        ) : null;
      })}
    </>
  );
}

function Pager({ page, setPage, pages }) {
  const { t } = useApp();
  if (!(pages > 1)) return null;
  return (
    <div className="pager">
      <button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t.prev}</button>
      <span>{page} / {pages}</span>
      <button className="btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t.next}</button>
    </div>
  );
}

function Category() {
  const { slug } = useParams();
  const { lang, t } = useApp();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const m = MENU.find((x) => x.slug === slug);
  useEffect(() => setPage(1), [slug]);
  useEffect(() => {
    setData(null);
    api(`/api/posts?page=${page}&limit=12&category=${slugsOf(slug).join()}`).then(setData).catch(() => setData({ items: [], pages: 1 }));
  }, [slug, page]);
  return (
    <section className="wrap">
      <h1>{label(slug, lang)}</h1>
      {m?.kids.length > 0 && <div className="chips">{m.kids.map((k) => <Link key={k[0]} className="chip" to={`/c/${k[0]}`}>{k[lang === 'ne' ? 2 : 1]}</Link>)}</div>}
      {!data ? <p>{t.loading}</p> : data.items.length ? <div className="grid">{data.items.map((p) => <Card key={p.id} p={p} />)}</div> : <p>{t.none}</p>}
      <Pager page={page} setPage={setPage} pages={data?.pages} />
    </section>
  );
}

function Search() {
  const [sp] = useSearchParams();
  const q = sp.get('q') || '';
  const { lang, t } = useApp();
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api(`/api/posts?limit=30&q=${encodeURIComponent(q)}`).then(setData).catch(() => setData({ items: [] })); }, [q]);
  return (
    <section className="wrap">
      <h1>{X[lang].results}: “{q}”</h1>
      {!data ? <p>{t.loading}</p> : data.items.length ? <div className="grid">{data.items.map((p) => <Card key={p.id} p={p} />)}</div> : <p>{t.none}</p>}
    </section>
  );
}

function Header({ lang, setLang, theme, setTheme }) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const close = () => setOpen(false);
  const go = (e) => { e.preventDefault(); if (q.trim()) { nav('/search?q=' + encodeURIComponent(q.trim())); close(); } };
  return (
    <header className="hdr">
      <div className="topbar"><div className="wrap row">
        <small>{new Date().toLocaleDateString(loc(lang), { dateStyle: 'full' })}</small>
        <div className="tools">
          <button className="chip" onClick={() => setLang(lang === 'ne' ? 'en' : 'ne')} aria-label="Language">{lang === 'ne' ? 'EN' : 'नेपा'}</button>
          <button className="chip" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Theme">{theme === 'dark' ? '☀️' : '🌙'}</button>
        </div>
      </div></div>
      <div className="wrap row mainbar">
        <Link className="logo" to="/">{t.brand}</Link>
        <form onSubmit={go} className="sf"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={X[lang].search} aria-label="Search" /></form>
        <button className="burger chip" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
      </div>
      <div className={'nav' + (open ? ' open' : '')}><div className="wrap"><ul>
        <li><NavLink to="/" end onClick={close}>{t.home}</NavLink></li>
        {MENU.map((m) => (
          <li key={m.slug} className={m.kids.length ? 'dd' : ''}>
            <NavLink to={`/c/${m.slug}`} onClick={close}>{m[lang]}{m.kids.length > 0 && ' ▾'}</NavLink>
            {m.kids.length > 0 && <div className="sub">{m.kids.map((k) => <Link key={k[0]} to={`/c/${k[0]}`} onClick={close}>{k[lang === 'ne' ? 2 : 1]}</Link>)}</div>}
          </li>
        ))}
      </ul></div></div>
    </header>
  );
}

function Footer() {
  const { lang, t } = useApp();
  return (
    <footer className="ftr">
      <div className="wrap fcols">
        {MENU.filter((m) => m.kids.length).map((m) => (
          <div key={m.slug}><h4><Link to={`/c/${m.slug}`}>{m[lang]}</Link></h4>{m.kids.map((k) => <Link key={k[0]} to={`/c/${k[0]}`}>{k[lang === 'ne' ? 2 : 1]}</Link>)}</div>
        ))}
      </div>
      <div className="wrap copy">© {new Date().getFullYear()} {t.brand} · {t.footer} · <Link to="/c/blog">{label('blog', lang)}</Link> · <Link to="/admin">{t.admin}</Link></div>
    </footer>
  );
}

function Article() {
  const { id } = useParams();
  const { t, lang } = useApp();
  const [p, setP] = useState(null);
  useEffect(() => { api('/api/posts/' + id).then(setP).catch(() => setP(false)); }, [id]);
  useEffect(() => { if (p) document.title = pick(p, 'title', lang) + ' | AI Pana'; }, [p, lang]);
  if (p === false) return <section className="wrap"><p>{t.none}</p></section>;
  if (!p) return <section className="wrap"><p>{t.loading}</p></section>;
  return (
    <article className="wrap narrow">
      <Link to="/">{t.back}</Link>
      <h1>{pick(p, 'title', lang)}</h1>
      <small>{catName(p.category, lang)} · {new Date(p.created_at + 'Z').toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', { dateStyle: 'long' })}</small>
      {p.image && <img className="cover" src={p.image} alt="" />}
      {pick(p, 'body', lang).split(/\n{2,}/).map((para, i) => <p key={i} className="prose">{para}</p>)}
    </article>
  );
}

const EMPTY = { title_en: '', title_ne: '', body_en: '', body_ne: '', category: 'news' };

function Admin() {
  const { t } = useApp();
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [editId, setEditId] = useState(null);

  const load = () => api('/api/posts?limit=50').then((d) => setList(d.items));
  useEffect(() => { if (authed) load(); }, [authed]);

  const login = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      localStorage.setItem('token', token); setAuthed(true); setErr('');
    } catch (x) { setErr(x.message); }
  };

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
    if (file) fd.append('image', file);
    try {
      await api(editId ? '/api/posts/' + editId : '/api/posts', { method: editId ? 'PUT' : 'POST', body: fd });
      setForm(EMPTY); setFile(null); setEditId(null); e.target.reset(); load();
    } catch (x) { setErr(x.message); if (x.message === 'Unauthorized') setAuthed(false); }
  };

  const remove = async (id) => { if (confirm(t.confirmDel)) { await api('/api/posts/' + id, { method: 'DELETE' }); load(); } };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!authed) return (
    <section className="wrap narrow">
      <form onSubmit={login} className="form">
        <h2>{t.admin}</h2>
        <input type="password" placeholder={t.password} value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="btn">{t.login}</button>
      </form>
    </section>
  );

  return (
    <section className="wrap narrow">
      <div className="row"><h2>{editId ? t.editPost : t.newPost}</h2>
        <button className="btn ghost" onClick={() => { localStorage.removeItem('token'); setAuthed(false); }}>{t.logout}</button></div>
      <form onSubmit={save} className="form">
        <input required placeholder={t.titleEn} value={form.title_en} onChange={set('title_en')} />
        <input required placeholder={t.titleNe} value={form.title_ne} onChange={set('title_ne')} />
        <textarea rows="6" placeholder={t.bodyEn} value={form.body_en} onChange={set('body_en')} />
        <textarea rows="6" placeholder={t.bodyNe} value={form.body_ne} onChange={set('body_ne')} />
        <label>{t.category}
          <select value={form.category} onChange={set('category')}>{LEAVES.map((c) => <option key={c.slug} value={c.slug}>{c.en}</option>)}</select></label>
        <label>{t.image}<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row">
          <button className="btn">{t.save}</button>
          {editId && <button type="button" className="btn ghost" onClick={() => { setEditId(null); setForm(EMPTY); }}>{t.cancel}</button>}
        </div>
      </form>
      <ul className="admin-list">
        {list.map((p) => (
          <li key={p.id}><span>{p.title_en || p.title_ne}</span>
            <span>
              <button className="btn ghost" onClick={() => { setEditId(p.id); setForm({ title_en: p.title_en, title_ne: p.title_ne, body_en: p.body_en, body_ne: p.body_ne, category: p.category }); scrollTo(0, 0); }}>{t.edit}</button>{' '}
              <button className="btn ghost" onClick={() => remove(p.id)}>{t.del}</button>
            </span></li>
        ))}
      </ul>
    </section>
  );
}


export default function App() {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ne');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const { pathname } = useLocation();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; localStorage.setItem('lang', lang); }, [lang]);
  useEffect(() => { scrollTo(0, 0); }, [pathname]);
  return (
    <Ctx.Provider value={{ lang, t: T[lang] }}>
      <Header lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:slug" element={<Category />} />
          <Route path="/search" element={<Search />} />
          <Route path="/news/:id" element={<Article />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<section className="wrap"><p>404</p></section>} />
        </Routes>
      </main>
      <Footer />
    </Ctx.Provider>
  );
}
