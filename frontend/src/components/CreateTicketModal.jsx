/**
 * components/CreateTicketModal.jsx
 *
 * Slide-up modal form to submit a new support ticket.
 * - Client-side validation mirrors the server rules (fast UX feedback).
 * - Displays server-returned field errors on top of client ones.
 * - Calls onCreated(ticket) on successful creation.
 */
import { useState } from 'react';
import { ticketsApi } from '../api';
import { useToast }   from './Toast';

const INITIAL = {
  customer_name:  '',
  customer_email: '',
  subject:        '',
  description:    '',
  priority:       'Low',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f) {
  const errs = {};
  if (!f.customer_name.trim() || f.customer_name.trim().length < 2)
    errs.customer_name = 'Full name required (min 2 characters).';
  if (!EMAIL_RE.test(f.customer_email.trim()))
    errs.customer_email = 'A valid email address is required.';
  if (!f.subject.trim() || f.subject.trim().length < 5)
    errs.subject = 'Subject required (min 5 characters).';
  if (!f.description.trim() || f.description.trim().length < 10)
    errs.description = 'Description required (min 10 characters).';
  return errs;
}

export default function CreateTicketModal({ onClose, onCreated }) {
  const toast = useToast();

  const [form,    setForm]    = useState(INITIAL);
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    // Clear field error on change
    if (errors[name]) setErrors(e => { const n = { ...e }; delete n[name]; return n; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrs = validate(form);
    if (Object.keys(clientErrs).length) { setErrors(clientErrs); return; }

    setLoading(true);
    try {
      const res = await ticketsApi.create({
        customer_name:  form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        subject:        form.subject.trim(),
        description:    form.description.trim(),
        priority:       form.priority,
      });
      toast('Ticket created successfully!', 'success');
      onCreated(res.data);
    } catch (err) {
      if (err.fields) {
        setErrors(err.fields);
      } else {
        toast(err.message || 'Failed to create ticket.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Create new ticket">
      <div className="modal">
        <div className="modal-header">
          <h2>New Support Ticket</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">

            <div className="form-group">
              <label className="form-label" htmlFor="ct-name">Customer Name</label>
              <input
                id="ct-name"
                name="customer_name"
                type="text"
                className={`form-input${errors.customer_name ? ' error' : ''}`}
                placeholder="Jane Smith"
                value={form.customer_name}
                onChange={handleChange}
                autoComplete="name"
              />
              {errors.customer_name && (
                <span className="field-error">⚠ {errors.customer_name}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ct-email">Email Address</label>
              <input
                id="ct-email"
                name="customer_email"
                type="email"
                className={`form-input${errors.customer_email ? ' error' : ''}`}
                placeholder="jane@example.com"
                value={form.customer_email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.customer_email && (
                <span className="field-error">⚠ {errors.customer_email}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ct-subject">Subject</label>
              <input
                id="ct-subject"
                name="subject"
                type="text"
                className={`form-input${errors.subject ? ' error' : ''}`}
                placeholder="Brief summary of the issue…"
                value={form.subject}
                onChange={handleChange}
              />
              {errors.subject && (
                <span className="field-error">⚠ {errors.subject}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ct-description">Description</label>
              <textarea
                id="ct-description"
                name="description"
                className={`form-textarea${errors.description ? ' error' : ''}`}
                placeholder="Describe the issue in detail…"
                value={form.description}
                onChange={handleChange}
                rows={5}
              />
              {errors.description && (
                <span className="field-error">⚠ {errors.description}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ct-priority">Priority</label>
              <select
                id="ct-priority"
                name="priority"
                className="form-select"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="Low">Low (48h SLA)</option>
                <option value="Medium">Medium (24h SLA)</option>
                <option value="High">High (6h SLA)</option>
                <option value="Urgent">Urgent (2h SLA)</option>
              </select>
            </div>

          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button id="submit-create-ticket" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : '✦ Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
