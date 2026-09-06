$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as Receptionist (Rina)..." -ForegroundColor Cyan
    $rina = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"rina@ihg.com","password":"TestPass123"}'
    $rinaToken = $rina.access_token
    Write-Host "   OK - Rina token acquired" -ForegroundColor Green
} catch { Fail "Login as Rina" $_.Exception.Message }

try {
    Write-Host "2. Login as SUPER_ADMIN (Karim)..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    Write-Host "   OK - Admin token acquired" -ForegroundColor Green
} catch { Fail "Login as Admin" $_.Exception.Message }

try {
    Write-Host "3. Login as Customer..." -ForegroundColor Cyan
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    Write-Host "   OK - Customer token acquired" -ForegroundColor Green
} catch { Fail "Login as Customer" $_.Exception.Message }

try {
    Write-Host "4. Get an actual room id..." -ForegroundColor Cyan
    $rooms = Invoke-RestMethod -Uri "$base/rooms" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $roomId = $rooms[0].id
    Write-Host "   OK - room_id: $roomId" -ForegroundColor Green
} catch { Fail "Get rooms" $_.Exception.Message }

try {
    Write-Host "5. Create a booking as Customer..." -ForegroundColor Cyan
    $bookingBody = @{
        room_id = $roomId
        check_in_date = "2027-01-15"
        check_out_date = "2027-01-17"
        number_of_guests = 1
    } | ConvertTo-Json
    $booking = Invoke-RestMethod -Uri "$base/bookings" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $bookingBody
    Write-Host "   OK - booking_id: $($booking.id)" -ForegroundColor Green
} catch { Fail "Create booking" $_.Exception.Message }

try {
    Write-Host "6. Check in as Rina..." -ForegroundColor Cyan
    $checkedIn = Invoke-RestMethod -Uri "$base/bookings/$($booking.id)/check-in" -Method Post -Headers @{Authorization="Bearer $rinaToken"}
    Write-Host "   OK - status: $($checkedIn.status)" -ForegroundColor Green
} catch { Fail "Check in" $_.Exception.Message }

try {
    Write-Host "7. Create and complete a FOOD service request..." -ForegroundColor Cyan
    $requestBody = @{ booking_id = $booking.id; request_type = "FOOD"; description = "Coffee" } | ConvertTo-Json
    $serviceRequest = Invoke-RestMethod -Uri "$base/service-requests" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $requestBody
    $completeBody = @{ status = "COMPLETED"; price = 5.00 } | ConvertTo-Json
    $completed = Invoke-RestMethod -Uri "$base/service-requests/$($serviceRequest.id)" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $rinaToken"} -Body $completeBody
    Write-Host "   OK - request completed with price $($completed.price)" -ForegroundColor Green
} catch { Fail "Service request" $_.Exception.Message }

try {
    Write-Host "8. Check out as Rina (generates invoice)..." -ForegroundColor Cyan
    $checkedOut = Invoke-RestMethod -Uri "$base/bookings/$($booking.id)/check-out" -Method Post -Headers @{Authorization="Bearer $rinaToken"}
    Write-Host "   OK - status: $($checkedOut.status)" -ForegroundColor Green
} catch { Fail "Check out" $_.Exception.Message }

try {
    Write-Host "9. Pay the invoice..." -ForegroundColor Cyan
    $invoice = Invoke-RestMethod -Uri "$base/invoices/booking/$($booking.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $payBody = @{ payment_method = "DEMO" } | ConvertTo-Json
    $payment = Invoke-RestMethod -Uri "$base/invoices/$($invoice.id)/pay" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $payBody
    Write-Host "   OK - paid $($payment.amount)" -ForegroundColor Green
} catch { Fail "Pay invoice" $_.Exception.Message }

try {
    Write-Host "10. Fetch audit logs as SUPER_ADMIN and verify entries exist..." -ForegroundColor Cyan
    $logs = Invoke-RestMethod -Uri "$base/audit-logs" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - total audit log entries:" $logs.Count -ForegroundColor Green

    $expectedActions = @("CREATE_BOOKING", "CHECK_IN", "COMPLETE_SERVICE_REQUEST", "CHECK_OUT", "GENERATE_INVOICE", "PAY_INVOICE")
    $foundActions = $logs | Select-Object -ExpandProperty action -Unique
    $missing = $expectedActions | Where-Object { $_ -notin $foundActions }
    if ($missing.Count -gt 0) {
        Fail "Audit log completeness" ("Missing expected action types: " + ($missing -join ", "))
    }
    Write-Host "   OK - all expected action types are present in the log" -ForegroundColor Green
} catch { Fail "Fetch audit logs" $_.Exception.Message }

Write-Host "11. Negative test: Customer tries to view audit logs (should fail with 403)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$base/audit-logs" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Write-Host "   UNEXPECTED - customer should not see audit logs!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
        Write-Host "   OK - correctly blocked with 403" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 403, got $statusCode"
    }
}

Write-Host ""
Write-Host "ALL HARDENING TESTS PASSED" -ForegroundColor Green