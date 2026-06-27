<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CashierAccountsSeeder extends Seeder
{
    /**
     * Cashier definitions — all credentials sourced from environment variables.
     * Nothing identifying is stored in source code.
     */
    private function getCashiers(): array
    {
        return [
            [
                'name'     => $this->requireEnv('CASHIER_1_NAME'),
                'email'    => $this->requireEnv('CASHIER_1_EMAIL'),
                'password' => $this->requireEnv('CASHIER_1_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_1_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_2_NAME'),
                'email'    => $this->requireEnv('CASHIER_2_EMAIL'),
                'password' => $this->requireEnv('CASHIER_2_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_2_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_3_NAME'),
                'email'    => $this->requireEnv('CASHIER_3_EMAIL'),
                'password' => $this->requireEnv('CASHIER_3_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_3_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_4_NAME'),
                'email'    => $this->requireEnv('CASHIER_4_EMAIL'),
                'password' => $this->requireEnv('CASHIER_4_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_4_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_5_NAME'),
                'email'    => $this->requireEnv('CASHIER_5_EMAIL'),
                'password' => $this->requireEnv('CASHIER_5_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_5_PIN'),
            ],
        ];
    }

    public function run(): void
    {
        // Grab both branches so each cashier is assigned to both by default.
        // Adjust the sync() call below if you want branch-specific assignments.
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->pluck('id')
            ->toArray();

        foreach ($this->getCashiers() as $data) {
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
