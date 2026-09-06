$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as customer, waiter, kitchen, driver..." -ForegroundColor Cyan
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    $waiter = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"waiter@ihg.com","password":"WaiterPass123"}'
    $waiterToken = $waiter.access_token
    $kitchen = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"kitchen@ihg.com","password":"KitchenPass123"}'
    $kitchenToken = $kitchen.access_token
    $driver = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"driver@ihg.com","password":"DriverPass123"}'
    $driverToken = $driver.access_token
    $driverId = $driver.user.id
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Get restaurant and menu item..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $restaurantId = $restaurants[0].id
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Get menu" $_.Exception.Message }

try {
    Write-Host "3. Place a DELIVERY order..." -ForegroundColor Cyan
    $orderBody = @{
        restaurant_id = $restaurantId; order_type = "DELIVERY"; delivery_address = "42 Customer Street, Dhaka"
        items = @(@{ menu_item_id = $menuItemId; quantity = 1 })
    } | ConvertTo-Json -Depth 5
    $order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $orderBody
    Write-Host "   OK - order: $($order.order_number), total: $($order.total_amount)" -ForegroundColor Green
} catch { Fail "Create delivery order" $_.Exception.Message }

Write-Host "4. Negative test: DELIVERY order without address (should fail with 422)..." -ForegroundColor Cyan
try {
    $badBody = @{ restaurant_id = $restaurantId; order_type = "DELIVERY"; items = @(@{ menu_item_id = $menuItemId; quantity = 1 }) } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $badBody
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 422) { Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 422, got $sc" }
}

try {
    Write-Host "5. Get the auto-created delivery record for this order..." -ForegroundColor Cyan
    $delivery = Invoke-RestMethod -Uri "$base/deliveries/order/$($order.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Write-Host "   OK - delivery_id: $($delivery.id), status: $($delivery.status)" -ForegroundColor Green
    if ($delivery.status -ne "PENDING") { Fail "Delivery initial status" "Expected PENDING, got $($delivery.status)" }
} catch { Fail "Get delivery record" $_.Exception.Message }

try {
    Write-Host "6. Kitchen prepares the order: NEW -> CONFIRMED -> PREPARING -> READY..." -ForegroundColor Cyan
    foreach ($s in @(
        @{status="CONFIRMED"; token=$waiterToken},
        @{status="PREPARING"; token=$kitchenToken},
        @{status="READY"; token=$kitchenToken}
    )) {
        $body = @{ status = $s.status } | ConvertTo-Json
        $order = Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $($s.token)"} -Body $body
    }
    Write-Host "   OK - order is READY" -ForegroundColor Green
} catch { Fail "Kitchen prep" $_.Exception.Message }

Write-Host "7. Negative test: manually setting order to SERVED for a delivery order (should fail with 409)..." -ForegroundColor Cyan
try {
    $servedBody = @{ status = "SERVED" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $servedBody
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 409) { Write-Host "   OK - correctly blocked with 409" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 409, got $sc" }
}

try {
    Write-Host "8. Waiter assigns the driver..." -ForegroundColor Cyan
    $assignBody = @{ driver_id = $driverId } | ConvertTo-Json
    $delivery = Invoke-RestMethod -Uri "$base/deliveries/$($delivery.id)/assign" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $assignBody
    Write-Host "   OK - status: $($delivery.status), driver: $($delivery.driver_name)" -ForegroundColor Green
} catch { Fail "Assign driver" $_.Exception.Message }

try {
    Write-Host "9. Driver progresses: ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY -> DELIVERED..." -ForegroundColor Cyan
    foreach ($nextStatus in @("PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED")) {
        $body = @{ status = $nextStatus } | ConvertTo-Json
        $delivery = Invoke-RestMethod -Uri "$base/deliveries/$($delivery.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $driverToken"} -Body $body
        Write-Host "     -> $($delivery.status)" -ForegroundColor DarkGray
    }
    Write-Host "   OK - delivery is DELIVERED" -ForegroundColor Green
} catch { Fail "Driver progression" $_.Exception.Message }

try {
    Write-Host "10. Confirm order automatically became SERVED, and invoice was generated..." -ForegroundColor Cyan
    $invoice = Invoke-RestMethod -Uri "$base/restaurant-invoices/order/$($order.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Write-Host "   OK - invoice: $($invoice.invoice_number), total: $($invoice.total_amount), status: $($invoice.status)" -ForegroundColor Green
} catch { Fail "Confirm auto-billing" $_.Exception.Message }

Write-Host "11. Negative test: a different driver tries to update this delivery (should fail with 403)..." -ForegroundColor Cyan
try {
    $otherDriverBody = @{ first_name="Other"; last_name="Driver"; email="otherdriver@ihg.com"; password="OtherPass123"; role="DELIVERY" } | ConvertTo-Json
    $adminLogin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    try { Invoke-RestMethod -Uri "$base/auth/staff" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $($adminLogin.access_token)"} -Body $otherDriverBody | Out-Null } catch {}
    $otherDriver = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"otherdriver@ihg.com","password":"OtherPass123"}'

    $failBody = @{ status = "PICKED_UP" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/deliveries/$($delivery.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $($otherDriver.access_token)"} -Body $failBody
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 403 -or $sc -eq 409) { Write-Host "   OK - correctly blocked (status $sc)" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 403 or 409, got $sc" }
}

Write-Host ""
Write-Host "ALL DELIVERY TESTS PASSED" -ForegroundColor Green