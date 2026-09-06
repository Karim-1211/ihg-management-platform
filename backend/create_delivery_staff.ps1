$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

$admin = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"karim@test.com","password":"TestPass123"}'
$adminToken = $admin.access_token
$restaurants = Invoke-RestMethod -Uri "$base/restaurants" -Method Get -Headers @{Authorization="Bearer $adminToken"}
$restaurantId = $restaurants[0].id

try {
    $driverBody = @{ first_name="Dan"; last_name="Driver"; email="driver@ihg.com"; password="DriverPass123"; role="DELIVERY"; restaurant_id=$restaurantId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/auth/staff" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $adminToken"} -Body $driverBody
    Write-Host "Created driver@ihg.com / DriverPass123" -ForegroundColor Green
} catch {
    Write-Host "Already exists (OK if run before)." -ForegroundColor Yellow
}