/**
 * pages/TicketDetail.jsx
 *
 * Full-detail view for a single ticket.
 * Shows metadata, full description, notes timeline, and the update panel.
 * Fetches ticket data by ticket_id on mount.
 */
import { useState, useEffect, useCallback } from 'react';
import { ticketsApi }       from '../api';
import { formatDate }       from '../utils';
import StatusBadge          from '../components/StatusBadge';
import UpdateTicketPanel    from '../components/UpdateTicketPanel';

export default function TicketDetail({ ticketId, onBack }) {
  const [ticket,  setTicket]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketsApi.get(ticketId);
      setTicket(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  /** Called by UpdateTicketPanel after a successful save */
  function handleUpdated(patch) {
    setTicket(prev => ({
      ...prev,
      status:     patch.status,
      updated_at: patch.updated_at,
    }));
    // Reload to get fresh notes list
    load();
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
        <span>Loading ticket…</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div>
        <button className="back-link" onClick={onBack}>← Back to tickets</button>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Back navigation */}
      <button className="back-link" onClick={onBack} id="btn-back-to-list">
        ← Back to tickets
      </button>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ color: 'var(--clr-primary)', fontSize: '1.4rem' }}>
              {ticket.ticket_id}
            </span>
            <StatusBadge status={ticket.status} />
          </h1>
          <p className="page-subtitle">{ticket.subject}</p>
        </div>
      </div>

      {/* Two-column layout: main + sidebar */}
      <div className="detail-grid">

        {/* ── Left: ticket info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Metadata card */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', color: 'var(--clr-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Ticket Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="detail-meta-item">
                <span className="detail-meta-label">Customer</span>
                <span className="detail-meta-value">{ticket.customer_name}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">Email</span>
                <a className="detail-meta-value" href={`mailto:${ticket.customer_email}`} style={{ color: 'var(--clr-primary)', fontSize: '0.9rem' }}>
                  {ticket.customer_email}
                </a>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">Created</span>
                <span className="detail-meta-value">{formatDate(ticket.created_at)}</span>
              </div>
              <div className="detail-meta-item">
                <span className="detail-meta-label">Last Updated</span>
                <span className="detail-meta-value">{formatDate(ticket.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <h3 style={{ marginBottom: '12px', color: 'var(--clr-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
              Description
            </h3>
            <div className="description-box">{ticket.description}</div>
          </div>

          {/* Notes timeline */}
          <div className="card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--clr-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
                Notes
              </span>
              <span style={{
                background: 'var(--clr-primary-dim)',
                color: 'var(--clr-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '1px 8px',
                borderRadius: '99px',
              }}>
                {ticket.notes?.length ?? 0}
              </span>
            </h3>

            <div className="notes-section">
              {ticket.notes && ticket.notes.length > 0 ? (
                ticket.notes.map(n => (
                  <div key={n.id} className="note-item">
                    <p className="note-text">{n.note_text}</p>
                    <p className="note-ts">{formatDate(n.created_at)}</p>
                  </div>
                ))
              ) : (
                <div className="no-notes">
                  <p>No notes yet.</p>
                  <p style={{ marginTop: '4px' }}>Add an internal note using the panel →</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right: update panel ── */}
        <UpdateTicketPanel ticket={ticket} onUpdated={handleUpdated} />

      </div>
    </div>
  );
}
