<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CashierAccountController;
use App\Http\Controllers\CashierInventoryController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\InventoryAccessController;
use App\Http\Controllers\OverrideApprovalController;
use App\Http\Controllers\ProductImageController;
use App\Http\Controllers\ReportingController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StockCatalogController;
use App\Http\Controllers\StockImportController;
use App\Http\Controllers\StockManagementController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

// Auth Routes
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/settings', [SettingsController::class, 'index']);

    // Inventory (read for all authenticated users)
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
    Route::get('/inventory/lookup', [InventoryController::class, 'lookup']);
    Route::get('/inventory/by-ids', [InventoryController::class, 'byIds']);
    Route::get('/inventory/{item}', [InventoryController::class, 'show']);
    Route::get('/categories', [InventoryController::class, 'categories']);

    // Branch selection (staff with multiple branches must call this before using POS)
    Route::middleware('role:staff')->post('/select-branch', [AuthController::class, 'selectBranch']);

    // Sales Routes
    Route::get('/sales', [SalesController::class, 'index']);
    Route::middleware('role:staff')->group(function () {
        Route::post('/sales', [SalesController::class, 'store']);
        Route::post('/sales/{sale}/void', [SalesController::class, 'voidSale']);
        Route::post('/stock-warnings', [SalesController::class, 'stockWarning']);
        Route::post('/override-approvals', [OverrideApprovalController::class, 'store']);
        Route::post('/inventory-access/request', [InventoryAccessController::class, 'requestAccess']);
        Route::post('/inventory-access/verify', [InventoryAccessController::class, 'verify']);
        Route::post('/inventory-access/revoke', [InventoryAccessController::class, 'revoke']);

        Route::middleware('inventory_access')->group(function () {
            Route::post('/cashier/inventory', [CashierInventoryController::class, 'store']);
            Route::put('/cashier/inventory/{item}', [CashierInventoryController::class, 'update']);
            Route::delete('/cashier/inventory/{item}', [CashierInventoryController::class, 'destroy']);
        });
    });

    // Product images — accessible by admins directly, or by staff with a valid inventory access token
    Route::middleware('admin_or_inventory_access')->group(function () {
        Route::get('/items/{item}/images', [ProductImageController::class, 'index']);
        Route::post('/items/{item}/images', [ProductImageController::class, 'store']);
        Route::patch('/items/{item}/images/{image}/primary', [ProductImageController::class, 'setPrimary']);
        Route::delete('/items/{item}/images/{image}', [ProductImageController::class, 'destroy']);
    });

    Route::get('/staff', function () {
        return User::query()->where('role', 'staff')->orderBy('name')->get();
    });

    // Clients
    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::put('/clients/{client}', [ClientController::class, 'update']);
    Route::delete('/clients/{client}', [ClientController::class, 'destroy']);

    Route::middleware('role:admin')->group(function () {
        // Stock Management
        Route::get('/stock-management/movements', [StockManagementController::class, 'index']);
        Route::post('/stock-management/movements', [StockManagementController::class, 'store']);

        // Catalog management (admin only)
        Route::post('/stock-management/items', [StockCatalogController::class, 'storeItem']);
        Route::put('/stock-management/items/{item}', [StockCatalogController::class, 'updateItem']);
        Route::delete('/stock-management/items/{item}', [StockCatalogController::class, 'destroyItem']);
        Route::post('/stock-management/categories', [StockCatalogController::class, 'storeCategory']);

        // Stock Import (moved from Inventory module)
        Route::post('/stock-management/import/upload', [StockImportController::class, 'upload']);
        Route::post('/stock-management/import/{import}/start', [StockImportController::class, 'start']);
        Route::get('/stock-management/import/{import}', [StockImportController::class, 'show']);

        // Cashier Accounts
        Route::get('/cashiers', [CashierAccountController::class, 'index']);
        Route::post('/cashiers', [CashierAccountController::class, 'store']);
        Route::put('/cashiers/{user}', [CashierAccountController::class, 'update']);
        Route::delete('/cashiers/{user}', [CashierAccountController::class, 'destroy']);

        Route::get('/activity-logs', [ActivityLogController::class, 'index']);
        Route::get('/inventory-access/requests', [InventoryAccessController::class, 'listRequests']);
        Route::post('/inventory-access/requests/{id}/approve', [InventoryAccessController::class, 'approve']);

        // Branches
        Route::get('/branches', [BranchController::class, 'index']);
        Route::post('/branches', [BranchController::class, 'store']);
        Route::put('/branches/{branch}', [BranchController::class, 'update']);
        Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);

        // Settings
        Route::patch('/settings', [SettingsController::class, 'update']);

        // Reporting Routes
        Route::get('/reports/daily-summary', [ReportingController::class, 'dailySummary']);
        Route::get('/reports/weekly-revenue', [ReportingController::class, 'weeklyRevenue']);
        Route::get('/reports/monthly-revenue', [ReportingController::class, 'monthlyRevenue']);
        Route::get('/reports/yearly-revenue', [ReportingController::class, 'yearlyRevenue']);
        Route::get('/reports/staff-performance', [ReportingController::class, 'staffPerformance']);
        Route::get('/reports/inventory-valuation', [ReportingController::class, 'inventoryValuation']);
    });
});
