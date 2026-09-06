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
    Write-Host "2. Get restaurant..." -ForegroundColor Cyan
    $restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $restaurantId = $restaurants[0].id
    Write-Host "   OK" -ForegroundColor Green
} catch { Fail "Get restaurant" $_.Exception.Message }

try {
    Write-Host "3. Create a restaurant-scoped inventory item (Chicken)..." -ForegroundColor Cyan
    $itemBody = @{ restaurant_id = $restaurantId; name = "Chicken Breast"; unit = "kg"; current_quantity = 20; minimum_quantity = 5 } | ConvertTo-Json
    $item = Invoke-RestMethod -Uri "$base/inventory/items" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $itemBody
    Write-Host "   OK - item_id: $($item.id), qty: $($item.current_quantity), low_stock: $($item.is_low_stock)" -ForegroundColor Green
} catch { Fail "Create item" $_.Exception.Message }

Write-Host "4. Negative test: create item with BOTH hotel_id and restaurant_id (should fail with 422)..." -ForegroundColor Cyan
try {
    $hotels = Invoke-RestMethod -Uri "$base/hotels" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $hotelId = $hotels[0].id
    $badBody = @{ hotel_id = $hotelId; restaurant_id = $restaurantId; name = "Bad Item"; unit = "kg" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/inventory/items" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $badBody
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 422) { Write-Host "   OK - correctly blocked with 422" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 422, got $sc" }
}

try {
    Write-Host "5. Record a PURCHASE transaction (+10 kg)..." -ForegroundColor Cyan
    $purchaseBody = @{ transaction_type = "PURCHASE"; quantity = 10; notes = "Weekly delivery" } | ConvertTo-Json
    $txn = Invoke-RestMethod -Uri "$base/inventory/items/$($item.id)/transactions" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $purchaseBody
    Write-Host "   OK - before: $($txn.quantity_before), after: $($txn.quantity_after)" -ForegroundColor Green
    if ([decimal]$txn.quantity_after -ne 30) { Fail "Math check" "Expected 30, got $($txn.quantity_after)" }
} catch { Fail "Record purchase" $_.Exception.Message }

try {
    Write-Host "6. Record a WASTE transaction (-5 kg)..." -ForegroundColor Cyan
    $wasteBody = @{ transaction_type = "WASTE"; quantity = 5; notes = "Spoiled" } | ConvertTo-Json
    $txn2 = Invoke-RestMethod -Uri "$base/inventory/items/$($item.id)/transactions" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $wasteBody
    Write-Host "   OK - after: $($txn2.quantity_after)" -ForegroundColor Green
    if ([decimal]$txn2.quantity_after -ne 25) { Fail "Math check" "Expected 25, got $($txn2.quantity_after)" }
} catch { Fail "Record waste" $_.Exception.Message }

Write-Host "7. Negative test: WASTE more than available (should fail with 409)..." -ForegroundColor Cyan
try {
    $tooMuchBody = @{ transaction_type = "WASTE"; quantity = 999; notes = "Too much" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/inventory/items/$($item.id)/transactions" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $tooMuchBody
    Write-Host "   UNEXPECTED - should have failed!" -ForegroundColor Red
    exit 1
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 409) { Write-Host "   OK - correctly blocked with 409" -ForegroundColor Green }
    else { Fail "Negative test" "Expected 409, got $sc" }
}

try {
    Write-Host "8. Fetch transaction history for this item..." -ForegroundColor Cyan
    $history = Invoke-RestMethod -Uri "$base/inventory/items/$($item.id)/transactions" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    Write-Host "   OK - transaction count: $($history.Count)" -ForegroundColor Green
    if ($history.Count -ne 2) { Fail "History check" "Expected 2 transactions, got $($history.Count)" }
} catch { Fail "Fetch history" $_.Exception.Message }

try {
    Write-Host "9. Link this ingredient to a menu item (recipe)..." -ForegroundColor Cyan
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$restaurantId/menu" -Method Get
    $menuItemId = $menu[0].items[0].id
    $recipeBody = @{ menu_item_id = $menuItemId; inventory_item_id = $item.id; quantity_required = 0.2 } | ConvertTo-Json
    $recipe = Invoke-RestMethod -Uri "$base/inventory/recipes" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $recipeBody
    Write-Host "   OK - recipe_id: $($recipe.id), requires: $($recipe.quantity_required) $($recipe.inventory_item_unit)" -ForegroundColor Green
} catch { Fail "Create recipe" $_.Exception.Message }

try {
    Write-Host "10. Fetch the recipe for this menu item..." -ForegroundColor Cyan
    $fetchedRecipe = Invoke-RestMethod -Uri "$base/inventory/recipes/menu-item/$menuItemId" -Method Get
    Write-Host "   OK - ingredients linked: $($fetchedRecipe.Count)" -ForegroundColor Green
} catch { Fail "Fetch recipe" $_.Exception.Message }

Write-Host ""
Write-Host "ALL INVENTORY SETUP TESTS PASSED" -ForegroundColor Green