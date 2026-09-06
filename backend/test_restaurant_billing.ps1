$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function Fail($step, $err) {
    Write-Host "   FAILED at: $step" -ForegroundColor Red
    Write-Host "   $err" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "1. Login as customer, waiter, kitchen..." -ForegroundColor Cyan
    $customer = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim1@test.com","password":"TestPass123"}'
    $customerToken = $customer.access_token
    $waiter = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"waiter@ihg.com","password":"WaiterPass123"}'
    $waiterToken = $waiter.access_token
    $kitchen = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"kitchen@ihg.com","password":"KitchenPass123"}'
    $kitchenToken = $kitchen.access_token
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Login" $_.Exception.Message }

try {
    Write-Host "2. Get restaurant, forcibly free a table, and get a menu item..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $restaurantId = $restaurants[0].id
    $tables = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/tables" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    $table = $tables[0]

    if ($table.status -ne "AVAILABLE") {
        $freeBody = @{ status = "AVAILABLE" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/restaurant-tables/$($table.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $waiterToken"} -Body $freeBody | Out-Null
        Write-Host "   (Table was $($table.status), reset to AVAILABLE)" -ForegroundColor DarkGray
    }

    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id
    Write-Host "   OK - using table $($table.table_number)" -ForegroundColor Green
} catch { Fail "Setup" $_.Exception.Message }

try {
    Write-Host "3. Place a fresh DINE_IN order..." -ForegroundColor Cyan
    $orderBody = @{
        restaurant_id = $restaurantId; order_type = "DINE_IN"; table_id = $table.id
        items = @(@{ menu_item_id = $menuItemId; quantity = 1 })
    } | ConvertTo-Json -Depth 5
    $order = Invoke-RestMethod -Uri "$base/orders" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $orderBody
    Write-Host "   OK - order: $($order.order_number), total: $($order.total_amount)" -ForegroundColor Green
} catch { Fail "Create order" $_.Exception.Message }

try {
    Write-Host "4. Confirm there is NO invoice yet (should 404)..." -ForegroundColor Cyan
    try {
        Invoke-RestMethod -Uri "$base/restaurant-invoices/order/$($order.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"} | Out-Null
        Write-Host "   UNEXPECTED - invoice should not exist before SERVED!" -ForegroundColor Red
        exit 1
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -eq 404) { Write-Host "   OK - correctly no invoice yet" -ForegroundColor Green }
        else { Fail "Pre-check" "Expected 404, got $sc" }
    }
} catch { Fail "Pre-check invoice" $_.Exception.Message }

try {
    Write-Host "5. Advance order: NEW -> CONFIRMED (waiter) -> PREPARING (kitchen) -> READY (kitchen) -> SERVED (waiter)..." -ForegroundColor Cyan
    $steps = @(
        @{ status = "CONFIRMED"; token = $waiterToken },
        @{ status = "PREPARING"; token = $kitchenToken },
        @{ status = "READY"; token = $kitchenToken },
        @{ status = "SERVED"; token = $waiterToken }
    )
    foreach ($s in $steps) {
        $body = @{ status = $s.status } | ConvertTo-Json
        $order = Invoke-RestMethod -Uri "$base/orders/$($order.id)/status" -Method Patch -ContentType "application/json" -Headers @{Authorization="Bearer $($s.token)"} -Body $body
        Write-Host "     -> $($order.status)" -ForegroundColor DarkGray
    }
    Write-Host "   OK - order is SERVED" -ForegroundColor Green
} catch { Fail "Advance order" $_.Exception.Message }

try {
    Write-Host "6. Fetch the auto-generated invoice (proves SERVED triggers billing)..." -ForegroundColor Cyan
    $invoice = Invoke-RestMethod -Uri "$base/restaurant-invoices/order/$($order.id)" -Method Get -Headers @{Authorization="Bearer $customerToken"}
    Write-Host "   OK - invoice: $($invoice.invoice_number), total: $($invoice.total_amount), status: $($invoice.status)" -ForegroundColor Green
    if ($invoice.status -ne "UNPAID") { Fail "Invoice status" "Expected UNPAID, got $($invoice.status)" }
} catch { Fail "Fetch invoice" $_.Exception.Message }

try {
    Write-Host "7. Pay the invoice as customer..." -ForegroundColor Cyan
    $payBody = @{ payment_method = "DEMO" } | ConvertTo-Json
    $payment = Invoke-RestMethod -Uri "$base/restaurant-invoices/$($invoice.id)/pay" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $customerToken"} -Body $payBody
    Write-Host "   OK - paid $($payment.amount)" -ForegroundColor Green
} catch { Fail "Pay invoice" $_.Exception.Message }

Write-Host ""
Write-Host "ALL RESTAURANT BILLING TESTS PASSED (fresh cycle, end-to-end)" -ForegroundColor Green
Write-Host "Order: $($order.order_number)  Invoice: $($invoice.invoice_number)  Table: $($table.table_number)" -ForegroundColor Yellow