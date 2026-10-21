'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/admin';
import './admin.css';

const SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['active', 'Recently active'], ['name', 'Name A to Z']];
const COLOURS = { violet:'#5560a8', blue:'#4a86d6', red:'#d64a5f', black:'#51545f' };
const when = d => d ? new Date(d).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'never';

export default function AdminUsers(){
  const [input, setInput] = useState(''), [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest'), [page, setPage] = useState(1);
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [input]);

  useEffect(() => {
    const ac = new AbortController(); setLoading(true);
    const qs = new URLSearchParams({ sort, page:String(page), q:search });
    fetch('/api/admin/users?' + qs, { credentials:'same-origin', signal:ac.signal })
      .then(async r => {
        if(r.status === 404) throw new Error('Not found. Your session may have ended, or this account is not an admin.');
        if(r.status === 503) throw new Error('Server unavailable. Check /api/health.');
        if(!r.ok) throw new Error('Something went wrong (' + r.status + ').');
        return r.json();
      })
      .then(d => { setData(d); setError(''); })
      .catch(e => { if(e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if(!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [sort, page, search, tick]);

  const stats = data && data.stats;
  const csv = '/api/admin/users?' + new URLSearchParams({ format:'csv', sort, q:search });

  return (
    <main className="adm">
      <header className="adm-top">
        <div><p className="adm-eyebrow">Admin</p><h1>Players</h1></div>
        <nav><Link href="/play">Back to the game</Link></nav>
      </header>

      {error ? (
        <div className="adm-note" role="alert"><p>{error}</p><button className="adm-btn" onClick={() => setTick(t => t + 1)}>Try again</button></div>
      ) : (
        <>
          <section className="adm-stats" aria-label="Totals">
            {[['Registered players', stats?.total], ['Joined in the last 7 days', stats?.newThisWeek], ['Admins', stats?.admins], ['Scores posted', stats?.scoresTotal]].map(([label, n]) => (
              <div key={label} className="adm-stat"><b>{n === undefined ? '...' : n.toLocaleString()}</b><span>{label}</span></div>
            ))}
          </section>

          <section className="adm-tools">
            <label className="adm-field"><span>Search by name</span>
              <input type="search" value={input} onChange={e => setInput(e.target.value)} placeholder="Type part of a name" maxLength={30} autoComplete="off" />
            </label>
            <label className="adm-field"><span>Sort</span>
              <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <a className="adm-btn" href={csv} download>Download CSV</a>
          </section>

          <p className="adm-count" aria-live="polite">
            {loading && !data ? 'Loading...' : data ? `${data.matching.toLocaleString()} ${data.matching === 1 ? 'player' : 'players'}${search ? ` matching "${search}"` : ''}` : ''}
          </p>

          <div className="adm-scroll" aria-busy={loading}>
            <table className="adm-table">
              <caption className="adm-sr">Registered players</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Joined</th><th scope="col">Last login</th><th scope="col">Handset</th><th scope="col" className="num">Scores</th><th scope="col" className="num">Best</th></tr></thead>
              <tbody>
                {data && data.users.map(u => (
                  <tr key={u.name}>
                    <th scope="row">{u.name}{u.role === 'admin' && <em className="adm-badge">admin</em>}{u.you && <em className="adm-you">you</em>}</th>
                    <td title={when(u.createdAt)}>{new Date(u.createdAt).toLocaleDateString(undefined, { dateStyle:'medium' })}</td>
                    <td title={when(u.lastLoginAt)}>{timeAgo(u.lastLoginAt)}</td>
                    <td><span className="adm-dot" style={{ background:COLOURS[u.theme] || '#888' }} aria-hidden="true" />{u.theme}</td>
                    <td className="num">{u.scores.count}</td>
                    <td className="num">{u.scores.best ?? '-'}</td>
                  </tr>
                ))}
                {data && data.users.length === 0 && <tr><td colSpan={6} className="adm-empty">{search ? 'No player matches that search.' : 'No one has registered yet.'}</td></tr>}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <nav className="adm-pager" aria-label="Pages">
              <button className="adm-btn" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {data.page} of {data.pages}</span>
              <button className="adm-btn" disabled={page >= data.pages || loading} onClick={() => setPage(p => p + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
