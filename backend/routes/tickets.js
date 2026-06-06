/**
 * routes/tickets.js
 *
 * Declares all REST endpoints for the /api/tickets resource and
 * delegates every request to the matching controller function.
 *
 * Route map:
 *   POST   /api/tickets              → createTicket
 *   GET    /api/tickets              → getTickets   (supports ?status, ?search, ?page, ?limit)
 *   GET    /api/tickets/:ticket_id   → getTicket    (full detail + embedded notes)
 *   PUT    /api/tickets/:ticket_id   → updateTicket (status change and/or add note)
 */

'use strict';

const { Router } = require('express');

const {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
} = require('../controllers/ticketsController');

const router = Router();

/* ── Collection endpoints ─────────────────────────────────────── */

/**
 * POST /api/tickets
 * Body: { customer_name, customer_email, subject, description }
 * Returns 201 with the created ticket on success.
 */
router.post('/', createTicket);

/**
 * GET /api/tickets
 * Query params: status?, search?, page?, limit?
 * Returns 200 with a paginated array of ticket summaries + meta.
 */
router.get('/', getTickets);

/* ── Single-resource endpoints ────────────────────────────────── */

/**
 * GET /api/tickets/:ticket_id
 * Param: ticket_id — human-readable ID string, e.g. "TKT-001"
 * Returns 200 with full ticket detail including notes array.
 */
router.get('/:ticket_id', getTicket);

/**
 * PUT /api/tickets/:ticket_id
 * Param: ticket_id — human-readable ID string, e.g. "TKT-001"
 * Body:  { status?, note? }  — at least one field required
 * Returns 200 with the updated ticket_id, status, updated_at, and note_added flag.
 */
router.put('/:ticket_id', updateTicket);

module.exports = router;
