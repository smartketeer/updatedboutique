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
            'email' => 'admin@boutique.com',
        ], [
            'name'         => 'Admin User',
            'password'     => Hash::make(env('ADMIN_PASSWORD', 'password')),
            'pin_hash'     => Hash::make(env('ADMIN_PIN', '0000')),
            'pin_updated_at' => now(),
            'role'         => 'admin',
        ]);

        // Luna Branch Cashier
        User::query()->updateOrCreate([
            'email' => 'luna@boutique.com',
        ], [
            'name'         => 'Luna Cashier',
            'password'     => Hash::make(env('LUNA_PASSWORD', 'password')),
            'pin_hash'     => Hash::make(env('LUNA_PIN', '0000')),
            'pin_updated_at' => now(),
            'role'         => 'staff',
        ]);

        // Roxas Branch Cashier
        User::query()->updateOrCreate([
            'email' => 'roxas@boutique.com',
        ], [
            'name'         => 'Roxas Cashier',
            'password'     => Hash::make(env('ROXAS_PASSWORD', 'password')),
            'pin_hash'     => Hash::make(env('ROXAS_PIN', '0000')),
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

        // Named cashier accounts (Merlina, Marites, Faith, Airen, Yssa)
        $this->call(CashierAccountsSeeder::class);

        // Sample Client
        Client::query()->updateOrCreate(
            ['email' => 'jane@example.com'],
            [
                'name' => 'Jane Doe',
                'phone' => '09123456789',
            ]
        );
    }

    private function migrateLegacyAccounts(): void
    {
        $migrations = [
            [
                'from' => 'admin@boutique.com',
                'to' => 'admin@botique.com',
                'name' => 'Admin User',
                'role' => 'admin',
                'password' => env('ADMIN_PASSWORD', 'password'),
            ],
            [
                'from' => 'cashier1@boutique.com',
                'to' => 'luna@botique.com',
                'name' => 'Luna Cashier',
                'role' => 'staff',
                'password' => env('LUNA_PASSWORD', 'password'),
            ],
            [
                'from' => 'cashier@boutique.com',
                'to' => 'luna@botique.com',
                'name' => 'Luna Cashier',
                'role' => 'staff',
                'password' => env('LUNA_PASSWORD', 'password'),
            ],
        ];

        foreach ($migrations as $m) {
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
                'password' => Hash::make($m['password']),
            ])->save();
        }
    }
}
