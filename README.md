<div align="center">

<img src="docs/diagrams/banner.png" alt="IHG Hospitality: one platform for your hotel, restaurant and delivery" width="100%">

<br>

# IHG Hospitality

### Enterprise Hospitality, Restaurant & Food Delivery Management Platform

**Run a hotel, a restaurant and a delivery service from one connected system, with an AI concierge your guests can talk to.**

<br>

[![Live demo](https://img.shields.io/badge/Live%20demo-ihg--hospitality.netlify.app-FF2147?style=for-the-badge&logo=netlify&logoColor=white)](https://ihg-hospitality.netlify.app)
[![API docs](https://img.shields.io/badge/API%20docs-Swagger-1F3A5F?style=for-the-badge&logo=swagger&logoColor=white)](https://ihg-management-platform.onrender.com/docs)

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-8E75B2?logo=googlegemini&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

<br>

[Overview](#overview) ·
[One dashboard](#run-the-whole-business-from-one-dashboard) ·
[Features](#features) ·
[Screenshots](#screenshots) ·
[Alice, the AI concierge](#alice-the-ai-concierge) ·
[Architecture](#architecture) ·
[Quick start](#quick-start) ·
[Documentation](#documentation)

</div>

> [!NOTE]
> The live demo runs on free hosting. If nobody has used it for a while, the first page can take up to a minute to wake the server. After that it is fast. Demo logins for each role are available on request.

---

## Overview

International Hospitality Group runs hotels, restaurants and a food-delivery service, but each ran separately, with manual work, repeated data entry, mixed-up inventory and slow reports. **IHG Hospitality brings all three into one platform**: one guest account, one set of records, and one dashboard for management.

<table>
<tr>
<td width="25%" align="center"><h3>3</h3>services in one platform<br><sub>hotel · restaurant · delivery</sub></td>
<td width="25%" align="center"><h3>8</h3>roles<br><sub>each sees only what its job needs</sub></td>
<td width="25%" align="center"><h3>17</h3>read-only AI tools<br><sub>Alice never invents data</sub></td>
<td width="25%" align="center"><h3>5</h3>hosted services<br><sub>deployed on free plans</sub></td>
</tr>
</table>

### The problem it solves

| Before | With IHG Hospitality |
|---|---|
| Paper and spreadsheets in every department | One system, one source of truth |
| Hotel, restaurant and delivery as separate islands | One guest account across all three |
| Kitchen, restaurant and hotel stock out of step | Stock deducted automatically, per recipe, when an order is confirmed |
| Reception, kitchen and riders miscommunicating | Live boards and alerts, so everyone sees the same state |
| Reports that arrive days late | A manager dashboard that is live |
| Prices and policies hard-coded | Business rules managers change without a developer |

---

## Run the whole business from one dashboard

Guests use the website. Staff work in focused boards for their own job. Everything they do flows into a single manager view.

```mermaid
flowchart LR
    G["Guests and customers<br/>website + Alice"]

    subgraph OPS["Daily operations"]
        direction TB
        H["Hotel<br/>bookings · housekeeping<br/>service requests · invoices"]
        R["Restaurant<br/>orders · kitchen<br/>reservations · bills"]
        D["Delivery<br/>dispatch · live tracking"]
    end

    subgraph SHARED["Shared platform"]
        direction TB
        I["Inventory and recipes"]
        B["Billing and PDF invoices"]
        N["In-app alerts and email"]
        BR["Business rules<br/>tax · policies · discounts"]
    end

    M(["Manager dashboard<br/>live figures · alerts · reports · audit log"])

    G --> H
    G --> R
    G --> D
    H --> B
    R --> I
    R --> B
    D --> I
    H --> N
    R --> N
    D --> N
    BR -.-> H
    BR -.-> R
    BR -.-> D
    H --> M
    R --> M
    D --> M
    I --> M
    B --> M
    N --> M

    classDef hotel fill:#1F3A5F,color:#ffffff,stroke:#1F3A5F
    classDef rest fill:#FF2147,color:#ffffff,stroke:#FF2147
    classDef deliv fill:#059669,color:#ffffff,stroke:#059669
    classDef mgr fill:#0F1E33,color:#ffffff,stroke:#0F1E33
    class H hotel
    class R rest
    class D deliv
    class M mgr
```

<div align="center">
<img src="docs/screenshots/staff/dashboard.jpg" alt="The manager dashboard" width="88%">
<br><sub><b>The manager dashboard</b>: occupancy, orders today, active deliveries and today's revenue, with an attention list.</sub>
</div>

---

## Features

### By role

| Role | What they do in the platform |
|---|---|
| **Guest / customer** | Search live availability, book rooms, reserve tables, order delivery (even to their room), request in-room service, download invoices, talk to Alice |
| **Receptionist** | Bookings board (in house · arriving today · upcoming), check-in and check-out, service requests, hotel invoices |
| **Housekeeping** | Cleaning board that fills itself after every check-out, ordered by who has waited longest |
| **Waiter** | Confirm orders, seat reservations, manage tables, mark bills paid |
| **Kitchen** | Ticket board with *to start* and *on the pass* columns and late-order timers |
| **Delivery** | Dispatch board, rider assignment, live tracking |
| **Manager** | Dashboard, reports, business rules, inventory and recipes, newsletter, email log, audit log |
| **Administrator** | Everything a manager has, across every property, plus platform-wide rules |

### Highlights

- **Room booking that cannot double-book.** Overlapping stays for the same room are refused by the platform.
- **Real photo galleries and room detail**, with filters that show how many rooms each choice would leave.
- **Table reservations** against a live floor plan, with tables described by character (intimate, classic, family, private party).
- **Delivery with a live tracker**, a configurable time estimate, and *Deliver to my room* for checked-in guests.
- **Inventory that updates itself.** Each dish has a recipe, and confirming an order deducts the ingredients, with low-stock alerts.
- **Business rules instead of hard-coded values**: tax, service charge, cancellation window, stay limits, delivery minutes and the subscriber discount are all editable, with a history of who changed what and why.
- **Subscriber promo codes**: personal, single-use, 90-day codes for hotel bookings and delivery orders.
- **Automatic email and in-app alerts**, including PDF invoices attached to confirmation emails.
- **Role-based access** on every screen and every API route, plus an audit log.
- **Demonstration payments only.** No real card or PayPal details are collected or stored.

### Requirements coverage

Built against the project proposal for International Hospitality Group.

| Proposal area | Delivered |
|---|---|
| Hotel: rooms, booking, check-in/out, housekeeping, billing, in-room service | Yes |
| Restaurant: tables, orders, kitchen tracking, menu, dine-in bills | Yes |
| Online food delivery: accounts, orders, tracking, order history | Yes |
| Shared: secure login, roles, inventory, payments (demo), dashboard, reports, email, alerts | Yes |
| Optional AI: chat support, room and food recommendations | Yes (Alice) |
| Brand identity: navy `#1F3A5F` and red `#FF2147` | Yes |
| Deployment, deployment guide, user manual | Yes (see [Documentation](#documentation)) |
| Testing before handover | A pytest suite, isolated and workflow tests, and a QA sign-off (see [Testing](#testing)) |

---

## Screenshots

### Guest experience

<table>
<tr>
<td width="50%"><img src="docs/screenshots/guest/rooms.jpg" alt="Rooms and suites"><br><sub><b>Rooms &amp; Suites.</b> Filter by view, price and balcony; every card shows live availability.</sub></td>
<td width="50%"><img src="docs/screenshots/guest/room-detail.jpg" alt="Room detail"><br><sub><b>Room detail.</b> Photo gallery, description, specifications and what is included.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/guest/booking-checkout.jpg" alt="Review your stay"><br><sub><b>Review your stay.</b> Dates, guest details, demo payment and a clear booking summary with the subscriber discount.</sub></td>
<td width="50%"><img src="docs/screenshots/guest/reserve-table.jpg" alt="Reserve a table"><br><sub><b>Reserve a table.</b> Free tables for the chosen time, with a live reservation summary.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/guest/delivery-menu.jpg" alt="Delivery menu"><br><sub><b>Delivery menu.</b> Signature dishes and a basket that follows the guest through sign-in.</sub></td>
<td width="50%"><img src="docs/screenshots/guest/delivery-checkout.jpg" alt="Delivery checkout"><br><sub><b>Delivery checkout.</b> <i>Deliver to my room</i> for checked-in guests, an estimate and demo payment.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/guest/my-account.jpg" alt="My account"><br><sub><b>My Account.</b> Bookings, orders, reservations, invoices, service requests and notifications in one place.</sub></td>
<td width="50%"><img src="docs/screenshots/guest/subscribe-popup.jpg" alt="Subscribe and save 10 percent"><br><sub><b>Subscribe and save 10%.</b> A personal code, shown at once and sent by email.</sub></td>
</tr>
</table>

### Alice, the AI concierge

<table>
<tr>
<td width="50%"><img src="docs/screenshots/alice/chat-window.jpg" alt="Alice chat window"><br><sub><b>Ask or find a room.</b> Alice opens with a short menu on every guest page.</sub></td>
<td width="50%"><img src="docs/screenshots/alice/room-finder.jpg" alt="Alice room finder"><br><sub><b>Room finder.</b> Describe the stay you want and she checks real availability.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/alice/dining-listening.jpg" alt="Alice listening"><br><sub><b>Talk to her.</b> A live microphone indicator shows she is listening.</sub></td>
<td width="50%"><img src="docs/screenshots/alice/delivery-orders.jpg" alt="Alice tracking orders"><br><sub><b>Track an order.</b> She reads the guest's real order status.</sub></td>
</tr>
</table>

### Staff and management

<details open>
<summary><b>Operational boards</b> (click to collapse)</summary>
<br>

<table>
<tr>
<td width="50%"><img src="docs/screenshots/staff/bookings.jpg" alt="Bookings board"><br><sub><b>Bookings.</b> In house, arriving today, upcoming and past.</sub></td>
<td width="50%"><img src="docs/screenshots/staff/housekeeping.jpg" alt="Housekeeping board"><br><sub><b>Housekeeping.</b> Waiting, being cleaned, ready; longest wait first.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/staff/orders.jpg" alt="Orders board"><br><sub><b>Orders.</b> Confirm new orders and follow them through the kitchen.</sub></td>
<td width="50%"><img src="docs/screenshots/staff/kitchen.jpg" alt="Kitchen board"><br><sub><b>Kitchen.</b> First in, first out, with late-order timers.</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/staff/deliveries.jpg" alt="Dispatch board"><br><sub><b>Deliveries.</b> Needs a rider, rider assigned, on the road.</sub></td>
<td width="50%"><img src="docs/screenshots/staff/inventory.jpg" alt="Inventory"><br><sub><b>Inventory.</b> Stock bars, reorder alerts and a full movement history.</sub></td>
</tr>
</table>

</details>

<details>
<summary><b>Management</b></summary>
<br>

<img src="docs/screenshots/staff/business-rules.jpg" alt="Business rules" width="70%">
<br><sub><b>Business Rules.</b> Tax, delivery minutes, stay limits and the subscriber discount, editable with a full history.</sub>

</details>

---

## Business workflows

### A hotel stay, from search to a clean room

```mermaid
flowchart LR
    A["Pick dates"] --> B["Choose a room"] --> C["Sign in"] --> D["Review and pay<br/>(demo payment)"] --> E["Confirmed<br/>email + PDF invoice"]
    E --> F["Check-in<br/>reception"] --> G["In house<br/>service requests"] --> H["Check-out"] --> I["Housekeeping task<br/>created automatically"] --> J["Room ready to sell"]

    classDef start fill:#1F3A5F,color:#ffffff,stroke:#1F3A5F
    classDef done fill:#059669,color:#ffffff,stroke:#059669
    class A start
    class J done
```

### The life of an order

```mermaid
stateDiagram-v2
    [*] --> New: Guest places order
    New --> Confirmed: Waiter confirms
    New --> Cancelled
    Confirmed --> Preparing: Kitchen starts
    Preparing --> Ready: Kitchen marks ready
    Ready --> Served: Served at the table
    Ready --> OnTheWay: Rider collects (delivery)
    OnTheWay --> Delivered: Handed to the guest
    Served --> [*]
    Delivered --> [*]
    Cancelled --> [*]
```

### One order, end to end

```mermaid
sequenceDiagram
    autonumber
    actor Guest
    participant Web as Website (Netlify)
    participant API as FastAPI (Render)
    participant DB as PostgreSQL (Neon)
    participant Staff as Waiter, kitchen, rider
    participant Mail as Brevo email

    Guest->>Web: Choose dishes, tick "Deliver to my room"
    Web->>API: Place order (promo code optional)
    API->>DB: Validate the code, create order, take demo payment, issue invoice
    API-->>Mail: Queue the confirmation email
    Staff->>API: Waiter confirms the order
    API->>DB: Deduct ingredients using each recipe
    Staff->>API: Kitchen starts, then marks ready
    Staff->>API: Dispatcher assigns a rider, rider delivers
    API-->>Guest: Tracker refreshes every 15 s, plus alerts and email
```

---

## Alice, the AI concierge

Alice helps guests by **typing or by voice**, on the hotel, restaurant and delivery pages. She changes role to match the page: finding a room, reserving a table or choosing a dish, tracking an order, or answering questions about policies and the menu.

### Core AI workflow

```mermaid
flowchart TD
    U["Guest speaks or types"] --> V{"Voice?"}
    V -- "voice" --> STT["Recorded in the browser<br/>POST /ai/transcribe"]
    STT --> W["Groq Whisper<br/>confidence filter drops non-speech"]
    W --> T["Text"]
    V -- "typed" --> T
    T --> O["AI orchestration<br/>role, history, versioned system prompt"]
    O --> LLM["Gemini key 1 → key 2 → Groq<br/>automatic fallback"]
    LLM -- "needs real data" --> TR["Tool registry<br/>17 read-only tools"]
    TR --> SV["Existing services<br/>availability · menu · bookings · orders"]
    SV --> DB[("PostgreSQL")]
    SV --> LLM
    LLM --> A["Streamed answer"]
    A --> UI["Chat window and room cards"]
    A --> TTS["Spoken reply<br/>ElevenLabs → browser voice"]

    classDef ai fill:#FF2147,color:#ffffff,stroke:#FF2147
    classDef safe fill:#059669,color:#ffffff,stroke:#059669
    class LLM ai
    class TR,SV safe
```

### AI architecture

| Capability | How it works | Where |
|---|---|---|
| **Conversation** | Gemini first (two API keys), then Groq if both fail, so an outage degrades quality instead of breaking the feature. Replies stream token by token. | `services/ai_orchestration_service.py` |
| **Grounded answers (tool calling)** | The model can only call a **whitelist of 17 read-only tools** (rooms, menu, tables, policies, the guest's own bookings, orders and invoices). Every tool wraps an existing, tested service and is called with the *signed-in user bound by the server*, so the model never supplies a customer id and cannot read another guest's data. | `services/ai_tool_registry.py` |
| **Role-aware staff assistant** | A separate registry with its own prompt and permissions for staff roles. | `services/ai_staff_tool_registry.py` |
| **Recommendations** | Rooms and dishes are matched with transparent rules over real stored fields (view, balcony, bathtub, past stays and orders). The AI explains the result; it does not invent it. | `ai_tool_registry.py` |
| **Speech to text** | The browser records the guest, and the API transcribes with Groq Whisper. Whisper's own per-segment confidence scores (no-speech probability, log-probability, compression ratio) discard text it invented from silence. | `services/stt_service.py` |
| **Text to speech** | ElevenLabs, with the browser's built-in voice as the final fallback. Once a provider fails in a visit, the whole visit stays on the next one, so Alice never changes voice mid-conversation. | `services/tts_service.py`, `frontend/src/lib/aliceVoice.js` |
| **Safety and bounds** | The guest-facing assistant cannot write data: she cannot book, pay or cancel; the guest always confirms at checkout. Unclear voice answers are retried at most twice before she hands over to the keyboard. | tool registry, `DiningConcierge.jsx` |
| **Observability** | Interactions by signed-in users are logged. The system prompt carries a version number that increases with every edit. | `services/ai_constants.py` |

> [!IMPORTANT]
> **Honest status.** Alice is a *tool-using assistant*, not an autonomous agent. She chooses among a fixed set of read-only tools, but she cannot act on a guest's behalf, and pricing, tax, availability, overlap checks and discounts are always decided by ordinary code and business rules, never by the model. This project does not use a vector database or embeddings: grounding comes from direct, permission-checked service calls.

---

## Architecture

### System architecture

```mermaid
flowchart LR
    U["Browser<br/>guests and staff"] -->|"HTTPS"| NF["Netlify<br/>React + Vite + Tailwind"]
    U -->|"REST/JSON and streaming"| RD["Render<br/>FastAPI service"]
    RD -->|"SQL over TLS"| NE[("Neon<br/>PostgreSQL")]
    RD -->|"HTTPS API"| BR["Brevo<br/>transactional email"]
    RD --> AI["Gemini · Groq · ElevenLabs"]
    GH["GitHub<br/>branch master"] -->|"build on push"| NF
    GH -->|"deploy on push"| RD

    classDef edge fill:#1F3A5F,color:#ffffff,stroke:#1F3A5F
    classDef core fill:#FF2147,color:#ffffff,stroke:#FF2147
    class NF edge
    class RD core
```

### Backend layers

```mermaid
flowchart TB
    R["routers/<br/>HTTP endpoints, sign-in, role checks"] --> S["services/<br/>business rules and workflows"]
    R --> SC["schemas/<br/>request and response validation"]
    S --> M["models/<br/>SQLAlchemy tables"]
    M --> P[("PostgreSQL<br/>Alembic migrations")]
    S --> X["email · PDF · notifications · AI"]
```

Routers stay thin: they authenticate, check the role and call a service. Rules live in the **service layer**, so the website, the AI tools and the maintenance scripts all go through the same tested code.

### Data model (simplified)

```mermaid
erDiagram
    USER ||--o{ BOOKING : makes
    HOTEL ||--o{ ROOM_TYPE : offers
    HOTEL ||--o{ ROOM : contains
    ROOM_TYPE ||--o{ ROOM : classifies
    ROOM ||--o{ BOOKING : "is booked as"
    BOOKING ||--o{ SERVICE_REQUEST : raises
    BOOKING ||--o| INVOICE : "is billed by"
    RESTAURANT ||--o{ DINING_TABLE : has
    DINING_TABLE ||--o{ RESERVATION : "is reserved by"
    USER ||--o{ RESERVATION : makes
    RESTAURANT ||--o{ MENU_ITEM : serves
    USER ||--o{ CUSTOMER_ORDER : places
    RESTAURANT ||--o{ CUSTOMER_ORDER : receives
    CUSTOMER_ORDER ||--|{ ORDER_ITEM : contains
    MENU_ITEM ||--o{ ORDER_ITEM : "ordered as"
    MENU_ITEM ||--o{ RECIPE_LINE : "is made from"
    INVENTORY_ITEM ||--o{ RECIPE_LINE : "is used in"
```

*Entity names are conceptual. The full schema is in the SQLAlchemy models and Alembic migrations.*

### Technology

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| **Database** | PostgreSQL (Neon in production) |
| **Security** | Signed login tokens (JWT), Argon2 password hashes, role checks on every route |
| **AI** | Google Gemini, Groq (chat fallback and Whisper speech-to-text), ElevenLabs voice |
| **Email** | Brevo transactional API with PDF invoices attached |
| **Hosting** | Netlify (website), Render (API), Neon (database), GitHub (source and deploy trigger) |

### Project structure

```
ihg-management-platform/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── core/               # config, database session, dependencies, security
│   │   ├── models/             # 15 SQLAlchemy model modules
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # 23 routers: the REST API
│   │   ├── services/           # 38 modules of business logic: booking, billing,
│   │   │                       #   inventory, delivery, promo, email, PDF,
│   │   │                       #   notifications, AI orchestration, tools, speech
│   │   └── utils/
│   ├── alembic/versions/       # database migrations
│   ├── tests/                  # pytest suite (booking overlap, health)
│   ├── test_*.py / test_*.ps1  # isolated and end-to-end workflow tests
│   ├── seed_*.py               # starting data and business rules
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/         # ai · checkout · customer · hotels · layout ·
│   │   │                       #   marketing · media · notifications · restaurants · shared
│   │   ├── pages/              # auth · bookings · customer · delivery · hotels ·
│   │   │                       #   restaurants · staff (21 staff screens)
│   │   ├── lib/                # Alice voice engine, cart, status helpers
│   │   ├── context/            # authentication and assistant state
│   │   └── services/           # API client
│   └── package.json
│
├── docs/
│   ├── screenshots/            # guest · staff · alice
│   ├── guides/                 # Deployment Guide and User Manual (PDF + Word)
│   ├── diagrams/               # banner and architecture images
│   ├── api/ · architecture/ · database/ · testing/
│   ├── training/               # quick-start cards and training scenarios
│   └── user-manual/            # one Markdown manual per role
│
├── netlify.toml                # website build settings and page-refresh rule
├── LICENSE
└── README.md
```

---

## Quick start

**You need:** Python 3.12, Node.js 22, PostgreSQL, and Git.

### 1. Database

```sql
CREATE DATABASE ihg_management;
```

### 2. Backend

```powershell
# Windows PowerShell, from the project root
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
copy .env.example .env        # then fill in the values (see below)
alembic upgrade head
uvicorn app.main:app --reload
```

On macOS or Linux, activate with `source .venv/bin/activate` and use `cp` instead of `copy`.

The API runs at `http://127.0.0.1:8000`, with interactive documentation at `/docs`.

### 3. Frontend

```powershell
cd frontend
npm install
Set-Content -Path .env.local -Value "VITE_API_URL=http://127.0.0.1:8000/api/v1" -Encoding ascii
npm run dev
```

Open `http://localhost:5173`.

### 4. Starting data

`backend/seed_data.py` and the other `seed_*.py` scripts create hotels, rooms, tables, riders, recipes, business rules and the promo and delivery settings. See the [Deployment Guide](docs/guides/IHG_Deployment_Guide.pdf), section 7.3, for what each one does.

### Environment variables

Names only; **never commit real values.** Copy `backend/.env.example` to `backend/.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Signs login tokens; use a long random value |
| `APP_ENV`, `DEBUG` | `production` and `false` switch on the production safety checks |
| `CORS_ALLOWED_ORIGINS` | Website address allowed to call the API |
| `EMAIL_MODE` | `DEMO` logs emails; `SMTP` sends them |
| `BREVO_API_KEY`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Email sending in production |
| `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2` | Alice's chat (two keys give a fallback) |
| `GROQ_API_KEY` | Chat fallback and speech-to-text |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Alice's spoken voice |

---

## Deployment

The platform is deployed from the `master` branch: **a `git push` builds both the website and the API.**

| Part | Service | Notes |
|---|---|---|
| Website | Netlify | Settings in `netlify.toml` |
| API | Render | Root directory `backend`; start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; health check `/health` |
| Database | Neon | PostgreSQL, connection string held in `DATABASE_URL` |
| Email | Brevo | Sent over HTTPS, because free hosting blocks the usual mail ports |

The complete procedure, a 14-point verification checklist, rollback, backups, key rotation and troubleshooting are in the **[Deployment & Operations Guide](docs/guides/IHG_Deployment_Guide.pdf)**.

---

## Testing

| Layer | What | Where |
|---|---|---|
| **Automated** | `pytest` suite, including the room-overlap guarantee and the health check | `backend/tests/` and `backend/pytest.ini` |
| **Isolated checks** | Business-rule resolver, service charge and tax reconciliation, booking import, media migration, inventory deduction, security hardening, promo codes, and every AI tool in isolation | `backend/test_*.py` |
| **Workflow scripts** | End-to-end PowerShell runs of orders, reservations, delivery, restaurant billing, reports, notifications and the dashboard | `backend/test_*.ps1` |
| **Sign-off** | QA sign-off and acceptance records | [`PHASE_26_QA_SIGNOFF.md`](backend/PHASE_26_QA_SIGNOFF.md) · [`PHASE_29_ACCEPTANCE.md`](docs/PHASE_29_ACCEPTANCE.md) · [`docs/testing`](docs/testing/README.md) |

```powershell
cd backend
pytest
```

The tests need the local database from the quick start. The live site is checked with the 14-point list in the [Deployment Guide](docs/guides/IHG_Deployment_Guide.pdf).

---

## Security

- Passwords are stored only as Argon2 hashes.
- Login tokens are signed and expire.
- Every staff screen and API route checks the user's role.
- Traffic uses HTTPS, and the database connection requires TLS.
- The API accepts calls only from the configured website address.
- Sensitive actions are written to an audit log.
- Secrets live in environment variables; `.env` files and database backups are excluded from Git.

More detail: [`AUTHENTICATION_SECURITY_NOTES.md`](backend/AUTHENTICATION_SECURITY_NOTES.md).

> [!WARNING]
> Payments are in demonstration mode, and the business policies in the demo database are assumed values. Replace both, and change every demo password, before the system holds real data.

---

## Documentation

| Document | For | Open |
|---|---|---|
| **User Manual**: guest and staff instructions, quick-start cards, training scenarios | Guests, staff, managers | [PDF](docs/guides/IHG_User_Manual.pdf) · [Word](docs/guides/IHG_User_Manual.docx) |
| **Deployment & Operations Guide**: hosting, configuration, releases, backups, troubleshooting | Developers, administrators | [PDF](docs/guides/IHG_Deployment_Guide.pdf) · [Word](docs/guides/IHG_Deployment_Guide.docx) |
| **Manuals by role** (Markdown) | Customer · receptionist · housekeeping · waiter · kitchen · delivery · manager · admin | [`docs/user-manual`](docs/user-manual/README.md) |
| **Quick-start cards and training scenarios** | New staff | [`docs/training`](docs/training/scenarios.md) |
| **Technical reference** | Developers | [API](docs/api/README.md) · [Architecture](docs/architecture/README.md) · [Database](docs/database/README.md) · [Testing](docs/testing/README.md) |

---

## Roadmap

- [x] Hotel, restaurant and delivery in one platform
- [x] Role-based access and an audit trail
- [x] Inventory driven by recipes
- [x] Editable business rules
- [x] AI concierge with voice, grounded in real data
- [x] Live deployment with a deployment guide and user manual
- [ ] Real payment provider in place of demonstration payments
- [ ] Rate limiting on the public voice endpoints
- [ ] Broader automated test coverage (the pytest suite is small today)
- [ ] Import of historical paper records (validate, preview, import)
- [ ] Custom domain, uptime monitoring and error alerts
- [ ] An autonomous agent layer on top of the existing read-only tools

---

## Author

**Karimul Islam**, Batch 26/5
AI-Powered Software Engineering, ICT Bangladesh

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Karimul%20Islam-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/karimul-islam-seo-and-digital-marketing-expert/)

## License

Released under the [MIT License](LICENSE).

Photography used on the website comes from free-licence sources and remains the property of its owners; it is not covered by the MIT License.
