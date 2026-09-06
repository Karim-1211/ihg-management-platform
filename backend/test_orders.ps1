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
    Write-Host "2. Get restaurant, table, and menu item..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurantId = $restaurants[0].id
    $tables = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $tableId = $tables[0].id
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id
    $menuItemPrice = $menu[0].items[0].price
    Write-Host "   OK - menu_item price: $menuItemPrice" -ForegroundColor Green
} catch { Fail "Get menu" $_.Exception.Message }

try {
    Write-Host "3. Create a DINE_IN order with 2x the item..." -ForegroundColor Cyan
    $orderBody = @{
        restaurant_id = $restaurantId
        order_type = "DINE_IN"
        table_id = $tableId
        items = @(@{ menu_item_id = $menuItemId; quantity = 2 })
    } | ConvertTo-Json -Depth 5
    $order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $orderBody
    $expectedSubtotal = [math]::Round($menuItemPrice * 2, 2)
    Write-Host "   OK - order_number: $($order.order_number), subtotal: $($order.subtotal) (expected ~$expectedSubtotal), total: $($order.total_amount)" -ForegroundColor Green
} catch { Fail "Create order" $_.Exception.Message }

Write-Host "4. Negative test: DINE_IN order without table_id (should fail with 422)..." -ForegroundColor Cyan
try {
    $badBody = @{ restaurant_id = $restaurantId; order_type = "DINE_IN"; items = @(@{ menu_item_id = $menuItemId; quantity = 1 }) } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $badBody
    Write-Host "   UNEXPECTED - missing table_id should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 422) {
        Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 422, got $statusCode"
    }
}

Write-Host "5. Negative test: DELIVERY order type (not yet enabled, should fail with 501)..." -ForegroundColor Cyan
try {
    $deliveryBody = @{ restaurant_id = $restaurantId; order_type = "DELIVERY"; delivery_address = "123 Main St"; items = @(@{ menu_item_id = $menuItemId; quantity = 1 }) } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $deliveryBody
    Write-Host "   UNEXPECTED - DELIVERY should not be enabled yet!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 501) {
        Write-Host "   OK - correctly blocked with 501 (reserved for later phase)" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 501, got $statusCode"
    }
}

try {
    Write-Host "6. Kitchen workflow: NEW -> CONFIRMED -> PREPARING -> READY -> SERVED..." -ForegroundColor Cyan
    foreach ($nextStatus in @("CONFIRMED", "PREPARING", "READY", "SERVED")) {
        $statusBody = @{ status = $nextStatus } | ConvertTo-Json
        $order = Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $statusBody
        Write-Host "     -> $($order.status)" -ForegroundColor DarkGray
    }
    Write-Host "   OK - reached SERVED" -ForegroundColor Green
} catch { Fail "Kitchen workflow" $_.Exception.Message }

Write-Host "7. Negative test: illegal status jump from SERVED to PREPARING (should fail with 409)..." -ForegroundColor Cyan
try {
    $illegalBody = @{ status = "PREPARING" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $illegalBody
    Write-Host "   UNEXPECTED - illegal transition should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "   OK - correctly blocked with 409" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 409, got $statusCode"
    }
}

Write-Host ""
Write-Host "ALL ORDER TESTS PASSED" -ForegroundColor Green