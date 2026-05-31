import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    snapshotDir: './e2e/__screenshots__',
    use: {
        baseURL: 'http://127.0.0.1:8000',
        trace: 'retain-on-failure',
    },
    webServer: {
        command:
            'npx concurrently -k -s first -n php,vite "php artisan migrate:fresh --seed --force && php artisan serve --host 127.0.0.1 --port 8000" "npm run dev"',
        url: 'http://127.0.0.1:8000',
        reuseExistingServer: true,
        timeout: 120000,
    },
    projects: [
        {
            name: 'desktop-chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chromium',
            use: { ...devices['Pixel 5'] },
        },
    ],
});
