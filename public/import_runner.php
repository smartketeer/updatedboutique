<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$branch = $_GET['branch'] ?? null;
$file = $_GET['file'] ?? null;

if (!$branch || !$file) {
    echo "Missing 'branch' or 'file' query parameters.";
    exit;
}

$filePath = base_path($file);

if (!file_exists($filePath)) {
    echo "File not found: " . $filePath;
    exit;
}

try {
    Artisan::call('import:inventory', [
        'branch_name' => $branch,
        'file_path' => $filePath
    ]);
    echo '<pre>' . Artisan::output() . '</pre>';
} catch (\Exception $e) {
    echo 'Error: ' . $e->getMessage();
}
