$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as SUPER_ADMIN..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Fetch Dashboard, Executive, Hotel, Restaurant reports (same period: last_30_days)..." -ForegroundColor Cyan
    $dashboard = Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $exec = Invoke-RestMethod -Uri "$base/reports/executive?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $hotel = Invoke-RestMethod -Uri "$base/reports/hotel?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurant = Invoke-RestMethod -Uri "$base/reports/restaurant?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $inventory = Invoke-RestMethod -Uri "$base/reports/inventory?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $operations = Invoke-RestMethod -Uri "$base/reports/operations?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - all six endpoints returned data" -ForegroundColor Green
} catch { Fail "Fetch all reports" $_.Exception.Message }

Write-Host "3. RECONCILIATION: Hotel revenue + Restaurant revenue == Executive total revenue (exact, since only two invoice types exist)..." -ForegroundColor Cyan
try {
    $sumRevenue = [math]::Round($hotel.hotel_revenue.current + $restaurant.restaurant_revenue.current, 2)
    $execRevenue = [math]::Round($exec.revenue.current, 2)
    Write-Host "   Hotel: $($hotel.hotel_revenue.current) + Restaurant: $($restaurant.restaurant_revenue.current) = $sumRevenue" -ForegroundColor Green
    Write-Host "   Executive total: $execRevenue" -ForegroundColor Green
    if ($sumRevenue -ne $execRevenue) { Fail "Revenue identity" "Hotel+Restaurant ($sumRevenue) != Executive total ($execRevenue) - possible double-count or missing invoice type" }
    Write-Host "   OK - revenue identity holds exactly (no double-counting, no gaps)" -ForegroundColor Green
} catch { Fail "Revenue reconciliation" $_.Exception.Message }

Write-Host "4. RECONCILIATION: Inventory report total == Executive inventory total (exact)..." -ForegroundColor Cyan
try {
    if ($inventory.inventory_activity_total.current -ne $exec.inventory_activity_total.current) {
        Fail "Inventory identity" "Inventory report ($($inventory.inventory_activity_total.current)) != Executive ($($exec.inventory_activity_total.current))"
    }
    Write-Host "   OK - Inventory totals reconcile exactly" -ForegroundColor Green
} catch { Fail "Inventory reconciliation" $_.Exception.Message }

Write-Host "5. RECONCILIATION: Operations overdue snapshot == Executive overdue snapshot (same moment, should match or differ by at most crossing the threshold)..." -ForegroundColor Cyan
try {
    Write-Host "   Operations: $($operations.service_requests_overdue_now), Executive: $($exec.overdue_service_requests_now)" -ForegroundColor Green
    if ([math]::Abs($operations.service_requests_overdue_now - $exec.overdue_service_requests_now) -gt 1) {
        Fail "Overdue reconciliation" "Snapshots diverge by more than 1 - unexpected"
    }
    Write-Host "   OK - overdue snapshots consistent" -ForegroundColor Green
} catch { Fail "Overdue reconciliation" $_.Exception.Message }

Write-Host "6. RECONCILIATION: Dashboard 'today' vs Executive 'today' (revenue and orders)..." -ForegroundColor Cyan
try {
    $execToday = Invoke-RestMethod -Uri "$base/reports/executive?period=today" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    if ([math]::Round($execToday.revenue.current, 2) -ne [math]::Round($dashboard.financial.revenue_today, 2)) {
        Fail "Dashboard/Executive revenue" "Report=$($execToday.revenue.current) vs Dashboard=$($dashboard.financial.revenue_today)"
    }
    if ($execToday.orders_created.current -ne $dashboard.restaurant.orders_today.total) {
        Fail "Dashboard/Executive orders" "Report=$($execToday.orders_created.current) vs Dashboard=$($dashboard.restaurant.orders_today.total)"
    }
    Write-Host "   OK - Dashboard and Executive report agree exactly on 'today'" -ForegroundColor Green
} catch { Fail "Dashboard/Executive reconciliation" $_.Exception.Message }

Write-Host ""
Write-Host "ALL PHASE 17 RECONCILIATION CHECKS PASSED" -ForegroundColor Green
Write-Host ""
Write-Host "Now run the full existing regression suite to confirm nothing in Phases 3-16 was disturbed:" -ForegroundColor Yellow
Write-Host "  .\test_service_flow.ps1" -ForegroundColor Yellow
Write-Host "  .\test_restaurant_billing.ps1" -ForegroundColor Yellow
Write-Host "  .\test_delivery.ps1" -ForegroundColor Yellow
Write-Host "  .\test_inventory_deduction.ps1" -ForegroundColor Yellow
Write-Host "  .\test_dashboard.ps1" -ForegroundColor Yellow
Write-Host "  .\test_notifications_isolated.ps1" -ForegroundColor Yellow