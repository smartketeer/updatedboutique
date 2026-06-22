<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;



// Fallback for missing storage symlinks on shared hosting
Route::get('storage/{path}', function ($path) {
    $filePath = storage_path('app/public/' . $path);
    if (!file_exists($filePath)) {
        abort(404);
    }
    
    $mimeType = \Illuminate\Support\Facades\File::mimeType($filePath);
    return response()->file($filePath, [
        'Content-Type' => $mimeType,
        'Cache-Control' => 'public, max-age=31536000'
    ]);
})->where('path', '.*');



Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
