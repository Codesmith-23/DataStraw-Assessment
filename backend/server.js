/**
 * server.js
 *
 * Main Express entry point for the Support CRM backend.
 *
 * Responsibilities:
 *   1. Bootstrap the sql.js SQLite database (async init, must complete before
 *      the server accepts connections).
 *   2. Apply global middleware: JSON body parser, CORS.
 *   3. Mount the /api/tickets router.
 *   4. Asset strategy:
 *        • Development  – Vite dev server runs independently on port 5173;
 *          the backend serves only API routes. No static middleware needed.
 *        • Production   – "Model A" monolithic serving: express.static points
 *          at the frontend build output so a single process handles both API
 *          requests and the React SPA.
 *   5. Centralized, 4-argument error-handling middleware as the final layer.
 */

'use strict';

const path    = require('path');
const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const { initDb }    = require('./config/database');
const ticketRoutes  = require('./routes/tickets');

/* ─────────────────────────────────────────────────────────────
   CONFIGURATION
   ───────────────────────────────────────────────────────────── */

const PORT     = process.env.PORT     || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/* In production the React app is pre-built into frontend/dist */
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist');

/* ─────────────────────────────────────────────────────────────
   APP SETUP
   ───────────────────────────────────────────────────────────── */

const app = express();

/* ── Global middleware ────────────────────────────────────────── */

/**
 * CORS
 *
 * Development : allow Vite's hot-reload dev server (port 5173) to reach
 *               this API without browser CORS errors.
 * Production  : same origin — the SPA is served by this same Express process,
 *               so cross-origin requests are not necessary. The wildcard origin
 *               is kept for API consumers (e.g. Postman, mobile clients).
 */
const corsOptions = {
  origin:
    NODE_ENV === 'production'
      ? '*'                                     // single-process monolith; adjust to your domain if needed
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.use(cors(corsOptions));

/**
 * JSON body parser
 *
 * Limits request bodies to 1 MB to guard against excessively large payloads.
 * The body is available as req.body in all downstream handlers.
 */
app.use(express.json({ limit: '1mb' }));

/* Convenience: also parse URL-encoded form bodies (e.g. from curl -d) */
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ── API routes ───────────────────────────────────────────────── */

/**
 * All ticket endpoints are mounted under /api/tickets.
 *
 * Final route table:
 *   POST   /api/tickets
 *   GET    /api/tickets
 *   GET    /api/tickets/:ticket_id
 *   PUT    /api/tickets/:ticket_id
 */
app.use('/api/tickets', ticketRoutes);

/* ── Health check ─────────────────────────────────────────────── */

/**
 * GET /api/health
 *
 * Lightweight liveness probe. Returns the current server timestamp and
 * environment so load-balancers / CI pipelines can verify the process
 * is alive without touching the database.
 */
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status:      'ok',
      environment: NODE_ENV,
      timestamp:   new Date().toISOString(),
    },
  });
});

/* ── 404 handler for unknown /api/* routes ────────────────────── */

/**
 * Catch-all for any /api/* route that wasn't matched above.
 * This must be registered BEFORE express.static so that unknown API
 * paths get a proper JSON 404 instead of the SPA's index.html.
 */
app.use('/api/*splat', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code:    'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    },
  });
});

/* ── Production static asset serving (Model A) ───────────────── */

/**
 * "Model A" — Monolithic Asset Serving
 *
 * When NODE_ENV is 'production', Express serves the compiled React SPA
 * directly from frontend/dist. This removes the need for a separate web
 * server (Nginx, Caddy) for the front-end assets, keeping the deployment
 * footprint to a single Node.js process.
 *
 * How it works:
 *   1. express.static serves exact file matches (JS chunks, CSS, images …).
 *   2. The wildcard GET below catches any remaining paths (e.g. /tickets/TKT-001)
 *      and returns index.html so React Router can handle client-side navigation.
 *
 * In development this block is intentionally skipped — Vite's dev server
 * provides HMR, source maps, and fast refresh on port 5173 instead.
 */
if (NODE_ENV === 'production') {
  /* Serve hashed static assets with long-lived cache headers */
  app.use(
    express.static(FRONTEND_DIST, {
      maxAge: '1y',          // immutable hashed filenames from Vite build
      etag:   true,
      index:  false,         // let the catch-all below handle /
    })
  );

  /* SPA catch-all: return index.html for every non-file, non-API route */
  app.get('/(.*)', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

/* ─────────────────────────────────────────────────────────────
   CENTRALIZED ERROR-HANDLING MIDDLEWARE
   ───────────────────────────────────────────────────────────── */

/**
 * Global error handler
 *
 * Express identifies an error-handling middleware by its four-argument
 * signature (err, req, res, next). It must be registered LAST, after all
 * routes and other middleware.
 *
 * Catches:
 *   • Errors passed via next(err) from any route or middleware.
 *   • Synchronous throws inside Express 5 async route handlers
 *     (Express 5 auto-wraps async routes, so no express-async-errors
 *     shim is required here).
 *
 * Response shape mirrors the controller's fail() helper so the frontend
 * always receives a consistent { success, error: { code, message } } envelope.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  /* Log the full stack in every environment for diagnostics */
  console.error('[GlobalErrorHandler]', err);

  /* Respect an explicit HTTP status attached to the error object,
     fall back to 500 for anything unspecified. */
  const httpStatus = typeof err.status === 'number' ? err.status : 500;

  /* Expose the real error message only in development.
     In production, generic 5xx messages hide implementation details. */
  const message =
    NODE_ENV !== 'production' && err.message
      ? err.message
      : 'An unexpected server error occurred. Please try again later.';

  res.status(httpStatus).json({
    success: false,
    error: {
      code:    err.code || 'INTERNAL_ERROR',
      message,
    },
  });
});

/* ─────────────────────────────────────────────────────────────
   SERVER BOOTSTRAP
   ───────────────────────────────────────────────────────────── */

/**
 * initDb() must resolve before we start accepting HTTP connections.
 * If the database fails to initialise (e.g. disk full, corrupted file),
 * the process exits with a non-zero code so the host/orchestrator can
 * restart it or raise an alert.
 */
async function start() {
  try {
    await initDb();
    console.log('[Server] Database ready.');

    app.listen(PORT, () => {
      console.log(`[Server] Listening on http://localhost:${PORT}  (${NODE_ENV})`);

      if (NODE_ENV === 'development') {
        console.log('[Server] API base : http://localhost:%d/api', PORT);
        console.log('[Server] Front-end: http://localhost:5173  (Vite dev server)');
      } else {
        console.log('[Server] Serving React SPA from', FRONTEND_DIST);
      }
    });
  } catch (err) {
    console.error('[Server] FATAL — failed to initialise database:', err);
    process.exit(1);
  }
}

start();
