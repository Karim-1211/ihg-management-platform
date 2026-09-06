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
} catch { Fail "Login as Admin" $_.Exception.Message }

try {
    Write-Host "2. Get the seeded hotel id..." -ForegroundColor Cyan
    $hotels = Invoke-RestMethod -Uri "$base/hotels" -Method Get -Headers @{Authorization="Bearer $adminToken"}
    $hotelId = $hotels[0].id
    Write-Host "   OK - hotel_id: $hotelId" -ForegroundColor Green
} catch { Fail "Get hotels" $_.Exception.Message }

try {
    Write-Host "3. Create a restaurant tied to the hotel..." -ForegroundColor Cyan
    $restBody = @{ hotel_id = $hotelId; name = "IHG Grand Dhaka Restaurant"; description = "In-house fine dining" } | ConvertTo-Json
    $restaurant = Invoke-RestMethod -Uri "$base/restaurants" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $restBody
    Write-Host "   OK - restaurant_id: $($restaurant.id)" -ForegroundColor Green
} catch { Fail "Create restaurant" $_.Exception.Message }

try {
    Write-Host "4. Create a table..." -ForegroundColor Cyan
    $tableBody = @{ restaurant_id = $restaurant.id; table_number = "T1"; capacity = 4 } | ConvertTo-Json
    $table = Invoke-RestMethod -Uri "$base/restaurant-tables" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $tableBody
    Write-Host "   OK - table_id: $($table.id), status: $($table.status)" -ForegroundColor Green
} catch { Fail "Create table" $_.Exception.Message }

try {
    Write-Host "5. Create a menu category..." -ForegroundColor Cyan
    $catBody = @{ restaurant_id = $restaurant.id; name = "Main Course"; display_order = 1 } | ConvertTo-Json
    $category = Invoke-RestMethod -Uri "$base/menu-categories" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $catBody
    Write-Host "   OK - category_id: $($category.id)" -ForegroundColor Green
} catch { Fail "Create menu category" $_.Exception.Message }

try {
    Write-Host "6. Create a menu item..." -ForegroundColor Cyan
    $itemBody = @{ category_id = $category.id; name = "Grilled Chicken"; description = "Served with rice and salad"; price = 18.50 } | ConvertTo-Json
    $item = Invoke-RestMethod -Uri "$base/menu-items" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $itemBody
    Write-Host "   OK - item_id: $($item.id), price: $($item.price)" -ForegroundColor Green
} catch { Fail "Create menu item" $_.Exception.Message }

try {
    Write-Host "7. Fetch full menu (public, no auth needed)..." -ForegroundColor Cyan
    $menu = Invoke-RestMethod -Uri "$base/restaurants/$($restaurant.id)/menu" -Method Get
    Write-Host "   OK - categories: $($menu.Count), first category items: $($menu[0].items.Count)" -ForegroundColor Green
} catch { Fail "Fetch menu" $_.Exception.Message }

Write-Host "8. Negative test: Manager tries to manage a DIFFERENT hotel's restaurant (should fail with 403)..." -ForegroundColor Cyan
try {
    $manager = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"manager@ihg.com","password":"ManagerPass123"}'
    $managerToken = $manager.access_token

    $fakeHotelBody = @{ name = "Some Other Hotel"; city = "Elsewhere" } | ConvertTo-Json
    $otherHotel = Invoke-RestMethod -Uri "$base/hotels" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $fakeHotelBody
    $otherRestBody = @{ hotel_id = $otherHotel.id; name = "Other Hotel Restaurant" } | ConvertTo-Json
    $otherRestaurant = Invoke-RestMethod -Uri "$base/restaurants" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $otherRestBody

    $unauthorizedTableBody = @{ restaurant_id = $otherRestaurant.id; table_number = "X1"; capacity = 2 } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/restaurant-tables" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $managerToken"} -Body $unauthorizedTableBody
    Write-Host "   UNEXPECTED - manager should not access another hotel's restaurant!" -ForegroundColor Red
    exit 1
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 403) {
        Write-Host "   OK - correctly blocked with 403 (tenant boundary enforced)" -ForegroundColor Green
    } else {
        Fail "Negative test (wrong status code)" "Expected 403, got $statusCode"
    }
}

Write-Host ""
Write-Host "ALL RESTAURANT SETUP TESTS PASSED" -ForegroundColor Green