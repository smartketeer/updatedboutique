<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Client;
use App\Models\Item;
use App\Models\Setting;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * All account credentials (emails, passwords, PINs) are sourced
     * from environment variables to keep them out of version control.
     */
    public function run(): void
    {
        $this->migrateLegacyAccounts();

        Branch::query()->firstOrCreate(
            ['name' => 'Luna Branch'],
            ['address' => null, 'phone' => null, 'is_active' => true],
        );
        Branch::query()->firstOrCreate(
            ['name' => 'Roxas Branch'],
            ['address' => null, 'phone' => null, 'is_active' => true],
        );

        Setting::setValue('daily_sales_enabled', true);

        // Admin Account
        User::query()->updateOrCreate([
            'email' => $this->requireEnv('ADMIN_EMAIL'),
        ], [
            'name'         => $this->requireEnv('ADMIN_NAME'),
            'password'     => Hash::make($this->requireEnv('ADMIN_PASSWORD')),
            'pin_hash'     => Hash::make($this->requireEnv('ADMIN_PIN')),
            'pin_updated_at' => now(),
            'role'         => 'admin',
        ]);

        // Luna Branch Cashier
        User::query()->updateOrCreate([
            'email' => $this->requireEnv('LUNA_EMAIL'),
        ], [
            'name'         => $this->requireEnv('LUNA_NAME'),
            'password'     => Hash::make($this->requireEnv('LUNA_PASSWORD')),
            'pin_hash'     => Hash::make($this->requireEnv('LUNA_PIN')),
            'pin_updated_at' => now(),
            'role'         => 'staff',
        ]);

        // Roxas Branch Cashier
        User::query()->updateOrCreate([
            'email' => $this->requireEnv('ROXAS_EMAIL'),
        ], [
            'name'         => $this->requireEnv('ROXAS_NAME'),
            'password'     => Hash::make($this->requireEnv('ROXAS_PASSWORD')),
            'pin_hash'     => Hash::make($this->requireEnv('ROXAS_PIN')),
            'pin_updated_at' => now(),
            'role'         => 'staff',
        ]);

        // Categories
        $catProduct = Category::query()->firstOrCreate(['name' => 'Beauty Products'], ['type' => 'product']);
        $catService = Category::query()->firstOrCreate(['name' => 'Store Services'], ['type' => 'service']);

        // Items
        Item::query()->updateOrCreate(
            ['sku' => 'LIP001'],
            [
                'category_id' => $catProduct->id,
                'name' => 'Lipstick - Rose Red',
                'price' => 250,
                'cost' => 150,
                'stock_qty' => 50,
                'is_service' => false,
            ]
        );

        Item::query()->updateOrCreate(
            ['sku' => 'CRM001'],
            [
                'category_id' => $catProduct->id,
                'name' => 'Face Cream - Hydrating',
                'price' => 450,
                'cost' => 300,
                'stock_qty' => 5,
                'is_service' => false,
            ]
        );

        Item::query()->updateOrCreate(
            ['name' => 'Gift Wrapping', 'category_id' => $catService->id],
            [
                'sku' => null,
                'price' => 500,
                'cost' => 0,
                'stock_qty' => 0,
                'is_service' => true,
            ]
        );

        Item::query()->updateOrCreate(
            ['name' => 'Alteration Service', 'category_id' => $catService->id],
            [
                'sku' => null,
                'price' => 300,
                'cost' => 0,
                'stock_qty' => 0,
                'is_service' => true,
            ]
        );

        // Named cashier accounts
        $this->call(CashierAccountsSeeder::class);

        // Sample Client
        Client::query()->updateOrCreate(
            ['email' => env('SAMPLE_CLIENT_EMAIL', 'client@example.com')],
            [
                'name' => env('SAMPLE_CLIENT_NAME', 'Sample Client'),
                'phone' => env('SAMPLE_CLIENT_PHONE', '0000000000'),
            ]
        );
    }

    /**
     * Migrate accounts from old email addresses to current ones.
     * Skipped automatically if legacy env vars are not configured.
     */
    private function migrateLegacyAccounts(): void
    {
        // Legacy migration only runs if LEGACY_* env vars are configured.
        // Once all old accounts have been migrated, these vars can be removed.
        $legacyAdminTo = env('LEGACY_ADMIN_TO_EMAIL');
        if (! $legacyAdminTo) {
            return; // Legacy migration not configured — skip.
        }

        $legacyLunaTo = env('LEGACY_LUNA_TO_EMAIL');

        $migrations = [
            [
                'from' => $this->requireEnv('ADMIN_EMAIL'),
                'to' => $legacyAdminTo,
                'name' => $this->requireEnv('ADMIN_NAME'),
                'role' => 'admin',
                'password_env' => 'ADMIN_PASSWORD',
            ],
            [
                'from' => env('LEGACY_CASHIER1_FROM_EMAIL', ''),
                'to' => $legacyLunaTo,
                'name' => $this->requireEnv('LUNA_NAME'),
                'role' => 'staff',
                'password_env' => 'LUNA_PASSWORD',
            ],
            [
                'from' => env('LEGACY_CASHIER_FROM_EMAIL', ''),
                'to' => $legacyLunaTo,
                'name' => $this->requireEnv('LUNA_NAME'),
                'role' => 'staff',
                'password_env' => 'LUNA_PASSWORD',
            ],
        ];

        foreach ($migrations as $m) {
            if (empty($m['from']) || empty($m['to'])) {
                continue;
            }

            $from = User::query()->where('email', $m['from'])->first();
            if (! $from) {
                continue;
            }

            $to = User::query()->where('email', $m['to'])->first();
            if ($to) {
                $from->delete();

                continue;
            }

            $from->forceFill([
                'email' => $m['to'],
                'name' => $m['name'],
                'role' => $m['role'],
                'password' => Hash::make($this->requireEnv($m['password_env'])),
            ])->save();
        }
    }

    /**
     * Get a required environment variable or abort with a clear message.
     */
    private function requireEnv(string $key): string
    {
        $value = env($key);

        if ($value === null || $value === '') {
            throw new \RuntimeException(
                "Seeder requires the [{$key}] environment variable to be set in your .env file."
            );
        }

        return $value;
    }
}
