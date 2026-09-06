$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as SUPER_ADMIN, customer, waiter..." -ForegroundColor Cyan
    $admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
    $adminToken = $admin.access_token
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    $waiter = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"waiter@ihg.com","password":"WaiterPass123"}'
    $waiterToken = $waiter.access_token
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Get restaurant, an available table, and the menu item with a recipe attached..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurantId = $restaurants[0].id
    $tables = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $availableTable = $tables | Where-Object { $_.status -eq "AVAILABLE" } | Select-Object -First 1
    if (-not $availableTable) {
        $freeBody = @{ status = "AVAILABLE" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/restaurant-tables/$($tables[0].id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $freeBody | Out-Null
        $availableTable = $tables[0]
    }
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id
    Write-Host "   OK - table: $($availableTable.table_number)" -ForegroundColor Green
} catch { Fail "Setup" $_.Exception.Message }

try {
    Write-Host "3. Check current inventory level for Chicken Breast..." -ForegroundColor Cyan
    $items = Invoke-RestMethod -Uri "$base/inventory/restaurant/$restaurantId" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $chicken = $items | Where-Object { $_.name -eq "Chicken Breast" }
    $qtyBefore = [decimal]$chicken.current_quantity
    Write-Host "   OK - current stock: $qtyBefore kg" -ForegroundColor Green
} catch { Fail "Check inventory" $_.Exception.Message }

try {
    Write-Host "4. Place a DINE_IN order for 2x the recipe-linked menu item..." -ForegroundColor Cyan
    $orderBody = @{
        restaurant_id = $restaurantId; order_type = "DINE_IN"; table_id = $availableTable.id
        items = @(@{ menu_item_id = $menuItemId; quantity = 2 })
    } | ConvertTo-Json -Depth 5
    $order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $orderBody
    Write-Host "   OK - order: $($order.order_number), status: $($order.status)" -ForegroundColor Green
} catch { Fail "Create order" $_.Exception.Message }

try {
    Write-Host "5. Confirm the order (this should trigger automatic deduction: 0.2kg x 2 = 0.4kg)..." -ForegroundColor Cyan
    $confirmBody = @{ status = "CONFIRMED" } | ConvertTo-Json
    $confirmedOrder = Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $confirmBody
    Write-Host "   OK - order status: $($confirmedOrder.status)" -ForegroundColor Green
} catch { Fail "Confirm order" $_.Exception.Message }

try {
    Write-Host "6. Verify stock was actually deducted by 0.4kg..." -ForegroundColor Cyan
    $itemsAfter = Invoke-RestMethod -Uri "$base/inventory/restaurant/$restaurantId" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $chickenAfter = $itemsAfter | Where-Object { $_.name -eq "Chicken Breast" }
    $qtyAfter = [decimal]$chickenAfter.current_quantity
    $expected = $qtyBefore - 0.4
    Write-Host "   OK - stock before: $qtyBefore, after: $qtyAfter (expected: $expected)" -ForegroundColor Green
    if ($qtyAfter -ne $expected) { Fail "Deduction math" "Expected $expected, got $qtyAfter" }
} catch { Fail "Verify deduction" $_.Exception.Message }

try {
    Write-Host "7. Verify a stock transaction record was created (type=ORDER_USAGE)..." -ForegroundColor Cyan
    $history = Invoke-RestMethod -Uri "$base/inventory/items/$($chicken.id)/transactions" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $orderUsageTxn = $history | Where-Object { $_.transaction_type -eq "ORDER_USAGE" } | Select-Object -First 1
    if (-not $orderUsageTxn) { Fail "Transaction check" "No ORDER_USAGE transaction found" }
    Write-Host "   OK - transaction found: -$($orderUsageTxn.quantity) kg, notes: $($orderUsageTxn.notes)" -ForegroundColor Green
} catch { Fail "Verify transaction" $_.Exception.Message }

try {
    Write-Host "8. Place another order requiring MORE stock than available, then try to confirm (should fail with 409, stock unchanged)..." -ForegroundColor Cyan
    $bigOrderBody = @{
        restaurant_id = $restaurantId; order_type = "DINE_IN"; table_id = $availableTable.id
        items = @(@{ menu_item_id = $menuItemId; quantity = 1000 })
    } | ConvertTo-Json -Depth 5
    $bigOrder = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $bigOrderBody

    try {
        Invoke-RestMethod -Uri "$base/orders/$($bigOrder.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $confirmBody
        Write-Host "   UNEXPECTED - should have failed due to insufficient stock!" -ForegroundColor Red
        exit 1
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -ne 409) { Fail "Negative test" "Expected 409, got $sc" }
        Write-Host "   OK - correctly blocked with 409 (insufficient stock)" -ForegroundColor Green
    }

    $itemsStillSame = Invoke-RestMethod -Uri "$base/inventory/restaurant/$restaurantId" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $chickenStillSame = $itemsStillSame | Where-Object { $_.name -eq "Chicken Breast" }
    if ([decimal]$chickenStillSame.current_quantity -ne $qtyAfter) {
        Fail "Atomicity check" "Stock changed even though confirmation failed! before=$qtyAfter after=$($chickenStillSame.current_quantity)"
    }
    Write-Host "   OK - stock unchanged after failed confirmation (atomicity confirmed)" -ForegroundColor Green

    $orderStillNew = Invoke-RestMethod -Uri "$base/orders/restaurant/$restaurantId" -Method Get -Headers @{Authorization="Bearer $waiterToken"}
    $theBigOrder = $orderStillNew | Where-Object { $_.id -eq $bigOrder.id }
    if ($theBigOrder.status -ne "NEW") { Fail "Order status check" "Expected order to stay NEW, got $($theBigOrder.status)" }
    Write-Host "   OK - order status remained NEW (not partially confirmed)" -ForegroundColor Green
} catch { Fail "Insufficient stock test" $_.Exception.Message }

Write-Host ""
Write-Host "ALL INVENTORY DEDUCTION TESTS PASSED" -ForegroundColor Green