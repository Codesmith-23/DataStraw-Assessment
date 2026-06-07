/**
 * ticketsController.js
 *
 * Business logic for all four CRM ticket endpoints.
 * Each exported function maps to one route handler.
 * All database access goes through the helpers in database.js —
 * no raw sql.js calls appear here.
 */

'use strict';

const {
  queryAll,
  queryOne,
  run,
  runInTx,
  transaction,
  generateTicketId,
} = require('../config/database');

/* ─────────────────────────────────────────────────────────────
   VALIDATION HELPERS
   ───────────────────────────────────────────────────────────── */

const VALID_STATUSES   = ['Open', 'In Progress', 'Closed'];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────────────────────────────────────────
   SLA HELPER
   Maps a priority tier to an ISO-8601 deadline string based on
   the current server time.

     Urgent →  +2 hours
     High   →  +6 hours
     Medium → +24 hours
     Low    → +48 hours
   ───────────────────────────────────────────────────────────── */
const SLA_HOURS = { Urgent: 2, High: 6, Medium: 24, Low: 48 };

/**
 * Compute an ISO-8601 SLA deadline string from the current time.
 * @param {string} priority  One of VALID_PRIORITIES
 * @returns {string}  e.g. "2026-06-08T04:07:24.000Z"
 */
function computeSlaDeadline(priority) {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.Low;
  const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  return deadline.toISOString();
}

/**
 * Validate a POST /api/tickets request body.
 * Returns a `fields` object that is empty when everything is valid.
 */
function validateCreateBody(body) {
  const fields = {};
  const { customer_name, customer_email, subject, description, priority } = body || {};

  if (!customer_name || typeof customer_name !== 'string' ||
      customer_name.trim().length < 2 || customer_name.trim().length > 100) {
    fields.customer_name = 'Required. Must be between 2 and 100 characters.';
  }

  if (!customer_email || typeof customer_email !== 'string' ||
      !EMAIL_RE.test(customer_email.trim())) {
    fields.customer_email = 'Required. Must be a valid email address.';
  }

  if (!subject || typeof subject !== 'string' ||
      subject.trim().length < 5 || subject.trim().length > 150) {
    fields.subject = 'Required. Must be between 5 and 150 characters.';
  }

  if (!description || typeof description !== 'string' ||
      description.trim().length < 10 || description.trim().length > 2000) {
    fields.description = 'Required. Must be between 10 and 2000 characters.';
  }

  // priority is optional — defaults to 'Low' when omitted
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    fields.priority = `Must be one of: ${VALID_PRIORITIES.join(', ')}.`;
  }

  return fields;
}

/**
 * Validate a PUT /api/tickets/:ticket_id request body.
 * At least one of `status` or `note` must be present.
 */
function validateUpdateBody(body) {
  const fields = {};
  const { status, note } = body || {};

  const hasStatus = status !== undefined && status !== null;
  const hasNote   = note   !== undefined && note   !== null;

  if (!hasStatus && !hasNote) {
    return { _base: 'Request body must include at least one of: status, note.' };
  }

  if (hasStatus) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      fields.status = `Must be one of: ${VALID_STATUSES.join(', ')}.`;
    }
  }

  if (hasNote) {
    if (typeof note !== 'string' || note.trim().length === 0) {
      fields.note = 'Must be a non-empty string.';
    }
    if (typeof note === 'string' && note.trim().length > 2000) {
      fields.note = 'Maximum 2000 characters.';
    }
  }

  return fields;
}

/* ─────────────────────────────────────────────────────────────
   RESPONSE HELPERS
   ───────────────────────────────────────────────────────────── */

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, httpStatus, code, message, fields = undefined) {
  const error = { code, message };
  if (fields !== undefined) error.fields = fields;
  return res.status(httpStatus).json({ success: false, error });
}

/* ─────────────────────────────────────────────────────────────
   1. POST /api/tickets  — Create a ticket
   ───────────────────────────────────────────────────────────── */

/**
 * Creates a new support ticket.
 *
 * - Validates all four required fields.
 * - Generates a collision-safe TKT-XXX id inside a transaction.
 * - Returns the created ticket row (201).
 */
async function createTicket(req, res) {
  try {
    const fields = validateCreateBody(req.body);
    if (Object.keys(fields).length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Request body contains invalid or missing fields.', fields);
    }

    const {
      customer_name,
      customer_email,
      subject,
      description,
      priority = 'Low',   // default when caller omits the field
    } = req.body;

    // Compute the SLA deadline before entering the transaction
    const sla_deadline = computeSlaDeadline(priority);

    const created = transaction(() => {
      const ticketId = generateTicketId();

      runInTx(
        `INSERT INTO tickets
           (ticket_id, customer_name, customer_email, subject, description,
            priority, sla_deadline)
         VALUES
           (:ticket_id, :customer_name, :customer_email, :subject, :description,
            :priority, :sla_deadline)`,
        {
          ':ticket_id':      ticketId,
          ':customer_name':  customer_name.trim(),
          ':customer_email': customer_email.trim().toLowerCase(),
          ':subject':        subject.trim(),
          ':description':    description.trim(),
          ':priority':       priority,
          ':sla_deadline':   sla_deadline,
        }
      );

      return queryOne(
        `SELECT
           ticket_id, customer_name, customer_email,
           subject, status, priority, sla_deadline, created_at
         FROM tickets
         WHERE ticket_id = :id`,
        { ':id': ticketId }
      );
    });

    return ok(res, created, 201);

  } catch (err) {
    console.error('[createTicket]', err);
    return fail(res, 500, 'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.');
  }
}

/* ─────────────────────────────────────────────────────────────
   2. GET /api/tickets  — List tickets with optional filters
   ───────────────────────────────────────────────────────────── */

/**
 * Returns a paginated list of tickets.
 * Supports optional query params:
 *   ?status=Open|In Progress|Closed
 *   ?search=<string>   (matches ticket_id, customer_name, customer_email, subject)
 *   ?page=1&limit=20
 */
async function getTickets(req, res) {
  try {
    const { status, search } = req.query;
    let   { page = '1', limit = '20' } = req.query;

    // ── Validate query params ────────────────────────────────
    const fieldErrors = {};

    if (status && !VALID_STATUSES.includes(status)) {
      fieldErrors.status = `Must be one of: ${VALID_STATUSES.join(', ')}.`;
    }

    page  = parseInt(page,  10);
    limit = parseInt(limit, 10);

    if (isNaN(page)  || page  < 1)         fieldErrors.page  = 'Must be a positive integer.';
    if (isNaN(limit) || limit < 1 || limit > 100)
      fieldErrors.limit = 'Must be an integer between 1 and 100.';

    if (Object.keys(fieldErrors).length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Request contains invalid query parameters.', fieldErrors);
    }

    // ── Build WHERE clause dynamically ────────────────────────
    const conditions = [];
    const params     = {};

    if (status) {
      conditions.push('t.status = :status');
      params[':status'] = status;
    }

    if (search && search.trim().length > 0) {
      const like = `%${search.trim()}%`;
      conditions.push(`(
        t.ticket_id      LIKE :search
        OR t.customer_name  LIKE :search
        OR t.customer_email LIKE :search
        OR t.subject        LIKE :search
      )`);
      params[':search'] = like;
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // ── Count total matching rows ─────────────────────────────
    const countRow = queryOne(
      `SELECT COUNT(*) AS total FROM tickets t ${where}`, params
    );
    const total = Number(countRow.total);

    // ── Fetch paginated rows ──────────────────────────────────
    const offset = (page - 1) * limit;
    const tickets = queryAll(
      `SELECT
         t.ticket_id,
         t.customer_name,
         t.customer_email,
         t.subject,
         t.status,
         t.priority,
         t.sla_deadline,
         t.created_at,
         t.updated_at
       FROM tickets t
       ${where}
       ORDER BY t.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { ...params, ':limit': limit, ':offset': offset }
    );

    return res.status(200).json({
      success: true,
      data:    tickets,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    console.error('[getTickets]', err);
    return fail(res, 500, 'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.');
  }
}

/* ─────────────────────────────────────────────────────────────
   3. GET /api/tickets/:ticket_id  — Get single ticket with notes
   ───────────────────────────────────────────────────────────── */

/**
 * Fetches a ticket by its human-readable ticket_id (e.g. TKT-001).
 * The response embeds the full notes history as a nested array.
 */
async function getTicket(req, res) {
  try {
    const { ticket_id } = req.params;

    const ticket = queryOne(
      `SELECT
         ticket_id, customer_name, customer_email,
         subject, description, status,
         priority, sla_deadline,
         created_at, updated_at
       FROM tickets
       WHERE ticket_id = :id`,
      { ':id': ticket_id }
    );

    if (!ticket) {
      return fail(res, 404, 'NOT_FOUND',
        `Ticket ${ticket_id} does not exist.`);
    }

    const notes = queryAll(
      `SELECT id, note_text, created_at
       FROM   notes
       WHERE  ticket_id = :id
       ORDER  BY created_at ASC`,
      { ':id': ticket_id }
    );

    return ok(res, { ...ticket, notes });

  } catch (err) {
    console.error('[getTicket]', err);
    return fail(res, 500, 'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.');
  }
}

/* ─────────────────────────────────────────────────────────────
   4. PUT /api/tickets/:ticket_id  — Update status and/or add note
   ───────────────────────────────────────────────────────────── */

/**
 * Updates a ticket's status, adds a note, or both simultaneously.
 * The entire operation is wrapped in a transaction so a partial
 * write (status saved, note failed) cannot happen.
 */
async function updateTicket(req, res) {
  try {
    const { ticket_id } = req.params;

    // ── Validate body ────────────────────────────────────────
    const fields = validateUpdateBody(req.body);

    if (fields._base) {
      return fail(res, 400, 'VALIDATION_ERROR', fields._base, {});
    }

    if (Object.keys(fields).length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR',
        'Request body contains invalid or missing fields.', fields);
    }

    // ── Check ticket exists ───────────────────────────────────
    const existing = queryOne(
      'SELECT ticket_id, status FROM tickets WHERE ticket_id = :id',
      { ':id': ticket_id }
    );

    if (!existing) {
      return fail(res, 404, 'NOT_FOUND',
        `Ticket ${ticket_id} does not exist.`);
    }

    const { status, note } = req.body;
    let noteAdded = false;

    transaction(() => {
      // Update status only when provided
      if (status !== undefined) {
        runInTx(
          `UPDATE tickets SET status = :status WHERE ticket_id = :id`,
          { ':status': status, ':id': ticket_id }
        );
      }

      // Insert note only when provided
      if (note && note.trim().length > 0) {
        runInTx(
          `INSERT INTO notes (ticket_id, note_text) VALUES (:ticket_id, :note_text)`,
          { ':ticket_id': ticket_id, ':note_text': note.trim() }
        );
        noteAdded = true;
      }
    });

    // Return the ticket's new updated_at timestamp
    const updated = queryOne(
      'SELECT ticket_id, status, updated_at FROM tickets WHERE ticket_id = :id',
      { ':id': ticket_id }
    );

    return ok(res, {
      ticket_id:  updated.ticket_id,
      status:     updated.status,
      updated_at: updated.updated_at,
      note_added: noteAdded,
    });

  } catch (err) {
    console.error('[updateTicket]', err);
    return fail(res, 500, 'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.');
  }
}

/* ─────────────────────────────────────────────────────────────
   EXPORTS
   ───────────────────────────────────────────────────────────── */
module.exports = {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
};