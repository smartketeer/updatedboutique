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
                'name'     => $this->requireEnv('CASHIER_MERLINA_NAME'),
                'email'    => $this->requireEnv('CASHIER_MERLINA_EMAIL'),
                'password' => $this->requireEnv('CASHIER_MERLINA_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_MERLINA_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_MARITES_NAME'),
                'email'    => $this->requireEnv('CASHIER_MARITES_EMAIL'),
                'password' => $this->requireEnv('CASHIER_MARITES_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_MARITES_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_FAITH_NAME'),
                'email'    => $this->requireEnv('CASHIER_FAITH_EMAIL'),
                'password' => $this->requireEnv('CASHIER_FAITH_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_FAITH_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_AIREN_NAME'),
                'email'    => $this->requireEnv('CASHIER_AIREN_EMAIL'),
                'password' => $this->requireEnv('CASHIER_AIREN_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_AIREN_PIN'),
            ],
            [
                'name'     => $this->requireEnv('CASHIER_YSSA_NAME'),
                'email'    => $this->requireEnv('CASHIER_YSSA_EMAIL'),
                'password' => $this->requireEnv('CASHIER_YSSA_PASSWORD'),
                'pin'      => $this->requireEnv('CASHIER_YSSA_PIN'),
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
