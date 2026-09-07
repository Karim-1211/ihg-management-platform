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
    Write-Host "2. Fetch dashboard overview as SUPER_ADMIN..." -ForegroundColor Cyan
    $overview = Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - occupancy: $($overview.hotel.current_occupancy_percent)%, check-ins: $($overview.hotel.check_ins_today), check-outs: $($overview.hotel.check_outs_today)" -ForegroundColor Green
    Write-Host "   Orders today: $($overview.restaurant.orders_today.total) (dine_in=$($overview.restaurant.orders_today.dine_in), room_service=$($overview.restaurant.orders_today.room_service), delivery=$($overview.restaurant.orders_today.delivery))" -ForegroundColor Green
    Write-Host "   Active deliveries: $($overview.delivery.active_deliveries)" -ForegroundColor Green
    Write-Host "   Low stock: $($overview.inventory.low_stock_count)" -ForegroundColor Green
    Write-Host "   Revenue today: `$$($overview.financial.revenue_today)" -ForegroundColor Green
    Write-Host "   Attention items: $($overview.attention.Count)" -ForegroundColor Green
    foreach ($item in $overview.attention) { Write-Host "     - $($item.label)" -ForegroundColor Yellow }
} catch { Fail "Fetch overview" $_.Exception.Message }

try {
    Write-Host "3. Login as Rina (RECEPTIONIST) and confirm dashboard access is rejected (403)..." -ForegroundColor Cyan
    $rina = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"rina@ihg.com","password":"TestPass123"}'
    $rinaToken = $rina.access_token
    try {
        Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $rinaToken"}
        Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
        exit 1
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -eq 403) { Write-Host "   OK - correctly blocked with 403" -ForegroundColor Green }
        else { Fail "Negative test" "Expected 403, got $sc" }
    }
} catch { Fail "Receptionist test" $_.Exception.Message }

try {
    Write-Host "4. Place a fresh order + pay a fresh invoice, then confirm revenue/orders increased..." -ForegroundColor Cyan
    $before = Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $revenueBefore = $before.financial.revenue_today
    $ordersBefore = $before.restaurant.orders_today.total

    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    $waiter = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"waiter@ihg.com","password":"WaiterPass123"}'
    $waiterToken = $waiter.access_token
    $kitchen = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"kitchen@ihg.com","password":"KitchenPass123"}'
    $kitchenToken = $kitchen.access_token

    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurantId = $restaurants[0].id
    $tables = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $availableTable = $tables | Where-Object { $_.status -eq "AVAILABLE" } | Select-Object -First 1
    if (-not $availableTable) { $availableTable = $tables[0] }
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id

    $orderBody = @{ restaurant_id = $restaurantId; order_type = "DINE_IN"; table_id = $availableTable.id; items = @(@{ menu_item_id = $menuItemId; quantity = 1 }) } | ConvertTo-Json -Depth 5
    $order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $orderBody

    $confirmBody = @{ status = "CONFIRMED" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $confirmBody | Out-Null
    $prepBody = @{ status = "PREPARING" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $kitchenToken"} -Body $prepBody | Out-Null
    $readyBody = @{ status = "READY" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $kitchenToken"} -Body $readyBody | Out-Null
    $servedBody = @{ status = "SERVED" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $servedBody | Out-Null

    $invoice = Invoke-RestMethod -Uri "$base/restaurant-invoices/order/$($order.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Invoke-RestMethod -Uri "$base/restaurant-invoices/$($invoice.id)/pay" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body '{"payment_method":"DEMO"}' | Out-Null

    $after = Invoke-RestMethod -Uri "$base/dashboard/overview" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $revenueAfter = $after.financial.revenue_today
    $ordersAfter = $after.restaurant.orders_today.total

    Write-Host "   Revenue: $revenueBefore -> $revenueAfter" -ForegroundColor Green
    Write-Host "   Orders: $ordersBefore -> $ordersAfter" -ForegroundColor Green

    if ($ordersAfter -ne ($ordersBefore + 1)) { Fail "Orders count check" "Expected $($ordersBefore + 1), got $ordersAfter" }
    if ($revenueAfter -le $revenueBefore) { Fail "Revenue check" "Expected revenue to increase, before=$revenueBefore after=$revenueAfter" }
    Write-Host "   OK - dashboard correctly reflects new order and new revenue" -ForegroundColor Green
} catch { Fail "Live data change test" $_.Exception.Message }

Write-Host ""
Write-Host "ALL DASHBOARD TESTS PASSED" -ForegroundColor Green