<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $luna = DB::table('branches')
                ->select(['id', 'name'])
                ->whereRaw('LOWER(name) LIKE ?', ['%luna%'])
                ->orderBy('id')
                ->first();

            $roxas = DB::table('branches')
                ->select(['id', 'name'])
                ->whereRaw('LOWER(name) LIKE ?', ['%roxas%'])
                ->orderBy('id')
                ->first();

            $lunaId = $luna?->id
                ? (int) $luna->id
                : (int) DB::table('branches')->insertGetId([
                    'name' => 'Luna Branch',
                    'address' => null,
                    'phone' => null,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            $roxasId = $roxas?->id
                ? (int) $roxas->id
                : (int) DB::table('branches')->insertGetId([
                    'name' => 'Roxas Branch',
                    'address' => null,
                    'phone' => null,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            DB::table('branches')
                ->where('id', $lunaId)
                ->update(['name' => 'Luna Branch', 'is_active' => true, 'updated_at' => now()]);

            DB::table('branches')
                ->where('id', $roxasId)
                ->update(['name' => 'Roxas Branch', 'is_active' => true, 'updated_at' => now()]);

            $allowedIds = [$lunaId, $roxasId];

            DB::table('users')
                ->whereNotNull('branch_id')
                ->whereNotIn('branch_id', $allowedIds)
                ->update(['branch_id' => $lunaId, 'updated_at' => now()]);

            $userIds = DB::table('users')
                ->select(['id', 'branch_id'])
                ->whereNotNull('branch_id')
                ->whereIn('branch_id', $allowedIds)
                ->get();

            if (DB::getSchemaBuilder()->hasTable('branch_user')) {
                DB::table('branch_user')->whereNotIn('branch_id', $allowedIds)->delete();

                $now = now();
                foreach ($userIds as $row) {
                    DB::table('branch_user')->updateOrInsert(
                        ['branch_id' => (int) $row->branch_id, 'user_id' => (int) $row->id],
                        ['created_at' => $now, 'updated_at' => $now],
                    );
                }
            }

            $removedIds = DB::table('branches')
                ->whereNotIn('id', $allowedIds)
                ->pluck('id')
                ->map(fn ($v) => (int) $v)
                ->all();

            if ($removedIds) {
                if (DB::getSchemaBuilder()->hasColumn('stock_logs', 'branch_id')) {
                    DB::table('stock_logs')->whereIn('branch_id', $removedIds)->update(['branch_id' => null]);
                }
                if (DB::getSchemaBuilder()->hasColumn('inventory_imports', 'branch_id')) {
                    DB::table('inventory_imports')->whereIn('branch_id', $removedIds)->update(['branch_id' => null]);
                }

                DB::table('branches')->whereIn('id', $removedIds)->delete();
            }
        });
    }

    public function down(): void
    {
    }
};

