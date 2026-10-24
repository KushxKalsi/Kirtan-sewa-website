// Booking dates, "today" and reminder times are all Indian local time. Hosts like Render run on
// UTC, so pin the zone before anything reads the clock. Override with the TZ env var.
process.env.TZ ||= 'Asia/Kolkata';
