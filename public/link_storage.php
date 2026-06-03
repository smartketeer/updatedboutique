<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

try {
    $publicStoragePath = public_path('storage');

    // If it exists and is a directory (but NOT a symlink), we need to remove it
    if (file_exists($publicStoragePath) && !is_link($publicStoragePath)) {
        // Since it might contain .gitignore, we delete its contents first
        File::deleteDirectory($publicStoragePath);
        echo "<p>Removed old non-symlink storage directory.</p>";
    }

    // Now run the artisan command
    Artisan::call('storage:link');
    
    echo "<h3>Success!</h3>";
    echo "<p>Storage link has been successfully created.</p>";
    echo "<p>Artisan output: " . nl2br(Artisan::output()) . "</p>";

} catch (\Exception $e) {
    echo "<h3>Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
}
