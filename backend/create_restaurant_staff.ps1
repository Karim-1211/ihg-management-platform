$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

Write-Host "Logging in as SUPER_ADMIN..." -ForegroundColor Cyan
$admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
$adminToken = $admin.access_token

Write-Host "Finding your restaurant..." -ForegroundColor Cyan
$restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
$restaurantId = $restaurants[0].id
Write-Host "Using restaurant: $($restaurants[0].name) ($restaurantId)" -ForegroundColor Green

Write-Host "Creating waiter@ihg.com..." -ForegroundColor Cyan
try {
    $waiterBody = @{ first_name="Wendy"; last_name="Waiter"; email="waiter@ihg.com"; password="WaiterPass123"; role="WAITER"; restaurant_id=$restaurantId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/auth/staff" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $waiterBody
    Write-Host "  Created." -ForegroundColor Green
} catch {
    Write-Host "  Already exists or failed (this is OK if you've run this before)." -ForegroundColor Yellow
}

Write-Host "Creating kitchen@ihg.com..." -ForegroundColor Cyan
try {
    $kitchenBody = @{ first_name="Kai"; last_name="Kitchen"; email="kitchen@ihg.com"; password="KitchenPass123"; role="KITCHEN"; restaurant_id=$restaurantId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/auth/staff" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $kitchenBody
    Write-Host "  Created." -ForegroundColor Green
} catch {
    Write-Host "  Already exists or failed (this is OK if you've run this before)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Login credentials:" -ForegroundColor Green
Write-Host "  Waiter:  waiter@ihg.com / WaiterPass123"
Write-Host "  Kitchen: kitchen@ihg.com / KitchenPass123"