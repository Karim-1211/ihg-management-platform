# User Manual — Index

This folder contains the plain-language user manuals for the Enterprise Hospitality, Restaurant & Food Delivery Management Platform, one per role.

## Which Manual Is For You

| Your role | Manual |
|---|---|
| Guest / Customer | [customer.md](customer.md) |
| Front Desk | [receptionist.md](receptionist.md) |
| Housekeeping | [housekeeping.md](housekeeping.md) |
| Restaurant Waiter | [waiter.md](waiter.md) |
| Kitchen | [kitchen.md](kitchen.md) |
| Delivery Driver | [delivery.md](delivery.md) |
| Manager | [manager.md](manager.md) |
| Admin / Super Admin | [admin.md](admin.md) |

## About These Manuals

Each manual reflects **only what that role can actually see and do in the application today** — no invented features, no aspirational functionality. Access levels are derived directly from the application's own role permissions (`allowedRoles` in the frontend routes and the corresponding backend authorization checks), not from assumption.

Each manual follows the same structure: Quick Start, Logging In, Navigation, Daily Tasks (step-by-step), Status Meanings, Common Problems, Important Notes, and Your Permissions.

## Keeping These Manuals Current

**These manuals describe the application as it exists at the time of writing.** If a future change adds, removes, or changes a screen, workflow, or permission, the corresponding manual(s) should be updated in the same change — treat an out-of-date manual as a defect, the same way a broken feature would be treated. When in doubt about whether a manual needs updating after a code change, check whether the change touched:
- A route's `allowedRoles` in `App.jsx`
- A navigation item in `Sidebar.jsx` or `Navbar.jsx`
- A status enum or workflow step in any service file
- Anything a Manager/Admin can configure (e.g., Business Rules)

If any of those changed, review the relevant manual(s) for accuracy before considering that change complete.