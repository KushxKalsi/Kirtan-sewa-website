# Kirtan Sewa: change plan (for approval)

Status: **approved and built (4 Nov 2026).** Decisions: Q1 Cloudflare R2 (connected later; built-in storage until
then), Q4 **cash kept** for team bookings (UPI bookings need the payment step, cash ones are booked when the admin
confirms), all other questions as recommended. Setup steps for R2 and the AI key are in README → Posts.

The plan has 11 changes in 4 phases. Each change lists what the user sees, what changes in the code, and how it is
checked. The questions marked ❓ need your answer before that part is built. Where there is a ❓, the plan shows the
option I recommend.

---

## Questions to answer first

| # | Question | My recommendation |
|---|----------|-------------------|
| Q1 | **Where do photos, videos and audio get stored?** Today all files are saved as base64 in Postgres (Neon free = 0.5 GB). A few videos would fill it. | Use **Cloudinary free plan** (25 GB, resizes images and videos for us). The other choice is Cloudflare R2 (10 GB free, but no video resizing). |
| Q2 | **AI poster: what does "AI" make?** AI image tools often write Gurmukhi wrongly (broken letters). | Build the poster from a **fixed design like your example** (Khanda, blue and gold frames, member photo) and fill in the text automatically. AI (Claude API) only writes the Punjabi wording: title, venue in Gurmukhi, and the name line. Optional extra: an AI-made background picture. This needs an API key, and each poster costs about ₹1 or less. |
| Q3 | **Team booking advance:** is the advance the **full bhet** of the team booking, or a **separate advance of at least ₹200**, with the rest paid later? | Full bhet, paid by UPI, at least ₹200 for each person requested. This keeps the bills simple. |
| Q4 | **Team booking cash option:** remove cash completely? | Yes. Team bookings become **UPI only**. Old cash team bookings stay as they are. |
| Q5 | **Emergency kirtan:** extra charge? And may normal bookings still be made for today? | No extra charge (the admin can set the bill). Normal booking starts from **tomorrow**. Same-day booking only through **Emergency kirtan**, at least 2 hours ahead. |
| Q6 | **Likes:** who can like a post? | Anyone. Visitors who are not logged in like once per device. Logged-in customers like once per account. |
| Q7 | **Music on posts, "from the browser":** do you mean (a) a file from the phone, (b) recording in the browser, or (c) choosing from an online music library? | (a) + (b). For (c), copyrighted songs cannot be used legally. The admin can upload a small **Gurbani audio library** that members pick from. |
| Q8 | **Admin approval of posts:** do members' posts go live straight away or after the admin checks them? | Live straight away. The admin can hide or delete any post. |

---

## Phase 1: Quick fixes

### 1. Hide the notification card once notifications are on
**Now:** the "Notifications are on" card stays on the customer dashboard (`/account`), the team dashboard (`/team`)
and the booking success screen, even after it has been turned on.
**Change:**
- [NotifyButton.jsx](src/components/NotifyButton.jsx) shows nothing once `on` is true (permission granted and this
  phone is subscribed).
- To turn it off or test it, a small 🔔 icon goes in the dashboard header, next to Log out. It opens a small menu.
- Admin: [AdminNotify.jsx](src/admin/AdminNotify.jsx) is already a button in the header. Once on, it shrinks to the
  icon only. It keeps the same modal.
**Check:** turn notifications on, reload, and the card is gone on all 3 dashboards. Turn them off from the icon and
the card comes back.

### 2. Sewa choices shown one under another
**Now:** "Choose the sewa you want to book" shows small chips in a row that wrap
([Booking.jsx:407](src/sections/Booking.jsx#L407), `.svc-picker`).
**Change:** a **vertical list of cards**, one card per sewa: icon, name, Gurmukhi name, duration and a one-line
description. The chosen card is highlighted with the same animation as now. On phones they stay full width. The "type
of kirtan" cards in step 1 get the same vertical style so both steps look alike.
**Files:** `Booking.jsx`, `app.css` (`.svc-picker`, `.svc-chip`).

### 3. Gurgaddi Diwas in the Gurpurab section
**Change:**
- New kind `gurgaddi`: **Gurgaddi Diwas / ਗੁਰਗੱਦੀ ਦਿਵਸ**, added to `GURPURAB_KINDS` in
  [gurpurabs.js](server/gurpurabs.js) and to [GurpurabTab.jsx](src/admin/GurpurabTab.jsx).
- Add Gurgaddi Diwas for Guru Angad Dev Ji to Guru Gobind Singh Ji (9), plus **Sri Guru Granth Sahib Ji**. Dates
  come from the same SGPC Nanakshahi 558 jantri the file already uses, checked against the 2 sources named in the
  file.
- Existing databases do not get the new days automatically (they are seeded only once). A small startup step adds
  any seed day whose `id` is missing. It never changes days the admin has edited.
**Check:** the Gurpurab section on the site and Admin → Gurpurab list the new days in date order.

---

## Phase 2: Bookings and payments

### 4. Emergency kirtan (same day, at least 2 hours ahead)
**Change:**
- A **"🚨 Emergency kirtan"** button on the customer dashboard and at the top of the booking section. It opens a short
  form: sewa, start time, end time, venue and map pin. The date is fixed to today.
- Server: new flag `emergency: true` on the booking. `readItem` in [index.js](server/index.js) accepts today only
  when `emergency` is set and **the start is at least 2 hours from now** (India time). Otherwise it shows "Emergency
  kirtan must start at least 2 hours from now — earliest is 4:30 PM".
- Normal bookings: the earliest date becomes tomorrow (depends on Q5).
- Admin is alerted with 🚨 and the booking shows a red "Emergency" tag at the top of the Bookings list.
**Check:** an emergency booking 1h50m from now is refused, 2h05m is accepted. A normal booking for today is refused
(if Q5 = yes).

### 5. Customer payment needed before "Completed"
**Now:** the admin can press "Mark completed" at any time. A booking is also completed on its own when every team
member marks their part done ([index.js:1203](server/index.js#L1203)).
**Change:**
- Server: `PATCH /api/admin/bookings/:id` with `completed` is refused unless `paymentStatus === 'paid'` (cash
  recorded by the admin, or UPI checked by the admin). The automatic completion in `duties/:id/done` waits for
  payment too. The booking stays "Kirtan done, payment due".
- On the day of the kirtan, the customer's booking card shows a large **"Pay now (UPI)"** box with the QR, UPI link
  and UTR field, or "Paying cash", from the start time onwards.
- Admin Bookings: "Mark completed" is greyed out with the hint "Waiting for payment (cash or UPI)". It sits next to
  "Record cash" and "Verify UPI", and becomes active as soon as the payment is recorded.
- A new filter in Bookings: **Payment due** (kirtan done, not paid).
**Check:** an unpaid confirmed booking cannot be completed by the admin or by team "done". After recording cash it
can be.

### 6. Team booking: new steps, UPI advance before it is booked
**Now:** `pending → assigned → approved`. Payment (UPI or cash) can be sent at any time and does not hold anything up.
The sewa moves to the teammate as soon as they accept.

**New flow** (stored in `leaves`, as now):

```
1. Member sends request              status: pending        (admin alerted)
2. Admin assigns a teammate          status: assigned       (teammate asked)
3. Teammate accepts (2nd confirm)    status: accepted       (admin alerted)
4. Admin confirms to the member      status: awaiting-payment
      → member now sees the admin's UPI QR / UPI ID and the amount
5. Member pays and sends UTR         payment.status: submitted (admin alerted)
6. Admin verifies payment            status: booked ✅        (everyone notified)
      → only now the member's sewa is handed over to the teammate
```

- Minimum: **₹200 per person requested, UPI only** (Q3/Q4). The cash option is taken out of the team booking form.
  Old cash team bookings keep working the old way.
- The member can see each step on a **progress line** in the Team booking tab (the 6 steps above, with times).
- If the teammate declines at step 3, it goes back to step 1 for the admin, as now. If the admin rejects the payment
  at step 6, it goes back to step 5 with the admin's note.
- Admin Team booking tab: new buttons **"Confirm to member"** (step 4) and **"Payment received"** (step 6), and a
  badge count for each step that needs the admin.
- Files: `server/index.js` (leave routes, `liveLeave`, `teamPayload`), [LeaveTab.jsx](src/admin/LeaveTab.jsx),
  `TeamBooking` in [TeamDashboard.jsx](src/pages/TeamDashboard.jsx), and [PaymentBox.jsx](src/components/PaymentBox.jsx)
  reused for the QR.
**Check:** follow the 6 steps with 2 test team accounts. The sewa moves only after step 6. A payment below ₹200 per
person is refused.

---

## Phase 3: Posts, profiles and the AI poster

### 7. Posts (team members and admin)
**Who posts:** team members (from a new **Posts** tab in `/team`) and the admin (new **Posts** tab in `/admin`,
posting as the jatha or for a member).
**A post:** 1 to 10 photos or videos, a caption, optional music (item 9), optional link to the kirtan it was from,
and the date.
**Storage:** new `posts` list (and a Postgres `posts` table, like the other tables in [db.js](server/db.js)). Files go
to the storage chosen in **Q1**. Uploads go straight from the phone to the storage with a signed link, so big videos
do not pass through the free Render server. Photos are made smaller before upload. Videos are limited to 60 seconds
and 50 MB.
**Admin:** can hide or delete any post (Q8) and sees a "reported" count if visitors report a post.

### 8. Posts on the website: feed, likes, share, profiles
- **Home page:** a new **"Sewa in action"** section with the latest posts in a grid. It replaces the gallery when
  posts exist and falls back to the current gallery when there are none.
- **Each post:** photo or video, with a ❤️ like button and count, a **Share** button and the member's **profile chip
  under the image** (photo, name, role such as "Head Ragi").
  - Like: the rules from Q6. Likes are counted on the server, and liking twice from the same device or account counts
    once.
  - Share: the phone's own share sheet (WhatsApp and others) using the Web Share API. On computers: copy link and
    WhatsApp buttons. Each post has its own link, `/p/<id>`, with a preview image for WhatsApp.
- **Profile page** `/m/<member-id>`: opened from the profile chip. Shows the member's photo, name, role, area, number
  of kirtans done and total likes, with tabs for **Photos** and **Videos** in a grid. Tapping one opens it full screen
  and swipes to the next.
- New public API: `GET /api/posts`, `GET /api/posts/:id`, `GET /api/members/:id`, `POST /api/posts/:id/like`.
  No private data (phone, documents) is shown.

### 9. Music on posts
- When creating a post: **Add music** gives 3 choices:
  1. **From this phone:** pick an audio file (mp3/m4a, up to 10 MB).
  2. **Record:** record in the browser with the microphone, then play it back, record again or use it.
  3. **Gurbani library:** pick from tracks the admin uploaded (Q7).
- Choose the start point (a 30-second clip). On the site the music plays when the post is opened and is muted until
  tapped (browsers block sound that starts on its own).

### 10. "Generate poster" for a kirtan
**Where:** in the team dashboard, on a kirtan the admin gave them (My sewas), a **"Generate poster"** button.
**Steps:**
1. The form is filled in from the booking, and the member can edit it: occasion (for example Prakash Purab Sri Guru
   Nanak Dev Ji, suggested from the nearest Gurpurab), "Kirtan Hazri", village or venue, member name and "… wale"
   line, date and time, member photo (from their profile, or upload a new one).
2. **Generate:** AI (Q2) writes the Punjabi wording. The poster is drawn in the browser in the style of your example:
   Khanda at the top, title in the dark blue banner, village badge, name banner with a gold ribbon, and a date/time
   box with calendar and clock icons. Size 1024×1536.
3. Preview, with the choices **Post to my profile** (becomes a post, item 7), **Download** or **Discard**. Nothing is
   posted unless they choose to.
- Text is drawn with a Gurmukhi font (Noto Sans Gurmukhi / Mukta Mahee) so letters are always correct.
- Server: `POST /api/team/duties/:id/poster-text` calls the Claude API (key in a new env var
  `ANTHROPIC_API_KEY`). It is limited to a few per member per day to keep costs low.

---

## Phase 4: Dashboard redesign (admin, team, customer)

### 11. Cleaner, less crowded dashboards
**Problem now:** every tab is one long full-width column of cards. Everything is shown at once.
**New layout (same for all 3 dashboards):**
- **Desktop:** a slim **side menu** on the left (icons + names, badge counts) instead of the long row of tabs, and
  the content area in **2 columns**: the main list on the left (about 2/3), and a **side panel** on the right (about
  1/3) with "Needs your action" clipboard cards, today's sewas and quick buttons.
- **Phone:** a bottom tab bar with 4–5 main items plus "More". One column, with the side panel cards shown first as a
  swipeable row.
- **New "Overview" home tab** for each dashboard:
  - Admin: 4 number cards (requests waiting, today's kirtans, payment due, team bookings waiting), a "Needs action"
    list and this week's timeline.
  - Team: next kirtan countdown, sewas waiting for "yes", team booking steps, latest likes on their posts.
  - Customer: next booking card with its status line, payment due, Emergency kirtan button and chat.
- **Cards:** more space between them, a clear title row, details folded away behind "More" and actions kept at the
  bottom of each card. Long lists get filters and search at the top instead of showing everything.
- Same colours, fonts and dark/light theme as now. A new shared `DashShell` component used by `AdminDashboard.jsx`,
  `TeamDashboard.jsx` and `Account.jsx`, plus CSS in `app.css`.
**Check:** look at all 3 dashboards at phone (375 px), tablet and desktop widths in both themes, with no sideways
scrolling.

---

## Order of work and size

| Phase | Items | Rough size |
|-------|-------|-----------|
| 1 | 1, 2, 3 | small: 1 day |
| 2 | 4, 5, 6 | medium: 2–3 days |
| 3 | 7, 8, 9, 10 | large: 5–7 days (needs Q1, Q2 set up: Cloudinary/R2 account, Claude API key) |
| 4 | 11 | medium: 3–4 days |

Each phase is a separate commit and can be checked on `npm run dev` before the next one starts. After server changes,
the local `npm start` on port 3000 needs a restart.

## New settings and env vars
- `ANTHROPIC_API_KEY`: poster wording (item 10).
- `CLOUDINARY_URL` (or `R2_*` keys): post photos, videos and audio (items 7–9).
- Both are added to [render.yaml](../render.yaml) as `sync: false` and to the README table.

## Not changing
- The customer booking steps (category → sewa → calendar → details) stay the same, apart from the vertical sewa list.
- Existing bookings, bills, commission and settlement logic stay as they are, except for the payment check before
  "Completed" (item 5) and the new team booking steps (item 6).
