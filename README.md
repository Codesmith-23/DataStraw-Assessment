# DataStraw Support CRM

A comprehensive, full-stack Support Ticketing CRM engineered as a single-process monolith. 

This application was designed to provide a high-throughput environment for support agents, moving beyond standard CRUD operations to include server-authoritative business logic, dynamic priority tracking, and a streamlined monolithic deployment architecture. The API, database, and client interface are unified under a single Express routing engine.

---

## 🔗 Live Links
* **Live Demo:** [Insert Render URL here]
* **Video Walkthrough:** [Insert Loom Link here]
  > *Note: The application is deployed on Render's free tier, which utilizes an ephemeral disk. The local SQLite database will reset to zero tickets after 15 minutes of server inactivity. Please watch the video walkthrough to see the populated data in action.*

---

## ✨ Core Features

* **Full Ticket Lifecycle Management:** End-to-end CRUD capabilities allowing agents to create detailed support requests, update statuses (Open, In Progress, Resolved), and manage data seamlessly through RESTful API integration.
* **Server-Authoritative SLA Engine:** Client applications are never trusted with time calculations. When an 'Urgent' or 'High' priority ticket is generated, the backend calculates the strict expiration threshold and locks an immutable ISO timestamp directly into the database. 
* **Single-Process Monolith:** Eliminates CORS overhead and cross-origin payload issues by housing both the REST API and the compiled static frontend within the exact same Express routing engine.
* **"Executive Fintech" UI Language:** A stark, high-contrast, data-dense interface stripped of generic rounded corners and soft drop-shadows. The UI prioritizes cognitive speed and data clarity for agents handling dense ticket queues.

---

## 🏗️ Architecture 

This project utilizes a **Monolithic Architecture** rather than a decoupled serverless approach.

1. **The Engine:** Powered by Node.js and the bleeding-edge **Express 5** framework.
2. **API Layer:** Express handles all REST API endpoints under the `/api/tickets` router, interacting directly with the local SQLite database.
3. **Static Serving:** For production deployment, Express catches all non-API routes and serves the compiled Vite React SPA directly from the `frontend/dist` folder. 
4. **Regex Routing Bypass:** To accommodate Express 5's overhaul of the `path-to-regexp` engine, traditional string wildcards (`'*'`) for SPA routing were bypassed using raw, native JavaScript regular expressions (`/.*/`) to prevent Status 1 deployment crashes.

---

## 💻 Tech Stack

**Frontend**
* React 18 & Vite
* Tailwind CSS
* React Router DOM

**Backend**
* Node.js & Express.js (v5)
* SQLite3 (Local storage)
* CORS & Dotenv

**Deployment & CI/CD**
* Hosted on **Render.com**
* Custom root-level scripts for concurrent container deployment.

---

## 📂 File & Directory Structure

The repository is structured to separate concerns while allowing a single root command to build and deploy the entire application.

```text
DataStraw-Assessment/
├── frontend/                     # React SPA
│   ├── src/                      
│   │   ├── components/           # Reusable UI (Forms, SLA Badges, Layout)
│   │   ├── pages/                # Main views (Dashboard, Ticket Details)
│   │   ├── App.jsx               # React Router & client-side routing
│   │   └── main.jsx              # DOM entry point
│   ├── index.html                # Vite HTML template
│   ├── vite.config.js            # Bundler configuration
│   └── package.json              
│
├── backend/                      # Express API & Database
│   ├── config/                   
│   │   └── database.js           # SQLite3 initialization & table schemas
│   ├── controllers/              
│   │   └── ticketController.js   # Core business logic, SLA math, and CRUD execution
│   ├── routes/                   
│   │   └── tickets.js            # Express API endpoint definitions
│   ├── server.js                 # Monolith entry point & static serving logic
│   └── package.json              
│
├── package.json                  # ROOT: CI/CD deployment & build scripts
└── README.md
