/**
 * App.jsx — Root application shell
 *
 * Manages the single-level "routing" between:
 *   - TicketList  (view === 'list')
 *   - TicketDetail (view === 'detail', selectedId set)
 *
 * No router library needed for this MVP — a simple useState switch
 * keeps the bundle minimal and the logic transparent.
 */
import { useState } from 'react';
import { ToastProvider } from './components/Toast';
import TicketList   from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';

export default function App() {
  const [view,       setView]       = useState('list');   // 'list' | 'detail'
  const [selectedId, setSelectedId] = useState(null);

  function openTicket(ticketId) {
    setSelectedId(ticketId);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToList() {
    setView('list');
    setSelectedId(null);
  }

  return (
    <ToastProvider>
      <div className="app-shell">

        {/* ── Top navigation bar ── */}
        <header className="topbar" role="banner">
          <div
            className="topbar-brand"
            style={{ cursor: view === 'detail' ? 'pointer' : 'default' }}
            onClick={view === 'detail' ? backToList : undefined}
            role={view === 'detail' ? 'button' : undefined}
            tabIndex={view === 'detail' ? 0 : undefined}
            onKeyDown={view === 'detail' ? e => (e.key === 'Enter' && backToList()) : undefined}
            aria-label={view === 'detail' ? 'Back to ticket list' : undefined}
          >
            <div className="topbar-brand-icon" aria-hidden="true">🎫</div>
            <span>SupportCRM</span>
          </div>

          <nav className="topbar-actions" aria-label="Primary navigation">
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--clr-text-muted)',
              background: 'var(--clr-surface-2)',
              border: '1px solid var(--clr-border)',
              borderRadius: '6px',
              padding: '4px 10px',
            }}>
              {view === 'detail' ? `Viewing ${selectedId}` : 'All Tickets'}
            </span>
          </nav>
        </header>

        {/* ── Main content ── */}
        <main className="app-main" id="main-content" role="main">
          {view === 'list' ? (
            <TicketList onSelect={openTicket} />
          ) : (
            <TicketDetail ticketId={selectedId} onBack={backToList} />
          )}
        </main>

        {/* ── Footer ── */}
        <footer style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: '0.75rem',
          color: 'var(--clr-text-muted)',
          borderTop: '1px solid var(--clr-border)',
        }}>
          SupportCRM MVP · Built with Express + React · {new Date().getFullYear()}
        </footer>

      </div>
    </ToastProvider>
  );
}
