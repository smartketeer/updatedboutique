<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    DB::statement('SET FOREIGN_KEY_CHECKS=0;');
    
    // Clear sales data
    DB::table('sale_modifications')->truncate();
    DB::table('sale_custom_items')->truncate();
    DB::table('sale_items')->truncate();
    DB::table('sales')->truncate();

    // Clear activity logs that were generated during testing (like "New sale completed")
    DB::table('activity_logs')->where('description', 'like', '%sale%')->delete();

    DB::statement('SET FOREIGN_KEY_CHECKS=1;');

    echo "<h3>Success!</h3>";
    echo "<p>All test sales, sale items, custom items, modifications, and related activity logs have been permanently deleted.</p>";
    echo "<p>Your auto-increment IDs for sales have also been reset to 1.</p>";
    echo "<p>You are ready for production!</p>";
} catch (\Exception $e) {
    echo "<h3>Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
}
