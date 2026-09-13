# Training Scenarios

All data below is fictional and for training purposes only. Do not assume any specific booking, order, or customer referenced here exists in the live system — trainees should create their own test records as needed, or a trainer should set up matching test data in a training/demo account beforehand.

---

## Customer

### Scenario C1 — Book and Pay for a Stay
**Starting situation:** You are a new guest with an account, not currently logged in.
**Task:** Log in, book a room at any available hotel for two nights starting one week from today, then view it in My Account.
**Expected steps:** Log in → Hotel → Browse Hotels → pick a hotel → View Rooms → enter dates → Book Now → confirm the booking appears in My Account → Bookings with status Confirmed.
**Trainer checklist:** [ ] Logged in successfully [ ] Booking created with correct dates [ ] Booking visible in My Account
**Follow-up question:** What would you do if you needed to cancel this booking tomorrow?

### Scenario C2 — Order Delivery and Track It
**Starting situation:** Logged in as a customer.
**Task:** Place a delivery order from any restaurant, then check its status in My Account.
**Expected steps:** Delivery → pick restaurant → add items → enter address → Place Order → My Account → Orders → confirm order appears with type Delivery.
**Trainer checklist:** [ ] Order placed [ ] Order visible under My Account → Orders [ ] Trainee can explain what each delivery status means
**Follow-up question:** How would you find out who your delivery driver is?

---

## Receptionist

### Scenario R1 — Check In and Check Out a Guest
**Starting situation:** A trainer creates a test booking (fictional guest "Test Guest One") in Confirmed status.
**Task:** Check the guest in, then check them out.
**Expected steps:** Bookings → find the test booking → Check In → confirm → (later) Check Out → confirm.
**Trainer checklist:** [ ] Booking moved to Checked In [ ] Booking moved to Checked Out [ ] Trainee notes that an invoice was generated automatically
**Follow-up question:** What task gets created automatically when you check a guest out?

### Scenario R2 — Handle a Service Request
**Starting situation:** A fictional Checked-In guest submits a service request for extra towels (trainer can create this via a test customer account, or simulate verbally).
**Task:** Find and resolve the request.
**Expected steps:** Service Requests → find the pending request → coordinate fulfillment → mark Completed.
**Trainer checklist:** [ ] Request found [ ] Marked Completed correctly
**Follow-up question:** Where would a Housekeeping team member see this same request?

---

## Housekeeping

### Scenario H1 — Complete a Room Cleaning Task
**Starting situation:** A fictional guest has just checked out, creating a housekeeping task automatically.
**Task:** Find and complete the housekeeping task for that room.
**Expected steps:** Housekeeping → find the pending task → mark Done.
**Trainer checklist:** [ ] Task found [ ] Marked Done only after confirming the room would genuinely be ready
**Follow-up question:** What happens to the room's booking availability once you mark the task Done?

### Scenario H2 — Record Wasted Supplies
**Starting situation:** A cleaning supply was accidentally damaged.
**Task:** Record this as Waste in Inventory.
**Expected steps:** Inventory → Manage on the relevant item → Waste → enter quantity → Record.
**Trainer checklist:** [ ] Correct transaction type selected [ ] Quantity recorded [ ] Trainee can view the item's updated stock level

---

## Waiter

### Scenario W1 — Full Dine-In Order Cycle
**Starting situation:** A fictional customer places a dine-in order at your restaurant (trainer can place this via a test customer account).
**Task:** Confirm the order, wait for the kitchen to mark it Ready, then mark it Served.
**Expected steps:** Orders → Confirm the order → (kitchen marks Preparing → Ready) → Served.
**Trainer checklist:** [ ] Order confirmed [ ] Order marked Served only after kitchen marked it Ready [ ] Trainee understands the bill generates automatically
**Follow-up question:** What table statuses exist, and when would you use each?

### Scenario W2 — Assign a Delivery Driver
**Starting situation:** A fictional delivery order has reached Ready status.
**Task:** Assign an available driver.
**Expected steps:** Deliveries → find the Ready order → assign a driver.
**Trainer checklist:** [ ] Correct order found [ ] Driver assigned successfully

---

## Kitchen

### Scenario K1 — Prepare an Order
**Starting situation:** A fictional order has just been confirmed by a waiter.
**Task:** Move it through Preparing to Ready.
**Expected steps:** Kitchen → Start Preparing → (once food is ready) mark Ready.
**Trainer checklist:** [ ] Order moved to Preparing [ ] Order moved to Ready
**Follow-up question:** What happens automatically to ingredient stock when this order was confirmed?

### Scenario K2 — Handle a Stock Shortage
**Starting situation:** An order can't be confirmed due to insufficient stock on a recipe-linked item.
**Task:** Identify the shortage and record a Purchase to restock.
**Expected steps:** Inventory → Manage on the affected item → Purchase → enter quantity → Record → retry confirming the order.
**Trainer checklist:** [ ] Shortage correctly identified [ ] Purchase recorded [ ] Order can now be confirmed

---

## Delivery

### Scenario D1 — Complete a Delivery
**Starting situation:** A fictional delivery order has just been assigned to you.
**Task:** Progress it through Picked Up, Out for Delivery, and Delivered.
**Expected steps:** My Deliveries → Picked Up → Out for Delivery → Delivered.
**Trainer checklist:** [ ] All three status updates completed in order [ ] Trainee understands the order and invoice complete automatically on Delivered

---

## Manager

### Scenario M1 — Morning Dashboard Review
**Starting situation:** Start of a shift.
**Task:** Review the Dashboard and identify anything needing attention.
**Expected steps:** Dashboard → review occupancy, orders, revenue, and the Attention section.
**Trainer checklist:** [ ] Trainee correctly identifies at least one attention item (if present) [ ] Trainee explains what it means
**Follow-up question:** How would you check if today's revenue is higher or lower than yesterday's?

### Scenario M2 — Adjust a Hotel-Scoped Business Rule
**Starting situation:** You've been told to change your hotel's kitchen bottleneck threshold.
**Task:** Locate and update the relevant rule.
**Expected steps:** Business Rules → find the rule → update its value → confirm the change is recorded in its history.
**Trainer checklist:** [ ] Correct rule identified [ ] Value updated [ ] History shows the change
**Follow-up question:** Could you create a rule that applies to every hotel, not just yours?

### Scenario M3 — Use the Staff Assistant for a Summary
**Starting situation:** You want a quick end-of-day summary.
**Task:** Ask the staff assistant for today's business summary.
**Expected steps:** Open the assistant → ask "Give me today's business summary" → review the response against the Dashboard.
**Trainer checklist:** [ ] Trainee confirms the assistant's figures match the Dashboard/Reports data

---

## Admin

### Scenario A1 — Create a Global Business Rule
**Starting situation:** A new platform-wide policy needs to be set.
**Task:** Create a Global-scoped business rule.
**Expected steps:** Business Rules → create new rule → set scope to Global → save.
**Trainer checklist:** [ ] Rule created with Global scope [ ] Trainee explains how a hotel-specific rule would override this

### Scenario A2 — Import a Small Batch of Historical Bookings
**Starting situation:** You have a small CSV file with 2–3 fictional historical bookings, formatted per the import template.
**Task:** Preview the import, review any errors, then commit it.
**Expected steps:** Use the import tool → preview → review row-by-row results (valid/error/warning) → commit only if the preview looks correct.
**Trainer checklist:** [ ] Trainee reviews the preview before committing [ ] Trainee correctly interprets any warnings (e.g., overlapping bookings) as "imported but flagged," not blocked

---

## Notes for Trainers

- These scenarios are designed to be run against a **training or test account**, never live guest data.
- Where a scenario depends on another role's action (e.g., a customer placing an order before a Waiter can confirm it), coordinate with another trainee or simulate the step yourself.
- If a trainee's actual screen doesn't match "Expected steps," check the current Phase 27 manual for that role first — the manuals are the verified source of truth.