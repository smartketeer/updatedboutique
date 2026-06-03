<?php

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';

try {
    $targetFolder = storage_path('app/public');
    $linkFolder = public_path('storage');

    if (file_exists($linkFolder) && !is_link($linkFolder)) {
        // Since it might contain .gitignore, we delete its contents first
        // Simple recursive delete
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($linkFolder, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $fileinfo) {
            $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
            $todo($fileinfo->getRealPath());
        }
        rmdir($linkFolder);
        echo "<p>Removed old non-symlink storage directory.</p>";
    }

    if (file_exists($linkFolder) && is_link($linkFolder)) {
        unlink($linkFolder);
        echo "<p>Removed existing symlink.</p>";
    }

    // Try native symlink
    if (@symlink($targetFolder, $linkFolder)) {
        echo "<h3>Success!</h3>";
        echo "<p>Storage link has been successfully created using native PHP symlink.</p>";
    } else {
        echo "<h3>Warning</h3>";
        echo "<p>Native symlink failed. Your hosting provider might have disabled symlink creation via PHP.</p>";
        echo "<p>As an alternative, you can create a route to serve the files directly.</p>";
    }

} catch (\Exception $e) {
    echo "<h3>Error:</h3>";
    echo "<p>" . $e->getMessage() . "</p>";
}
