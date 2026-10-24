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

## What's where

- **Visitors**: browse the portfolio, check the live calendar, book a sewa (service → date → time slot → details),
  and get a Booking ID.
- **`/manage`**: look up a booking with the ID and phone number, then cancel it with a reason.
- **`/admin`**:
  - **Bookings**: confirm, complete, cancel with a reason, restore or delete. Customer cancellation reasons show here.
  - **Sewa services**: add, edit, hide, reorder or delete sewas, and choose which time slots each one is offered in.
  - **Schedule**: edit the daily time slots and block dates when the jatha is unavailable.
  - **Site settings**: name, taglines, about text, photo, contact details, stats, gallery images and testimonials.

Each time slot takes one booking per day, across all sewas, because there is one jatha.

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
