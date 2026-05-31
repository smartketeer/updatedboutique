<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (app()->environment('local') && ! app()->runningInConsole()) {
            static $checkedHot = false;
            if ($checkedHot) {
                return;
            }
            $checkedHot = true;

            $hotPath = public_path('hot');
            $manifestPath = public_path('build/manifest.json');

            if (is_file($hotPath) && is_file($manifestPath)) {
                $url = trim((string) @file_get_contents($hotPath));
                $parts = $url ? parse_url($url) : null;
                $host = is_array($parts) ? ($parts['host'] ?? null) : null;
                $port = is_array($parts) ? ($parts['port'] ?? null) : null;

                if ($host) {
                    $scheme = is_array($parts) ? ($parts['scheme'] ?? 'http') : 'http';
                    $port = $port ?: ($scheme === 'https' ? 443 : 80);

                    $fp = @fsockopen($host, (int) $port, $errno, $errstr, 0.15);
                    if (is_resource($fp)) {
                        fclose($fp);
                    } else {
                        @unlink($hotPath);
                    }
                }
            }
        }
    }
}
