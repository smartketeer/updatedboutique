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

Route::get('/run-import', function (\Illuminate\Http\Request $request) {
    $branch = $request->query('branch');
    $file = $request->query('file');
    
    if (!$branch || !$file) {
        return "Missing 'branch' or 'file' query parameters.";
    }

    $filePath = base_path($file);

    try {
        Artisan::call('import:inventory', [
            'branch_name' => $branch,
            'file_path' => $filePath
        ]);
        return '<pre>' . Artisan::output() . '</pre>';
    } catch (\Exception $e) {
        return 'Error: ' . $e->getMessage();
    }
});

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

Route::get('/debug-pos', function () {
    return response()->json([
        'expected_cookie_name' => config('session.cookie'),
        'received_cookie' => request()->cookie(config('session.cookie')) ? 'YES' : 'NO',
        'auth_check' => auth()->check() ? 'YES' : 'NO',
        'auth_id' => auth()->id(),
        'session_id' => session()->getId(),
        'session_driver' => config('session.driver'),
        'app_key_match' => config('app.key') === 'base64:T3xyyd+wBc0cVlb7WA+yp57wAethBCvAZ5XcnAI1aeo=' ? 'YES' : 'NO'
    ]);
});

Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*');
