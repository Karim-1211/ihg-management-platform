$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as SUPER_ADMIN and customer..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    $customerId = [string]$customer.user.id
    Write-Host "   OK - customer_id: $customerId" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Dispatch a BOOKING_CONFIRMED event directly..." -ForegroundColor Cyan
    $fakeEntityId = [string]([guid]::NewGuid())
    $eventBody = @{
        event_type = "BOOKING_CONFIRMED"
        actor_user_id = $customerId
        entity_type = "booking"
        entity_id = $fakeEntityId
        metadata = @{ customer_id = $customerId; booking_reference = "TESTBK001"; check_in_date = "2027-01-01"; check_out_date = "2027-01-03" }
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "$base/notifications/test-dispatch" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $eventBody
    Write-Host "   OK - dispatched, entity_id: $fakeEntityId" -ForegroundColor Green
} catch { Fail "Dispatch" $_.Exception.Message }

try {
    Write-Host "3. Verify customer received exactly 1 IN_APP notification..." -ForegroundColor Cyan
    $notifications = Invoke-RestMethod -Uri "$base/notifications" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $matching = @($notifications | Where-Object { [string]$_.related_entity_id -eq $fakeEntityId })
    if ($matching.Count -ne 1) { Fail "IN_APP count" "Expected 1, got $($matching.Count)" }
    $matchingNotification = $matching[0]
    Write-Host "   OK - title: $($matchingNotification.title), status: $($matchingNotification.status)" -ForegroundColor Green
} catch { Fail "Verify IN_APP" $_.Exception.Message }

try {
    Write-Host "4. Verify unread count reflects it..." -ForegroundColor Cyan
    $unread = Invoke-RestMethod -Uri "$base/notifications/unread-count" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Write-Host "   OK - unread_count: $($unread.unread_count)" -ForegroundColor Green
} catch { Fail "Unread count" $_.Exception.Message }

try {
    Write-Host "5. Mark it read, verify status flips..." -ForegroundColor Cyan
    $updated = Invoke-RestMethod -Uri "$base/notifications/$($matchingNotification.id)/read" -Method Patch -Headers @{Authorization="Bearer $customerToken"}
    if ($updated.status -ne "READ") { Fail "Mark read" "Expected READ, got $($updated.status)" }
    Write-Host "   OK - status: $($updated.status)" -ForegroundColor Green
} catch { Fail "Mark read" $_.Exception.Message }

Write-Host "6. Negative test: a DIFFERENT customer cannot mark this notification read..." -ForegroundColor Cyan
try {
    $otherCustomer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"guest@ihg.com","password":"GuestPass123"}'
    Invoke-RestMethod -Uri "$base/notifications/$($matchingNotification.id)/read" -Method Patch -Headers @{Authorization="Bearer $($otherCustomer.access_token)"} | Out-Null
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 404) { Write-Host "   OK - correctly blocked (404, no leak)" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 404, got $sc" }
}

try {
    Write-Host "7. Dispatch the SAME event again (duplicate) - should NOT create a second row..." -ForegroundColor Cyan
    $null = Invoke-RestMethod -Uri "$base/notifications/test-dispatch" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $eventBody
    $notificationsAfter = Invoke-RestMethod -Uri "$base/notifications" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $matchingAfter = @($notificationsAfter | Where-Object { [string]$_.related_entity_id -eq $fakeEntityId })
    if ($matchingAfter.Count -ne 1) { Fail "Idempotency check" "Expected still 1 row, got $($matchingAfter.Count)" }
    Write-Host "   OK - still exactly 1 row (idempotency constraint working)" -ForegroundColor Green
} catch { Fail "Duplicate dispatch test" $_.Exception.Message }

try {
    Write-Host "8. Dispatch a mandatory-email event (PAYMENT_COMPLETED)..." -ForegroundColor Cyan
    $payEventBody = @{
        event_type = "PAYMENT_COMPLETED"
        entity_type = "invoice"
        entity_id = [string]([guid]::NewGuid())
        metadata = @{ customer_id = $customerId; amount = "99.99"; invoice_number = "TESTINV001" }
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "$base/notifications/test-dispatch" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $payEventBody
    Write-Host "   OK - dispatched" -ForegroundColor Green
} catch { Fail "Dispatch payment event" $_.Exception.Message }

try {
    Write-Host "9. Process pending emails, verify PENDING -> SENT..." -ForegroundColor Cyan
    $result = Invoke-RestMethod -Uri "$base/notifications/process-pending" -Method Post -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - processed: $($result.processed), sent: $($result.sent), failed: $($result.failed)" -ForegroundColor Green
    if ($result.sent -lt 1) { Fail "Processor" "Expected at least 1 sent email" }
} catch { Fail "Process pending" $_.Exception.Message }

try {
    Write-Host "10. Check the email log as SUPER_ADMIN..." -ForegroundColor Cyan
    $emailLog = Invoke-RestMethod -Uri "$base/notifications/email-log" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - email log entries: $($emailLog.Count)" -ForegroundColor Green
} catch { Fail "Email log" $_.Exception.Message }

Write-Host ""
Write-Host "ALL ISOLATED NOTIFICATION TESTS PASSED" -ForegroundColor Green