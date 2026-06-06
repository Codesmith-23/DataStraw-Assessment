/**
 * components/UpdateTicketPanel.jsx
 *
 * Sidebar panel inside the ticket detail view.
 * Allows agents to:
 *   1. Change the ticket status (dropdown → submit).
 *   2. Add an internal note (textarea → submit).
 * Both can be submitted together in one request.
 */
import { useState } from 'react';
import { ticketsApi } from '../api';
import { useToast }   from './Toast';
import StatusBadge    from './StatusBadge';

const STATUSES = ['Open', 'In Progress', 'Closed'];

export default function UpdateTicketPanel({ ticket, onUpdated }) {
  const toast = useToast();

  const [status,  setStatus]  = useState(ticket.status);
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [noteErr, setNoteErr] = useState('');

  const statusChanged = status !== ticket.status;
  const hasNote       = note.trim().length > 0;
  const canSubmit     = (statusChanged || hasNote) && !loading;

  async function handleSubmit(e) {
    e.preventDefault();

    // Client-side note validation
    if (hasNote && note.trim().length > 2000) {
      setNoteErr('Note must be 2000 characters or fewer.');
      return;
    }
    setNoteErr('');

    const body = {};
    if (statusChanged) body.status = status;
    if (hasNote)       body.note   = note.trim();

    setLoading(true);
    try {
      const res = await ticketsApi.update(ticket.ticket_id, body);
      toast(
        `Ticket updated${res.data.note_added ? ' · Note added' : ''}.`,
        'success'
      );
      setNote('');
      onUpdated(res.data);
    } catch (err) {
      toast(err.message || 'Update failed.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ margin: 0, borderBottom: '1px solid var(--clr-border)', paddingBottom: '14px' }}>
        Manage Ticket
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Status selector */}
        <div className="form-group">
          <label className="form-label" htmlFor="up-status">Status</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              id="up-status"
              className="form-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: '6px' }}>
            <StatusBadge status={status} />
            {statusChanged && (
              <span style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginLeft: '8px' }}>
                (changed from <strong>{ticket.status}</strong>)
              </span>
            )}
          </div>
        </div>

        {/* Note textarea */}
        <div className="form-group">
          <label className="form-label" htmlFor="up-note">
            Add Internal Note
            <span style={{ color: 'var(--clr-text-muted)', marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
              (optional)
            </span>
          </label>
          <textarea
            id="up-note"
            className={`form-textarea${noteErr ? ' error' : ''}`}
            placeholder="Log an update, action taken, or internal comment…"
            value={note}
            onChange={e => { setNote(e.target.value); setNoteErr(''); }}
            rows={4}
            maxLength={2001}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {noteErr
              ? <span className="field-error">⚠ {noteErr}</span>
              : <span />
            }
            <span style={{ fontSize: '0.72rem', color: 'var(--clr-text-muted)' }}>
              {note.length}/2000
            </span>
          </div>
        </div>

        <button
          id="btn-update-ticket"
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit}
          style={{ alignSelf: 'stretch' }}
        >
          {loading ? 'Saving…' : '↑ Save Changes'}
        </button>

      </form>
    </aside>
  );
}
