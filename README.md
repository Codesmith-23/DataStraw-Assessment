# DataStraw Support CRM

A comprehensive, full-stack Support Ticketing CRM engineered as a single-process monolith. 

This application was designed to provide a high-throughput environment for support agents, moving beyond standard CRUD operations to include server-authoritative business logic, dynamic priority tracking, and a streamlined monolithic deployment architecture. The API, database, and client interface are unified under a single Express routing engine.

---

## 🔗 Live Links
* **Live Demo:** [Insert Render URL here]
* **Video Walkthrough:** [Insert Loom Link here]
 
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
```

## 🚀 Setup and Local Installation

### Prerequisites
Before you begin, ensure you have the following installed on your local machine:
* **Node.js** (v18.0.0 or higher recommended)
* **Git**

### Step-by-Step Installation

**1. Clone the repository**
```bash
git clone https://github.com/Codesmith-23/DataStraw-Assessment.git
cd DataStraw-Assessment
```

**2. Configure Environment Variables**
Navigate to the `backend` directory and create a `.env` file to store your local environment configurations.
```bash
cd backend
touch .env
```
Add the following to your `.env` file:
```env
PORT=5000
NODE_ENV=development
```
*Return to the root directory before proceeding:*
```bash
cd ..
```

**3. Install Dependencies & Build**
This project uses a unified root command to handle the monolithic setup. Running the following command will concurrently navigate into the `frontend` directory, install dependencies, compile the Vite production build into `frontend/dist`, and then install all `backend` dependencies:
```bash
npm run build
```

**4. Start the Application**
To boot the Express server (which will now serve both the API and the compiled React UI):
```bash
npm start
```

**5. Access the CRM**
Open your browser and navigate to:
`http://localhost:5000`

---

## ☁️ Deployment Strategy

This application is configured for a monolithic zero-config deployment on **Render**. 

### Deployment Steps
1. Log in to [Render.com](https://render.com/) and navigate to your dashboard.
2. Click **New +** and select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect this repository.
4. Configure the Web Service with the following exact settings:
   * **Name:** `datastraw-crm` (or your preferred name)
   * **Environment:** `Node`
   * **Build Command:** `npm run build`
   * **Start Command:** `npm start`
5. Click **Create Web Service**. Render will automatically provision the container, execute the build pipeline, and launch the Express server.

### Infrastructure Trade-Off: Ephemeral Database
This application is currently designed to run on Render's Free Tier instance to provide a live, accessible demo. 

**Important Note:** Render's Free Tier utilizes an **ephemeral disk**. This means the container spins down after 15 minutes of inbound traffic inactivity. When the container sleeps, the local `crm.db` SQLite file is permanently destroyed. 

Upon the next visitor request, Render will wake the container and execute the `database.js` initialization script, providing a fresh, empty database. 

**Why this trade-off was made:** For the scope of a technical assessment MVP, the primary goal was demonstrating a functional, self-contained monolithic architecture and server-side SLA logic. Implementing a persistent cloud database (e.g., Turso, AWS RDS, or PostgreSQL) would introduce unnecessary DevOps overhead for a demo environment. However, due to the project's Repository Pattern architecture, migrating from local SQLite to a persistent cloud URI requires only a single connection-string update in the `config/database.js` file.

---
*Architected and developed by Mohammed Moinuddin Shaikh.*
