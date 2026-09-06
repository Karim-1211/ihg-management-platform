$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8000/api/v1"

function TryLogin($label, $email, $password) {
    try {
        $result = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$password} | ConvertTo-Json)
        Write-Host "$label -> LOGIN OK" -ForegroundColor Green
        Write-Host "  role: $($result.user.role)" -ForegroundColor DarkGray
        Write-Host "  restaurant_id: $($result.user.restaurant_id)" -ForegroundColor DarkGray
    } catch {
        Write-Host "$label -> LOGIN FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

TryLogin "Waiter (WaiterPass123)" "waiter@ihg.com" "WaiterPass123"
TryLogin "Kitchen (KitchenPass123)" "kitchen@ihg.com" "KitchenPass123"