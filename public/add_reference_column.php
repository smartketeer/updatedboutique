<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    if (!Schema::hasColumn('sales', 'reference_number')) {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('reference_number')->nullable()->after('payment_method');
        });
        echo "<h3>Success!</h3>";
        echo "<p>The 'reference_number' column was successfully added to the 'sales' table.</p>";
    } else {
        echo "<h3>Already Exists</h3>";
        echo "<p>The 'reference_number' column already exists in the 'sales' table.</p>";
    }
} catch (\Exception $e) {
    echo "<h3>Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
}
