/**
 * pages/TicketList.jsx
 *
 * Main dashboard: stats row, search/filter toolbar, paginated ticket table.
 * Clicking a row navigates to TicketDetail via the onSelect callback.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ticketsApi }     from '../api';
import { formatDate, debounce } from '../utils';
import StatusBadge        from '../components/StatusBadge';
import CreateTicketModal  from '../components/CreateTicketModal';

const STATUS_OPTIONS = ['', 'Open', 'In Progress', 'Closed'];
const LIMIT          = 15;

export default function TicketList({ onSelect }) {
  /* ── State ── */
  const [tickets,     setTickets]     = useState([]);
  const [meta,        setMeta]        = useState({ total: 0, page: 1, pages: 1 });
  const [stats,       setStats]       = useState({ open: 0, progress: 0, closed: 0, total: 0 });
  const [page,        setPage]        = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);

  /* ── Debounced search ── */
  const debouncedSearch = useRef(
    debounce((val, doFetch) => doFetch(val), 350)
  ).current;

  /* ── Fetch tickets ── */
  const fetchTickets = useCallback(async (search = searchQuery, pg = page, status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketsApi.list({ search, page: pg, limit: LIMIT, status });
      setTickets(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page, statusFilter]);

  /* ── Fetch summary stats (all statuses, no filter) ── */
  const fetchStats = useCallback(async () => {
    try {
      const [all, open, prog, closed] = await Promise.all([
        ticketsApi.list({ limit: 1, page: 1 }),
        ticketsApi.list({ status: 'Open',        limit: 1, page: 1 }),
        ticketsApi.list({ status: 'In Progress', limit: 1, page: 1 }),
        ticketsApi.list({ status: 'Closed',      limit: 1, page: 1 }),
      ]);
      setStats({
        total:    all.meta.total,
        open:     open.meta.total,
        progress: prog.meta.total,
        closed:   closed.meta.total,
      });
    } catch (_) { /* stats are non-critical */ }
  }, []);

  useEffect(() => {
    fetchTickets(searchQuery, page, statusFilter);
  }, [page, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search change ── */
  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);
    debouncedSearch(val, (v) => fetchTickets(v, 1, statusFilter));
  }

  /* ── Status filter change ── */
  function handleStatusChange(e) {
    setStatusFilter(e.target.value);
    setPage(1);
  }

  /* ── After creating a new ticket ── */
  function handleCreated() {
    setShowCreate(false);
    setPage(1);
    setSearchQuery('');
    setStatusFilter('');
    fetchTickets('', 1, '');
    fetchStats();
  }

  /* ── Pagination helpers ── */
  function goTo(pg) {
    if (pg < 1 || pg > meta.pages) return;
    setPage(pg);
  }

  /* ── Render page numbers ── */
  function pageNumbers() {
    const { pages } = meta;
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '…', pages];
    if (page >= pages - 3) return [1, '…', pages-4, pages-3, pages-2, pages-1, pages];
    return [1, '…', page-1, page, page+1, '…', pages];
  }

  return (
    <div>
      {/* ── Stats row ── */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total Tickets</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open</span>
          <span className="stat-value open">{stats.open}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">In Progress</span>
          <span className="stat-value progress">{stats.progress}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Closed</span>
          <span className="stat-value closed">{stats.closed}</span>
        </div>
      </div>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Support Tickets</h1>
          <p className="page-subtitle">
            {meta.total} ticket{meta.total !== 1 ? 's' : ''}
            {statusFilter ? ` · ${statusFilter}` : ''}
            {searchQuery  ? ` matching "${searchQuery}"` : ''}
          </p>
        </div>
        <button
          id="btn-open-create-modal"
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
        >
          + New Ticket
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            id="ticket-search"
            type="search"
            className="search-input"
            placeholder="Search by ID, name, email, subject…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search tickets"
          />
        </div>
        <select
          id="ticket-status-filter"
          className="filter-select"
          value={statusFilter}
          onChange={handleStatusChange}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {error}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: '12px' }}
            onClick={() => fetchTickets()}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
          <span>Loading tickets…</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <p className="empty-title">No tickets found</p>
          <p className="empty-sub">
            {searchQuery || statusFilter
              ? 'Try adjusting your search or filter.'
              : 'Create the first support ticket to get started.'}
          </p>
          {!searchQuery && !statusFilter && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: '8px' }}>
              + New Ticket
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ticket-table-wrap">
            <table className="ticket-table" aria-label="Support tickets">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr
                    key={t.ticket_id}
                    onClick={() => onSelect(t.ticket_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(t.ticket_id)}
                    aria-label={`Open ticket ${t.ticket_id}`}
                  >
                    <td className="ticket-id-cell">{t.ticket_id}</td>
                    <td className="ticket-subject-cell"><span>{t.subject}</span></td>
                    <td>{t.customer_name}</td>
                    <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem' }}>{t.customer_email}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ color: 'var(--clr-text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {formatDate(t.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {meta.pages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                Page {meta.page} of {meta.pages} · {meta.total} total
              </span>
              <div className="pagination-controls" role="navigation" aria-label="Pagination">
                <button
                  className="page-btn"
                  onClick={() => goTo(page - 1)}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {pageNumbers().map((n, i) =>
                  n === '…'
                    ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--clr-text-muted)' }}>…</span>
                    : (
                      <button
                        key={n}
                        className={`page-btn${n === page ? ' active' : ''}`}
                        onClick={() => goTo(n)}
                        aria-label={`Page ${n}`}
                        aria-current={n === page ? 'page' : undefined}
                      >
                        {n}
                      </button>
                    )
                )}
                <button
                  className="page-btn"
                  onClick={() => goTo(page + 1)}
                  disabled={page === meta.pages}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
