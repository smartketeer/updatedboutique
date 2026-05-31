<?php

use App\Models\Branch;
use App\Models\BranchItemStock;
use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $branchId = Branch::query()->orderByDesc('is_active')->orderBy('id')->value('id');
        if (! $branchId) {
            return;
        }

        DB::transaction(function () use ($branchId) {
            User::query()
                ->where('role', 'staff')
                ->whereNull('branch_id')
                ->update(['branch_id' => (int) $branchId]);

            $items = Item::query()->select(['id', 'stock_qty', 'is_service'])->get();
            foreach ($items as $item) {
                BranchItemStock::query()->firstOrCreate(
                    ['branch_id' => (int) $branchId, 'item_id' => (int) $item->id],
                    ['quantity' => $item->is_service ? 0 : (int) $item->stock_qty],
                );
            }
        });
    }

    public function down(): void
    {
    }
};
