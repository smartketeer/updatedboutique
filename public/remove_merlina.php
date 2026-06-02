<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Sale;
use App\Models\ActivityLog;
use App\Models\StockLog;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    $merlina = User::where('email', 'merlina@boutique.com')->first();
    if (!$merlina) {
        die("Merlina not found in the database.");
    }

    $merlinaId = $merlina->id;

    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    
    // 1. Get all her sales
    $saleIds = Sale::where('staff_id', $merlinaId)->pluck('id');

    if ($saleIds->isEmpty()) {
        echo "<p>No sales found for Merlina.</p>";
    } else {
        // Delete related modifications
        DB::table('sale_modifications')->whereIn('sale_id', $saleIds)->delete();
        // Delete related custom items
        DB::table('sale_custom_items')->whereIn('sale_id', $saleIds)->delete();
        // Delete related sale items
        DB::table('sale_items')->whereIn('sale_id', $saleIds)->delete();
        
        // Delete the sales themselves
        Sale::whereIn('id', $saleIds)->delete();
        
        echo "<p>Deleted " . count($saleIds) . " sales belonging to Merlina (and all associated items/modifications).</p>";
    }

    // 2. Delete her Activity Logs
    $logsDeleted = ActivityLog::where('actor_user_id', $merlinaId)->delete();
    echo "<p>Deleted {$logsDeleted} Activity Logs belonging to Merlina.</p>";

    // 3. Delete her Stock Logs
    $stockLogsDeleted = StockLog::where('actor_user_id', $merlinaId)->delete();
    echo "<p>Deleted {$stockLogsDeleted} Stock Logs belonging to Merlina.</p>";

    // We do not delete the user account based on the request ("transactions of Merlina").
    // If we wanted to, we could: $merlina->delete();

    DB::statement('SET FOREIGN_KEY_CHECKS=1;');

    echo "<h3>Success!</h3>";
    echo "<p>All of Merlina's transactions, history, and activity logs have been removed.</p>";
    
    // Optional: Delete this file itself for security
    @unlink(__FILE__);
} catch (\Exception $e) {
    echo "<h3>Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
}
