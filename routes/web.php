<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;

Route::get('/setup-storage', function () {
    $target = storage_path('app/public');
    $link = public_path('storage');

    if (file_exists($link)) {
        return 'Storage link already exists at ' . $link;
    }

    try {
        if (symlink($target, $link)) {
            return 'Storage link created successfully using native symlink()!';
        }
        return 'Failed to create symlink (function returned false).';
    } catch (\Exception $e) {
        return 'Error creating symlink: ' . $e->getMessage();
    }
});

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
