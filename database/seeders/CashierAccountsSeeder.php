<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CashierAccountsSeeder extends Seeder
{
    /**
     * Cashier definitions.
     */
    private array $cashiers = [
        [
            'name'     => 'Merlina',
            'email'    => 'merlina@boutique.com',
            'password' => env('CASHIER_MERLINA_PASSWORD', 'password'),
            'pin'      => env('CASHIER_MERLINA_PIN', '0000'),
        ],
        [
            'name'     => 'Marites',
            'email'    => 'marites@boutique.com',
            'password' => env('CASHIER_MARITES_PASSWORD', 'password'),
            'pin'      => env('CASHIER_MARITES_PIN', '0000'),
        ],
        [
            'name'     => 'Faith',
            'email'    => 'faith@boutique.com',
            'password' => env('CASHIER_FAITH_PASSWORD', 'password'),
            'pin'      => env('CASHIER_FAITH_PIN', '0000'),
        ],
        [
            'name'     => 'Airen',
            'email'    => 'airen@boutique.com',
            'password' => env('CASHIER_AIREN_PASSWORD', 'password'),
            'pin'      => env('CASHIER_AIREN_PIN', '0000'),
        ],
        [
            'name'     => 'Yssa',
            'email'    => 'yssa@boutique.com',
            'password' => env('CASHIER_YSSA_PASSWORD', 'password'),
            'pin'      => env('CASHIER_YSSA_PIN', '0000'),
        ],
    ];

    public function run(): void
    {
        // Grab both branches so each cashier is assigned to both by default.
        // Adjust the sync() call below if you want branch-specific assignments.
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id')
            ->toArray();

        foreach ($this->cashiers as $data) {
            $user = User::query()->updateOrCreate(
                ['email' => $data['email']],
                [
                    'name'         => $data['name'],
                    'password'     => Hash::make($data['password']),
                    'pin_hash'     => Hash::make($data['pin']),
                    'pin_updated_at' => now(),
                    'role'         => 'staff',
                    // branch_id is left null intentionally; the pivot is the source of truth
                    // for multi-branch staff. Set it to the first branch as a fallback.
                    'branch_id'    => $branches[0] ?? null,
                ]
            );

            // Sync the cashier to all active branches via the pivot table.
            // Change this to ->sync([specificBranchId]) if you want finer control.
            if ($branches) {
                $user->branches()->sync($branches);
            }

            $this->command->info("Cashier seeded: {$user->name} <{$user->email}>");
        }
    }
}
