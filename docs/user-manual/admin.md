# Admin (Super Admin) Guide

## 1. Quick Start

You have full access to every screen in the platform, across every hotel and restaurant. In addition to everything a Manager can do, you manage Global business rules, staff accounts, and the platform's email log.

## 2. Logging In

1. Go to the login page.
2. Enter your admin email and password.
3. Click **Log In**.

## 3. Navigation

Your sidebar includes everything a Manager has, plus **Email Log** (under Management). Unlike Managers, your Dashboard, Reports, and Business Rules views are **not restricted to a single hotel** — you see platform-wide data unless you're looking at hotel-specific figures.

## 4. Daily Tasks

### All Manager Tasks
Everything in the Manager guide applies to you as well — Dashboard, Reports, Business Rules, Audit Log, and all Hotel/Restaurant/Delivery operational screens. The difference is scope: you see and manage data across **all** hotels and restaurants, not just one.

### Creating a Global Business Rule
1. Go to **Business Rules**.
2. Create a new rule with scope **Global** — this applies platform-wide unless a specific hotel or restaurant has its own override.
3. Only you (Super Admin) can create or edit Global rules.

### Creating Staff Accounts
Staff accounts (Receptionist, Housekeeping, Waiter, Kitchen, Delivery, Manager) are created by an Admin, assigned to a specific hotel or restaurant as appropriate.

### Reviewing the Email Log
1. Go to **Email Log** to see a record of notification emails sent by the system (the platform currently runs in demo email mode, so no real emails are sent — this log shows what would have been sent).

### Importing Historical Bookings
If historical guest/booking records need to be brought into the system (e.g., from a previous paper-based system), this is done via a CSV import process, available only to Admin. This is a specialized, occasional task — the CSV must follow the platform's required format (guest email, name, hotel, room, dates, amount, etc.), and the system will clearly report which rows succeeded and which had errors before anything is saved.

## 5. Status Meanings

See the Manager, Receptionist, Housekeeping, Waiter, and Kitchen guides — all statuses apply identically for you, at platform-wide scope.

## 6. Common Problems

| Problem | What to do |
|---|---|
| A Manager says they can't see another hotel's data | This is expected — Managers are scoped to their own hotel. Only Admin sees all hotels |
| CSV import rejects most of my rows | Check that dates are in YYYY-MM-DD format, amounts aren't negative, and hotel/room names exactly match existing records |
| I need to create a rule that overrides a hotel's specific rule | Set the new rule's scope to that specific hotel, with a higher priority than the existing one, or adjust the existing rule's effective dates |

## 7. Important Notes

- Global rules act as the platform default; Hotel- or Restaurant-scoped rules override the Global default for that specific hotel/restaurant.
- CSV import never overwrites existing bookings — a duplicate booking reference is rejected, not replaced.
- Historical imports do not apply forward-looking policies (like minimum stay or advance-booking limits) to imported records, since those records represent things that already happened.

## 8. Your Permissions

As Super Admin, you have unrestricted access to every screen and data set in the platform, across all hotels and restaurants, including Global business rules, staff account creation, the email log, and historical data import.