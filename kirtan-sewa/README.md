# Kirtan Sewa — portfolio & booking website

React + Framer Motion + Lenis front end, with a small Express API that stores everything in `data/db.json`.

## Run it

```bash
npm install
npm run dev          # site: http://localhost:5173   admin: http://localhost:5173/admin
```

Default admin password is `waheguru`. **Change it before going live** (see below).

## Production

```bash
npm run build
ADMIN_PASSWORD='your-strong-password' PORT=3000 npm start   # then open http://localhost:3000
```

`npm start` serves both the API and the built site from one Node process, so any host that runs Node works
(VPS, Render, Railway, Fly.io, Hostinger Node hosting…). Bookings are saved to `data/db.json`. Keep that
folder on persistent storage and back it up. Set `DATA_DIR=/some/path` to store it somewhere else.

| Env var          | Purpose                                   | Default        |
| ---------------- | ----------------------------------------- | -------------- |
| `ADMIN_PASSWORD` | Admin panel password                      | `waheguru`     |
| `PORT`           | Port for the server                       | `5174`         |
| `DATA_DIR`       | Folder for `db.json`                      | `./data`       |
| `TOKEN_SECRET`   | Signs admin sessions (auto-generated)     | stored in db   |
| `DATABASE_URL`   | Postgres connection string; when set, data goes to Postgres instead of `DATA_DIR` | — |
| `KEEP_ALIVE_URL` | Public address to ping every 10 min (Render sets `RENDER_EXTERNAL_URL` itself) | — |
| `KEEP_ALIVE`     | Set to `off` to disable the keep-awake ping | on             |

## Deploy free on Render (with Neon Postgres)

Render's free plan wipes the disk on every deploy and restart, so bookings must live in a database.
When `DATABASE_URL` is set the app stores everything (bookings, settings, the UPI QR) in Postgres.

1. **Database**: sign up at neon.tech, create a project (region: *AWS Asia Pacific (Singapore)*), and copy the
   connection string (`postgresql://…?sslmode=require`).
2. **GitHub**: push this folder to a new repository. `data/`, `dist/` and `node_modules/` are git-ignored.
3. **Render**: New → **Blueprint** → pick the repo. `render.yaml` sets the build, start and health check.
   Fill in `ADMIN_PASSWORD` and `DATABASE_URL` → **Apply**.
4. The site is live at `https://<name>.onrender.com` (admin: `/admin`).

**Staying awake:** free Render sites sleep after 15 idle minutes. While running, the app pings its own
`/api/health` every 10 minutes (Render provides `RENDER_EXTERNAL_URL`). As a backup that can also wake a sleeping
site, add a free monitor at cron-job.org or uptimerobot.com for `https://<name>.onrender.com/api/health`.
One always-on free service uses about 744 of the 750 free hours a month, so keep only one free service running.

**Moving local bookings:** run the app once on your computer with `DATABASE_URL=… npm start`. If the database is
empty, it copies `data/db.json` into it. Upload the UPI QR again afterwards.

## What's where

- **Visitors**: browse the portfolio, check the live calendar and book sewa. They choose a sewa, then tap as many
  time slots as they need across any dates (switching sewa in between if they like), enter their details once,
  and submit everything together (up to 20 slots). Each slot becomes its own booking with its own ID, linked by a
  group ID. Either all the slots are booked or none are.
- **Calendar**: anyone can see which slots are booked, what sewa each is for, and the venue address.
  Visitors must choose their sewa first. Nothing is pre-selected.
- **`/manage`**: customers enter only their phone number to see all their bookings, bills and payments.
  They can **request** a cancellation with a reason. The booking stays active until you approve it.
- **`/admin`**:
  - **Bookings**: confirm, complete, cancel with a reason, restore or delete. The **Cancel requests** filter lists
    customers' cancellation requests, which you can **Approve** (this frees the slot) or **Reject** (with an optional message).
  - **Sewa services**: add, edit, hide, reorder or delete sewas, and choose which time slots each one is offered in.
  - **Schedule**: edit the daily time slots and block dates when the jatha is unavailable.
  - **Site settings**: name, taglines, about text, photo, contact details, stats, gallery images and testimonials.

Each time slot takes one booking per day, across all sewas, because there is one jatha.

## Light / dark mode

The site follows the visitor's phone or browser theme by default. The button in the navbar cycles through
Auto → Light → Dark, and the choice is remembered on that device.

## Payments & bills

1. **Site settings → Payments**: turn on UPI (enter your UPI ID, upload your QR image) and/or Cash.
2. A customer books. No payment is asked at this point.
3. In **Bookings**, click **Confirm & create bill** and enter the amount. This creates a numbered bill (2026-0001, 2026-0002…).
   Use **Send bill** to WhatsApp the customer the amount and a link to their bill.
4. The customer opens **Manage booking**, views or downloads the bill, and pays by UPI. They scan the QR or tap
   "Pay with UPI app", then enter their transaction ID (UTR). They can also pay cash on the day.
5. Back in **Bookings**, **Verify & mark paid** for UPI, or **Record payment** for cash or UPI received
   another way. The **Collected** card shows the total received.

The uploaded QR image is saved in `data/uploads/`.
