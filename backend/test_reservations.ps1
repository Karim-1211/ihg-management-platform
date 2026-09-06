$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as SUPER_ADMIN and Customer..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Get an existing restaurant table..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurantId = $restaurants[0].id
    $tables = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $tableId = $tables[0].id
    Write-Host "   OK - table_id: $tableId, capacity: $($tables[0].capacity)" -ForegroundColor Green
} catch { Fail "Get table" $_.Exception.Message }

try {
    Write-Host "3. Create a reservation as Customer (default duration)..." -ForegroundColor Cyan
    $resBody = @{ table_id = $tableId; reservation_start = "2027-02-01T18:00:00"; party_size = 2 } | ConvertTo-Json
    $reservation = Invoke-RestMethod -Uri "$base/reservations" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $resBody
    Write-Host "   OK - reservation_id: $($reservation.id), start: $($reservation.reservation_start), end: $($reservation.reservation_end)" -ForegroundColor Green
} catch { Fail "Create reservation" $_.Exception.Message }

Write-Host "4. Negative test: overlapping reservation on same table (should fail with 409)..." -ForegroundColor Cyan
try {
    $overlapBody = @{ table_id = $tableId; reservation_start = "2027-02-01T18:30:00"; party_size = 2 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/reservations" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $overlapBody
    Write-Host "   UNEXPECTED - overlapping reservation should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "   OK - correctly blocked with 409" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 409, got $statusCode"
    }
}

try {
    Write-Host "5. Non-overlapping reservation (later same day) succeeds..." -ForegroundColor Cyan
    $laterBody = @{ table_id = $tableId; reservation_start = "2027-02-01T20:00:00"; party_size = 2 } | ConvertTo-Json
    $laterReservation = Invoke-RestMethod -Uri "$base/reservations" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $laterBody
    Write-Host "   OK - reservation_id: $($laterReservation.id)" -ForegroundColor Green
} catch { Fail "Non-overlapping reservation" $_.Exception.Message }

Write-Host "6. Negative test: party size exceeds table capacity (should fail with 422)..." -ForegroundColor Cyan
try {
    $tooManyBody = @{ table_id = $tableId; reservation_start = "2027-02-02T18:00:00"; party_size = 999 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/reservations" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $tooManyBody
    Write-Host "   UNEXPECTED - oversized party should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 422) {
        Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 422, got $statusCode"
    }
}

try {
    Write-Host "7. SUPER_ADMIN seats the first reservation, table becomes OCCUPIED..." -ForegroundColor Cyan
    $seatBody = @{ status = "SEATED" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/reservations/$($reservation.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $seatBody
    $updatedTable = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $tableNowStatus = ($updatedTable | Where-Object { $_.id -eq $tableId }).status
    if ($tableNowStatus -ne "OCCUPIED") { Fail "Table status cascade" "Expected OCCUPIED, got $tableNowStatus" }
    Write-Host "   OK - table status is now $tableNowStatus" -ForegroundColor Green
} catch { Fail "Seat reservation" $_.Exception.Message }

Write-Host ""
Write-Host "ALL RESERVATION TESTS PASSED" -ForegroundColor Green