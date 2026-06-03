<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);

use Illuminate\Support\Facades\DB;

$counts = DB::table('sales')
    ->select('status', DB::raw('count(*) as count'))
    ->groupBy('status')
    ->get();

echo json_encode($counts);
