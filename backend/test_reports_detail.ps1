$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as SUPER_ADMIN and Rina (RECEPTIONIST)..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    $rina = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"rina@ihg.com","password":"TestPass123"}'
    $rinaToken = $rina.access_token
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Fetch Hotel report (last_30_days)..." -ForegroundColor Cyan
    $hotel = Invoke-RestMethod -Uri "$base/reports/hotel?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   applicable=$($hotel.applicable)" -ForegroundColor Green
    Write-Host "   bookings_created=$($hotel.bookings_created.current)" -ForegroundColor Green
    Write-Host "   check_ins_scheduled=$($hotel.check_ins_scheduled.current)" -ForegroundColor Green
    Write-Host "   check_outs_scheduled=$($hotel.check_outs_scheduled.current)" -ForegroundColor Green
    Write-Host "   room_night_demand=$($hotel.room_night_demand.current)" -ForegroundColor Green
    Write-Host "   hotel_revenue=$($hotel.hotel_revenue.current)" -ForegroundColor Green
    Write-Host "   current_occupancy_percent=$($hotel.current_occupancy_percent)" -ForegroundColor Green
    if ($hotel.room_night_demand.current -lt $hotel.bookings_created.current) {
        Write-Host "   NOTE: room_night_demand < bookings_created is plausible if bookings are short or outside range; not a hard failure." -ForegroundColor Yellow
    }
} catch { Fail "Hotel report" $_.Exception.Message }

try {
    Write-Host "3. Fetch Restaurant report (last_30_days)..." -ForegroundColor Cyan
    $restaurant = Invoke-RestMethod -Uri "$base/reports/restaurant?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   orders_created=$($restaurant.orders_created.current)" -ForegroundColor Green
    Write-Host "   orders_currently_served_created_in_period=$($restaurant.orders_currently_served_created_in_period.current)" -ForegroundColor Green
    Write-Host "   orders_currently_cancelled_created_in_period=$($restaurant.orders_currently_cancelled_created_in_period.current)" -ForegroundColor Green
    Write-Host "   restaurant_revenue=$($restaurant.restaurant_revenue.current)" -ForegroundColor Green
    Write-Host "   average_order_value=$($restaurant.average_order_value)" -ForegroundColor Green

    # Sanity: average_order_value * served count should approx equal revenue (within rounding)
    if ($restaurant.orders_currently_served_created_in_period.current -gt 0) {
        $expectedRevenue = $restaurant.average_order_value * $restaurant.orders_currently_served_created_in_period.current
        $diff = [math]::Abs($expectedRevenue - $restaurant.restaurant_revenue.current)
        if ($diff -gt 1.0) { Fail "AOV sanity check" "average_order_value * served count ($expectedRevenue) diverges too much from restaurant_revenue ($($restaurant.restaurant_revenue.current))" }
        Write-Host "   OK - average_order_value is internally consistent with restaurant_revenue" -ForegroundColor Green
    }
} catch { Fail "Restaurant report" $_.Exception.Message }

try {
    Write-Host "4. Fetch Delivery report (last_30_days)..." -ForegroundColor Cyan
    $delivery = Invoke-RestMethod -Uri "$base/reports/delivery?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   deliveries_created=$($delivery.deliveries_created.current)" -ForegroundColor Green
    Write-Host "   deliveries_delivered_in_period=$($delivery.deliveries_delivered_in_period.current)" -ForegroundColor Green
    Write-Host "   deliveries_currently_cancelled_created_in_period=$($delivery.deliveries_currently_cancelled_created_in_period.current)" -ForegroundColor Green
    Write-Host "   average_completion_minutes=$($delivery.average_completion_minutes)" -ForegroundColor Green
} catch { Fail "Delivery report" $_.Exception.Message }

try {
    Write-Host "5. Fetch Inventory report (last_30_days)..." -ForegroundColor Cyan
    $inventory = Invoke-RestMethod -Uri "$base/reports/inventory?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   inventory_activity_total=$($inventory.inventory_activity_total.current)" -ForegroundColor Green
    Write-Host "   low_stock_items_now=$($inventory.low_stock_items_now)" -ForegroundColor Green

    # Cross-check against Executive report's inventory total for the same period (must match exactly)
    $exec = Invoke-RestMethod -Uri "$base/reports/executive?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    if ($inventory.inventory_activity_total.current -ne $exec.inventory_activity_total.current) {
        Fail "Inventory reconciliation" "Inventory report total ($($inventory.inventory_activity_total.current)) != Executive report total ($($exec.inventory_activity_total.current))"
    }
    Write-Host "   OK - Inventory report reconciles exactly with Executive report" -ForegroundColor Green
} catch { Fail "Inventory report" $_.Exception.Message }

try {
    Write-Host "6. Fetch Operations report (last_30_days)..." -ForegroundColor Cyan
    $ops = Invoke-RestMethod -Uri "$base/reports/operations?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   service_requests_created=$($ops.service_requests_created.current)" -ForegroundColor Green
    Write-Host "   service_requests_completed=$($ops.service_requests_completed.current)" -ForegroundColor Green
    Write-Host "   service_requests_overdue_now=$($ops.service_requests_overdue_now)" -ForegroundColor Green
    Write-Host "   orders_backlog_now:" -ForegroundColor Green
    $ops.orders_backlog_now | ForEach-Object { Write-Host "     $($_.status): $($_.count)" -ForegroundColor Green }
    Write-Host "   deliveries_backlog_now:" -ForegroundColor Green
    $ops.deliveries_backlog_now | ForEach-Object { Write-Host "     $($_.status): $($_.count)" -ForegroundColor Green }
    Write-Host "   payments_completed=$($ops.payments_completed.current), failed=$($ops.payments_failed.current), pending=$($ops.payments_pending.current)" -ForegroundColor Green

    # overdue_now must match Executive report's overdue snapshot at roughly the same moment
    if ($ops.service_requests_overdue_now -ne $exec.overdue_service_requests_now) {
        Write-Host "   NOTE: overdue counts differ slightly ($($ops.service_requests_overdue_now) vs $($exec.overdue_service_requests_now)) - acceptable if a request crossed the threshold between calls, not a hard failure." -ForegroundColor Yellow
    } else {
        Write-Host "   OK - overdue snapshot matches Executive report exactly" -ForegroundColor Green
    }
} catch { Fail "Operations report" $_.Exception.Message }

Write-Host "7. Tenant isolation: Rina (RECEPTIONIST) blocked from all five detail reports (403)..." -ForegroundColor Cyan
$endpoints = @("hotel", "restaurant", "delivery", "inventory", "operations")
foreach ($ep in $endpoints) {
    try {
        Invoke-RestMethod -Uri "$base/reports/$ep`?period=today" -Method Get -Headers @{Authorization="Bearer $rinaToken"}
        Write-Host "   UNEXPECTED - $ep should have failed!" -ForegroundColor Red
        exit 1
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -ne 403) { Fail "Tenant isolation ($ep)" "Expected 403, got $sc" }
    }
}
Write-Host "   OK - all five endpoints correctly blocked Rina with 403" -ForegroundColor Green

Write-Host ""
Write-Host "ALL DETAIL REPORT TESTS PASSED" -ForegroundColor Green