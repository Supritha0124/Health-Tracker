# Health Tracker — Personal Health Tracking System

A full-stack web application that lets patients securely store medical records,
track medications and appointments, and share records with doctors via
time-limited links.

## Tech Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (no build step required)
- **Backend:** Node.js + Express.js, REST API
- **Authentication:** JWT (JSON Web Tokens) with bcrypt password hashing
- **Database:** Lightweight embedded JSON data store (zero native dependencies,
  drop-in replaceable with MySQL/PostgreSQL — see "Swapping the database" below)
- **File uploads:** Multer (PDF, JPG, PNG, DOC/DOCX up to 10MB)

## Project Structure

```
health-tracker/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── db.js                  # Data store (JSON-file based)
│   ├── middleware/auth.js     # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js            # Register, login, profile
│   │   ├── records.js         # Medical records + file upload + sharing
│   │   ├── appointments.js    # Appointment CRUD
│   │   ├── medications.js     # Medication tracker CRUD
│   │   └── admin.js           # Admin stats (admin role only)
│   ├── uploads/                # Uploaded medical record files
│   └── package.json
└── frontend/
    ├── index.html              # Sign in page
    ├── register.html           # Registration page
    ├── dashboard.html          # Health dashboard / overview
    ├── records.html            # Medical records management
    ├── appointments.html       # Appointment tracker
    ├── medications.html        # Medication tracker
    ├── profile.html            # User profile
    ├── css/style.css
    └── js/ (api.js, sidebar.js)
```

## Setup & Run Locally

**Prerequisites:** Node.js 16+ installed (download from nodejs.org).

```bash
cd backend
npm install
npm start
```

The server starts on **http://localhost:5000** and serves both the API
(`/api/...`) and the frontend pages from the same port — just open
`http://localhost:5000` in your browser.

No separate frontend server, no database installation, and no `.env` file
are required to get started. A `health_tracker.json` data file is created
automatically on first run.

## Using the App

1. Open `http://localhost:5000/register.html` and create an account (full
   name, email, password, and optional phone/DOB/gender/blood group).
2. You're redirected to the sign-in page — log in with your new credentials.
3. From the dashboard you can:
   - Upload and manage **medical records** (PDF/image/Word files), and
     generate a **shareable link** to send a record to a doctor.
   - Schedule, edit, and track **appointments**.
   - Add, edit, and track **medications** (mark them active/stopped).
   - Update your **profile** details.
4. Log out from the sidebar; your session token is cleared and you're
   returned to the sign-in page.

There is no pre-filled or seed data — every account starts empty and all
data shown is whatever you, the logged-in user, have entered.

## Security Notes

- Passwords are hashed with bcrypt (10 salt rounds) before storage — plaintext
  passwords are never saved.
- All data routes (records, appointments, medications, profile) require a
  valid JWT sent as `Authorization: Bearer <token>`; requests without one
  return `401 Unauthorized`.
- Each user can only see and modify their own data — every database query is
  scoped by the logged-in user's ID.
- Shared record links use a random, unguessable token and expire after a
  configurable number of days.
- Change `JWT_SECRET` in `backend/middleware/auth.js` (or set it via a
  `.env` file) before deploying anywhere beyond local development.

## Swapping the Database

The assignment's suggested stack lists MySQL/PostgreSQL. `backend/db.js`
currently uses a dependency-free JSON file store so the project runs
immediately on any machine without configuring a database server. To switch
to a real RDBMS:

1. Install a driver, e.g. `npm install mysql2` or `npm install pg`.
2. Replace the contents of `db.js` with a connection pool and convert the
   `?`-placeholder SQL strings already used throughout `routes/*.js` to your
   driver's query method (most Node MySQL/Postgres clients support the same
   parameterized-query pattern, so the route files need little to no change).
3. Re-run the `CREATE TABLE` statements (kept as comments/reference in the
   original schema design) against your database.

## Known Limitations / Next Steps

- The "Admin Module" currently exposes basic system stats via `/api/admin`
  but there's no dedicated admin UI page — promote a user by manually
  setting `role: "admin"` in `health_tracker.json` and call the endpoint
  directly to test it.
- No password-reset/forgot-password flow yet.
- No automated test suite (recommended next step: add Jest + Supertest for
  the API routes).
