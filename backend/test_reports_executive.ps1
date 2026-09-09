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
    Write-Host "2. Fetch executive report (last_30_days) as SUPER_ADMIN..." -ForegroundColor Cyan
    $report = Invoke-RestMethod -Uri "$base/reports/executive?period=last_30_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - period: $($report.period.start) to $($report.period.end)" -ForegroundColor Green
    Write-Host "   compare period: $($report.period.compare_start) to $($report.period.compare_end)" -ForegroundColor Green
    Write-Host "   Revenue: current=$($report.revenue.current) previous=$($report.revenue.previous) change=$($report.revenue.change_label)" -ForegroundColor Green
    Write-Host "   Bookings created: $($report.bookings_created.current)" -ForegroundColor Green
    Write-Host "   Orders created: $($report.orders_created.current) (dine_in=$($report.orders_by_type.dine_in.current), room_service=$($report.orders_by_type.room_service.current), delivery=$($report.orders_by_type.delivery.current))" -ForegroundColor Green
    Write-Host "   Failed payments: $($report.failed_payments.current)" -ForegroundColor Green
    Write-Host "   Inventory activity total: $($report.inventory_activity_total.current)" -ForegroundColor Green
    Write-Host "   Inventory by type - purchase=$($report.inventory_activity_by_type.purchase) order_usage=$($report.inventory_activity_by_type.order_usage) waste=$($report.inventory_activity_by_type.waste) return=$($report.inventory_activity_by_type.return) service_usage=$($report.inventory_activity_by_type.service_usage) manual_adjustment=$($report.inventory_activity_by_type.manual_adjustment)" -ForegroundColor Green
    Write-Host "   Overdue service requests (now): $($report.overdue_service_requests_now)" -ForegroundColor Green

    # Confirm 'return' key surfaced correctly (not 'return_')
    if ($null -eq $report.inventory_activity_by_type.return) { Fail "Alias check" "Expected JSON key 'return', got something else" }
    Write-Host "   OK - 'return' alias correctly present in JSON (not 'return_')" -ForegroundColor Green
} catch { Fail "Fetch executive report" $_.Exception.Message }

Write-Host "3. Verify duration-based comparison period math (last_7_days)..." -ForegroundColor Cyan
try {
    $report7 = Invoke-RestMethod -Uri "$base/reports/executive?period=last_7_days" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $curStart = [datetime]$report7.period.start
    $curEnd = [datetime]$report7.period.end
    $cmpStart = [datetime]$report7.period.compare_start
    $cmpEnd = [datetime]$report7.period.compare_end
    $currentDuration = ($curEnd - $curStart).Days + 1
    $compareDuration = ($cmpEnd - $cmpStart).Days + 1
    if ($currentDuration -ne $compareDuration) { Fail "Duration check" "current=$currentDuration days, compare=$compareDuration days - should match" }
    if ($cmpEnd -ne $curStart.AddDays(-1)) { Fail "Adjacency check" "compare_end should be exactly one day before current start" }
    Write-Host "   OK - current: $currentDuration days, compare: $compareDuration days, adjacent with no gap/overlap" -ForegroundColor Green
} catch { Fail "Period math check" $_.Exception.Message }

Write-Host "4. Custom period validation: start after end should fail (422)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/reports/executive?period=custom&start=2026-09-30&end=2026-09-01" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 422) { Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green }
    else { Fail "Custom period validation" "Expected 422, got $sc" }
}

Write-Host "5. Unsupported preset should fail (422)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/reports/executive?period=not_a_real_preset" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 422) { Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green }
    else { Fail "Unsupported preset" "Expected 422, got $sc" }
}

Write-Host "6. Tenant isolation: Rina (RECEPTIONIST) cannot access reports (403)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/reports/executive?period=today" -Method Get -Headers @{Authorization="Bearer $rinaToken"}
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403) { Write-Host "   OK - correctly blocked with 403" -ForegroundColor Green }
    else { Fail "Tenant isolation" "Expected 403, got $sc" }
}

try {
    Write-Host "7. Reconciliation: 'today' report revenue must match Dashboard's revenue_today..." -ForegroundColor Cyan
    $reportToday = Invoke-RestMethod -Uri "$base/reports/executive?period=today" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $dashboard = Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   Report revenue (today): $($reportToday.revenue.current)" -ForegroundColor Green
    Write-Host "   Dashboard revenue_today: $($dashboard.financial.revenue_today)" -ForegroundColor Green
    if ([math]::Round($reportToday.revenue.current, 2) -ne [math]::Round($dashboard.financial.revenue_today, 2)) {
        Fail "Reconciliation" "Report and Dashboard revenue disagree: $($reportToday.revenue.current) vs $($dashboard.financial.revenue_today)"
    }
    Write-Host "   OK - Report and Dashboard revenue reconcile exactly" -ForegroundColor Green
} catch { Fail "Reconciliation check" $_.Exception.Message }

try {
    Write-Host "8. Reconciliation: 'today' orders_created total must match Dashboard's orders_today.total..." -ForegroundColor Cyan
    if ($reportToday.orders_created.current -ne $dashboard.restaurant.orders_today.total) {
        Fail "Orders reconciliation" "Report orders_created=$($reportToday.orders_created.current) vs Dashboard orders_today.total=$($dashboard.restaurant.orders_today.total)"
    }
    Write-Host "   OK - Report orders_created reconciles with Dashboard orders_today.total" -ForegroundColor Green
} catch { Fail "Orders reconciliation" $_.Exception.Message }

Write-Host ""
Write-Host "ALL EXECUTIVE REPORT TESTS PASSED" -ForegroundColor Green