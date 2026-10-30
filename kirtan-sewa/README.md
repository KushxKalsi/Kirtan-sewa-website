# Kirtan Sewa — portfolio & booking website

React + Framer Motion + Lenis front end, with a small Express API. Data lives in Postgres tables (when `DATABASE_URL` is set) or in `data/db.json` locally.

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
| `DATABASE_URL`   | Postgres connection string; when set, data goes to Postgres tables instead of `DATA_DIR` | — |
| `PHOTON_URL`     | Place search service for the map picker   | `https://photon.komoot.io` |
| `KEEP_ALIVE_URL` | Public address to ping every 10 min (Render sets `RENDER_EXTERNAL_URL` itself) | — |
| `KEEP_ALIVE`     | Set to `off` to disable the keep-awake ping | on             |

## Deploy free on Render (with Neon Postgres)

Render's free plan wipes the disk on every deploy and restart, so bookings must live in a database.
When `DATABASE_URL` is set the app stores everything (bookings, settings, the UPI QR) in Postgres.

1. **Database**: sign up at neon.tech, create a project (region: *AWS Asia Pacific (Singapore)*), and copy the
   connection string (`postgresql://…?sslmode=require`).
2. **GitHub**: push this folder to a new repository. `data/`, `dist/` and `node_modules/` are git-ignored.
3. **Render**: New → **Blueprint** → pick the repo. `render.yaml` (at the repo root) sets the build, start and health check.
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
- **`/login`**: customers (sangat) and team members log in with their mobile number and password. Customers can
  create an account there or in the last booking step, and land on the booking calendar after logging in. Team
  members create their own account there too, choosing Head Ragi, Side Ragi or Tabla, picking where they are based on the map (required) and adding their documents (Aadhaar card required; jatha photos and bank
  proof optional); it waits under **Team →
  Waiting for approval** until the admin approves it (and ticks their sewas). The admin can still add people directly.
- **`/account`** (customers): their bookings, bills and payments, map location, price offers, cancellation
  requests, and a chat with the jatha. `/manage` now redirects here.
- **`/team`** (team members): their sewas, profile and documents, team bookings and a chat with the admin.
- **`/admin`**:
  - **Bookings**: confirm, complete, cancel with a reason, restore or delete. The **Cancel requests** filter lists
    customers' cancellation requests, which you can **Approve** (this frees the slot) or **Reject** (with an optional message).
  - **Sewa services**: add, edit, hide, reorder or delete sewas, and choose which time slots each one is offered in.
  - **Schedule**: edit the daily time slots and block dates when the jatha is unavailable.
  - **Site settings**: name, taglines, about text, photo, contact details, stats, gallery images and testimonials.

Each time slot takes one booking per day, across all sewas, because there is one jatha.

## Requests, blocked times and custom times

- Bookings never block a time. Anyone can request any time, even one already requested or confirmed, and two
  different sewas can share a time. Confirmed bookings show on the public calendar (sewa and venue) for
  information, but the time stays open.
- A time is **not available** only when you block it: Admin → Schedule → **Blocked times** (pick a date, then
  slots and/or a from–to time, with a private note). Or open a booking and tap **Block this time on the
  calendar**; tap again to unblock. Blocking a whole day still works under **Unavailable dates**.
- In admin, bookings that share a time are tagged ("2 other bookings at this time") so you can decide.
- Besides the fixed slots, customers can enter **their own time** (start and end, at least 30 minutes). It's
  refused only if it overlaps a blocked time. Turn this off in Site settings ("Let customers enter their own
  time").
- All dates and times use Indian time (`TZ=Asia/Kolkata` is set by the server; override with the `TZ` env var).

## Categories, team and assignments

- **Categories** (admin → Categories): the first choice when booking, e.g. *Kirtan with Raag* (all sewas) and
  *Kirtan with Kavishri* (Kirtan Diwan only). Visitors pick a category, then only its sewas show. A category with
  a single sewa selects it automatically. One booking can mix categories (each slot keeps its own).
- **Team** (admin → Team): add people and tick what each one does, per category, e.g. "Kavishri → Kirtan Diwan".
  Inactive people can't be assigned.
- **Assigning:** open a booking and use **Assigned to**. Only people who do that sewa in that category are listed.
  You can assign several people, and each slot of a multi-slot booking separately. The **Not assigned** filter
  shows upcoming bookings with nobody assigned. Names stay on bookings even if a person is later removed.
- The customer sees who is doing their sewa, with that person's address, under Manage booking.
- **Team members' own page:** a team member opens **Manage booking** and enters their own phone number (the
  one saved in Team). They see every sewa they're assigned to, with date, exact time, venue (map link), and
  the customer's name and phone. They can turn on notifications there.
- **Team notifications:** a person is notified when they're assigned or removed, and when that booking is
  cancelled. They also get a reminder **on the day** (6 AM, or 8 PM the evening before for slots starting by
  8 AM) and **2 hours before** the start. Assigning waits 30 seconds to settle, so ticking people on and off
  sends one message.

## Gurpurab (Prakash Purab, Jyoti Jot Divas, Shaheedi Purab)

- **Admin → Gurpurab** lists the Prakash Purab and Jyoti Jot Divas of all ten Gurus, the Shaheedi Purab of Guru
  Arjan Dev Ji and Guru Tegh Bahadur Ji, and the Bhagats in the SGPC calendar (Ravidas Ji, Dhanna Ji,
  Kabir Ji). Dates are from the SGPC calendar for Nanakshahi 558 (March 2026 – March 2027). Add others with
  **Add day**.
- Most of these follow the moon, so dates change every year. When the SGPC publishes the new Jantri, open each
  day under "Passed this year" and set its new date.
- **Home page carousel:** upcoming days, with the pictures you add to each (posters or photos, any shape, up
  to 8 per day). A day without pictures gets a designed card with the name in Gurmukhi. Visitors can swipe,
  and **Book kirtan for this day** opens that date in the booking calendar.
- **Calendar:** Gurpurab days have a coloured dot, and the day's panel names the Gurpurab.
- **One month before** each day (10 AM), every device with notifications on gets a reminder: customers, team
  members, admins, and visitors who tapped **Remind me** in the Gurpurab section (no booking needed). The
  reminder includes the first picture. It's sent once per date. Use the send button on a day to send it
  again, or to send one for a day you added late.

## Low-end phones

The site measures the device as it loads: 2 GB RAM or less, 4 CPU cores or fewer on a touch screen, data saver,
or a frame rate under ~40 fps during the first seconds. On a slow phone it keeps the same layout and animations
but drops the costly effects: frosted glass blur, film grain, blur-in reveals, the mandala's line drawing, and
smooth-scroll. It also uses fewer particles at 30 fps. Mid and high-end devices get everything.

To force a mode while testing, open the site with `?perf=low` or `?perf=high`; `?perf=auto` goes back to
automatic.

## Light / dark mode

The site follows the visitor's phone or browser theme by default. The button in the navbar cycles through
Auto → Light → Dark, and the choice is remembered on that device.

## Notifications

After booking, and on the Manage booking page, customers can tap **Turn on notifications**. Their phone or
computer is then notified when you confirm (with the bill amount and a "tap to pay" link), change the bill,
mark it paid, cancel, or answer a cancellation request. It uses standard Web Push, with no outside service: the
signing keys are created on first start and kept in the database. iPhone users must first add the site to their
Home Screen (Share → Add to Home Screen) and open it from there. The admin panel shows "Notifications on" for
customers who turned them on.

**Admin notifications:** in /admin, tap **Turn on notifications** on each phone or computer where you want alerts.
That device is then notified about every customer action: new bookings (including multi-slot ones), UPI payments
to verify, cancellation requests and withdrawals, and switches between UPI and cash. Tapping a notification opens
/admin with that booking already searched. Use **Notifications on → Send test** to check a device.

## Payments & bills

1. **Site settings → Payments**: turn on UPI (enter your UPI ID, upload your QR image) and/or Cash.
2. A customer books and chooses **UPI** or **Cash**. They can switch under Manage booking until they have paid.
3. In **Bookings**, click **Confirm & create bill** and enter the amount. This creates a numbered bill (2026-0001, 2026-0002…).
   Use **Send bill** to WhatsApp the customer the amount and a link to their bill.
4. The customer opens **Manage booking**, views or downloads the bill, and pays by UPI. They scan the QR or tap
   "Pay with UPI app", then enter their transaction ID (UTR). They can also pay cash on the day.
5. Back in **Bookings**, **Verify & mark paid** for UPI, or **Record payment** for cash or UPI received
   another way. The **Collected** card shows the total received.

The uploaded QR image is saved in `data/uploads/`.

## Logins, accounts and chat

- **Customers** must be logged in to send a booking. The booking is linked to the account and its mobile number;
  older bookings made with the same number show up in the account too. Forgotten password: admin → **Sangat
  accounts** → key button sets a new one (there is no SMS, so tell them on the phone).
- **Team members** log in at **Team login** (footer) with the mobile number saved in admin → Team. Set their
  password in the Team form (it can be reset there any time). Changing a password logs out other devices.
- **Chat:** every customer and team member has one conversation with the admin, with a **Call** button on both
  sides. Admin → **Chat** lists them with unread counts; the + button starts a new one. Each new message is a phone
  notification for the other side (if they turned notifications on).

## Offers and commission

- A customer can offer their own amount, at least ₹1,500 (Site settings → Payments → "offer their own amount
  from"), while booking or later from their account. It appears on the booking and in the chat. **Accept** makes it
  the bill (and confirms a pending booking); **Set another amount** opens the usual bill form; **Decline** sends
  your message to their chat.
- **Commission:** 10% of each bill above ₹3,500 (both editable in Site settings → Payments). Amounts show only in
  the admin Bookings tab (per booking and in total). The site footer carries one line about it in small print.

## Team: roles, profile, sewas, bhet and leave

- Roles: **Head Ragi**, **Side Ragi**, **Tabla** (set in admin → Team; filter by role there).
- Team members fill in their profile: name, father's name, experience, address, map location, bank account, and
  upload the jatha head photo, jatha photo, Aadhaar card and bank passbook / cancelled cheque (photo or PDF, 5 MB).
  Documents open only through short-lived signed links, for that member and the admin (Team → ID card button).
- **Sewas:** they see upcoming and done sewas, with their bhet and totals. They **confirm** each sewa (you see
  "✓" on the booking), or ask to be taken off — not within 2 days of the program. You approve or reject that on
  the booking.
- **Bhet:** set it per person on each booking (a person's "usual bhet" fills it in when they're assigned). If they
  ask for a different amount it lands in the chat, where you can set any amount directly.
- **Team booking** (the old "leave"): a team member asks for someone to go in their place. They pick the days and
  say why, then for each request choose **Head Ragi, Side Ragi or Tabla** and the bhet they offer (at least ₹200) —
  they don't choose the person. If they have sewas in those days, each sewa gets its own request; otherwise they add
  as many requests as they need, each on a day and optional time. They can add a map pin for where to go. A request
  starting in less than 1 day is still sent, marked **Emergency**, and one can't be withdrawn within 1 day of its
  start. Admin → **Team bookings** lists each request with a choice of people (the role asked for first, nearest
  first); **Assign & approve** needs a person for every request, hands the sewas over at the bhet offered (one person
  can't be in two places at once) and notifies everyone. Assigned people see it on their **Team booking** page. People on approved leave can't be assigned on those days, and any booking can
  also be handed to someone else with **Replace** under its team.

## Map location and nearest team member

- In the booking form the customer types the venue and picks the exact place from the suggestions (or uses their
  current location, or pastes a Google Maps link). A Google map preview shows the pin. They can add or change it
  later from their account.
- Team members pin where they are based in their profile.
- On a booking, the people who can do that sewa are listed **nearest first** with the distance (straight line), and
  each assigned person has a link to directions.

## Database tables (Postgres)

One table per kind of record, each with `id`, a few typed columns for searching and reporting, the full record in
`data` (jsonb) and `updated_at`: `bookings`, `booking_assignments` (who does each booking, bhet, confirmed),
`users`, `team_members`, `leave_requests`, `chat_messages`, `chat_threads`, `services`, `categories`,
`time_slots`, `blocked_dates`, `blocked_times`, `gurpurabs`, `settings`, `push_subscriptions`, `app_meta`, and
`files` (UPI QR, Gurpurab pictures, team documents, as bytea). Password hashes are kept only in their own column.
Only rows that changed are written. On the first start after upgrading, the data in the old single `sewa_store`
table is copied into the new tables automatically; `sewa_store` is left untouched as a backup.
