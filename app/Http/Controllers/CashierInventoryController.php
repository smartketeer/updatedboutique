<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\BranchItemStock;
use App\Models\Category;
use App\Models\Item;
use App\Models\StockLog;
use App\Services\BranchResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CashierInventoryController extends Controller
{
    private function resolveBranchId(Request $request): int
    {
        $user = $request->user();
        if (! $user) {
            return 0;
        }

        try {
            $tokenId = $user->currentAccessToken()->id;
            return BranchResolver::getActiveBranchId($user, $tokenId);
        } catch (ValidationException $e) {
            // If neither cache nor branch_id is set, try the active-branch fallback
            $fallback = Branch::query()->where('is_active', true)->orderBy('id')->value('id');
            return $fallback ? (int) $fallback : 0;
        }
    }

    private function stockSelectColumns(): array
    {
        return [
            'items.*',
            'branch_item_stocks.quantity as stock_qty',
            Schema::hasColumn('branch_item_stocks', 'cost') ? 'branch_item_stocks.cost as branch_cost' : DB::raw('NULL as branch_cost'),
            Schema::hasColumn('branch_item_stocks', 'location') ? 'branch_item_stocks.location' : DB::raw('NULL as location'),
            Schema::hasColumn('branch_item_stocks', 'last_restock_date') ? 'branch_item_stocks.last_restock_date' : DB::raw('NULL as last_restock_date'),
            Schema::hasColumn('branch_item_stocks', 'total_sold') ? 'branch_item_stocks.total_sold' : DB::raw('0 as total_sold'),
        ];
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string',
            'sku' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'cost' => 'required|numeric|min:0',
            'stock_qty' => 'required|integer|min:0',
            'is_service' => 'required|boolean',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $user = $request->user();
            $branchId = $this->resolveBranchId($request);
            if (! $branchId) {
                return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
            }

            $initialQty = (int) $validated['stock_qty'];
            $isService = (bool) $validated['is_service'];
            $sku = trim((string) ($validated['sku'] ?? ''));

            $existing = null;
            if ($sku !== '') {
                $existing = Item::query()
                    ->whereRaw('LOWER(sku) = ?', [strtolower($sku)])
                    ->lockForUpdate()
                    ->first();
            }

            if ($existing) {
                if ((bool) $existing->is_service !== $isService) {
                    return response()->json(['message' => 'SKU already exists with a different item type (service/product).'], 422);
                }

                $existing->update([
                    'category_id' => (int) $validated['category_id'],
                    'name' => (string) $validated['name'],
                    'price' => (float) $validated['price'],
                    'cost' => (float) $validated['cost'],
                ]);

                $stock = BranchItemStock::query()
                    ->lockForUpdate()
                    ->firstOrCreate(
                        ['branch_id' => $branchId, 'item_id' => $existing->id],
                        ['quantity' => 0],
                    );

                $oldBranchQty = (int) $stock->quantity;
                $addedQty = $existing->is_service ? 0 : $initialQty;
                $newBranchQty = $oldBranchQty + $addedQty;
                if ($newBranchQty !== $oldBranchQty) {
                    $stock->update(['quantity' => $newBranchQty]);
                    $existing->increment('stock_qty', $addedQty);

                    StockLog::create([
                        'item_id' => $existing->id,
                        'branch_id' => $branchId,
                        'actor_user_id' => $user?->id,
                        'change_qty' => $addedQty,
                        'new_qty' => $newBranchQty,
                        'reason' => 'cashier_restock',
                    ]);
                }

                ActivityLog::create([
                    'actor_user_id' => $user?->id,
                    'event_type' => 'inventory_item_added_to_branch',
                    'description' => 'Added an inventory item to the cashier branch via approved inventory management access.',
                    'metadata' => [
                        'branch_id' => $branchId,
                        'item_id' => $existing->id,
                        'sku' => $existing->sku,
                        'name' => $existing->name,
                        'category_id' => $existing->category_id,
                        'category_name' => optional($existing->category)->name,
                        'price' => (float) $existing->price,
                        'cost' => (float) $existing->cost,
                        'item_type' => $existing->is_service ? 'service' : 'product',
                        'added_qty' => $addedQty,
                        'new_branch_qty' => $newBranchQty,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                $row = Item::query()
                    ->select('items.*', 'branch_item_stocks.quantity as stock_qty')
                    ->join('branch_item_stocks', function ($join) use ($branchId) {
                        $join
                            ->on('items.id', '=', 'branch_item_stocks.item_id')
                            ->where('branch_item_stocks.branch_id', '=', $branchId);
                    })
                    ->with('category')
                    ->where('items.id', $existing->id)
                    ->first();

                return response()->json($row ?? $existing->load('category'), 201);
            }

            $normalizedStock = $isService ? 0 : $initialQty;

            $item = Item::create([
                'category_id' => (int) $validated['category_id'],
                'name' => (string) $validated['name'],
                'sku' => $sku !== '' ? $sku : null,
                'price' => (float) $validated['price'],
                'cost' => (float) $validated['cost'],
                'stock_qty' => $normalizedStock,
                'is_service' => $isService,
            ]);

            BranchItemStock::query()->create([
                'branch_id' => $branchId,
                'item_id' => $item->id,
                'quantity' => $normalizedStock,
            ]);

            if (! $item->is_service) {
                StockLog::create([
                    'item_id' => $item->id,
                    'branch_id' => $branchId,
                    'actor_user_id' => $user?->id,
                    'change_qty' => $normalizedStock,
                    'new_qty' => $normalizedStock,
                    'reason' => 'cashier_initial_stock',
                ]);
            }

            ActivityLog::create([
                'actor_user_id' => $user?->id,
                'event_type' => 'inventory_item_created',
                'description' => 'Created an inventory item via approved inventory management access.',
                'metadata' => [
                    'branch_id' => $branchId,
                    'item_id' => $item->id,
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'category_id' => $item->category_id,
                    'category_name' => optional(Category::find($item->category_id))->name,
                    'price' => (float) $item->price,
                    'cost' => (float) $item->cost,
                    'item_type' => $item->is_service ? 'service' : 'product',
                    'initial_stock_qty' => $normalizedStock,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            $select = $this->stockSelectColumns();
            $row = Item::query()
                ->select($select)
                ->join('branch_item_stocks', function ($join) use ($branchId) {
                    $join
                        ->on('items.id', '=', 'branch_item_stocks.item_id')
                        ->where('branch_item_stocks.branch_id', '=', $branchId);
                })
                ->with('category')
                ->where('items.id', $item->id)
                ->first();

            return response()->json($row ?? $item->load('category'), 201);
        });
    }

    public function update(Request $request, Item $item)
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|required|exists:categories,id',
            'name' => 'sometimes|required|string',
            'sku' => 'sometimes|nullable|string|unique:items,sku,'.$item->id,
            'price' => 'sometimes|required|numeric|min:0',
            'cost' => 'sometimes|required|numeric|min:0',
            'stock_qty' => 'sometimes|required|integer|min:0',
            'is_service' => 'sometimes|required|boolean',
            'adjustment_reason' => 'nullable|string|max:500',
        ]);

        // Require an adjustment reason when stock quantity is explicitly changed
        if (array_key_exists('stock_qty', $validated)) {
            $adjustmentReason = trim((string) ($validated['adjustment_reason'] ?? ''));
            if ($adjustmentReason === '') {
                throw ValidationException::withMessages([
                    'adjustment_reason' => 'An adjustment reason is required when modifying the stock quantity.',
                ]);
            }
        }

        return DB::transaction(function () use ($request, $validated, $item) {
            $user = $request->user();
            $branchId = $this->resolveBranchId($request);
            if (! $branchId) {
                return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
            }

            $stock = BranchItemStock::query()
                ->lockForUpdate()
                ->firstOrCreate(
                    ['branch_id' => $branchId, 'item_id' => $item->id],
                    ['quantity' => 0],
                );

            $before = [
                'category_id' => $item->category_id,
                'category_name' => optional($item->category)->name,
                'name' => $item->name,
                'sku' => $item->sku,
                'price' => (float) $item->price,
                'cost' => (float) $item->cost,
                'item_type' => $item->is_service ? 'service' : 'product',
                'branch_stock_qty' => (int) $stock->quantity,
            ];

            $oldBranchQty = (int) $stock->quantity;
            $oldTotalQty = (int) $item->stock_qty;

            $itemData = collect($validated)->except(['stock_qty', 'adjustment_reason'])->toArray();
            if (! empty($itemData)) {
                $item->update($itemData);
            }

            if (array_key_exists('stock_qty', $validated)) {
                $newBranchQty = $item->is_service ? 0 : (int) $validated['stock_qty'];
                if ($newBranchQty !== $oldBranchQty) {
                    $stock->update(['quantity' => $newBranchQty]);
                    $delta = $newBranchQty - $oldBranchQty;
                    $item->update(['stock_qty' => $oldTotalQty + $delta]);

                    if (! $item->is_service) {
                        StockLog::create([
                            'item_id' => $item->id,
                            'branch_id' => $branchId,
                            'actor_user_id' => $user?->id,
                            'change_qty' => $delta,
                            'new_qty' => $newBranchQty,
                            'reason' => $request->adjustment_reason ?? 'cashier_manual_adjustment',
                        ]);
                    }
                }
            }

            $afterStock = BranchItemStock::query()
                ->where('branch_id', $branchId)
                ->where('item_id', $item->id)
                ->value('quantity');

            // Reload category after potential update
            $item->load('category');

            $after = [
                'category_id' => $item->category_id,
                'category_name' => optional($item->category)->name,
                'name' => $item->name,
                'sku' => $item->sku,
                'price' => (float) $item->price,
                'cost' => (float) $item->cost,
                'item_type' => $item->is_service ? 'service' : 'product',
                'branch_stock_qty' => (int) ($afterStock ?? 0),
            ];

            ActivityLog::create([
                'actor_user_id' => $user?->id,
                'event_type' => 'inventory_item_updated',
                'description' => 'Updated an inventory item via approved inventory management access.',
                'metadata' => [
                    'branch_id' => $branchId,
                    'item_id' => $item->id,
                    'item_name' => $item->name,
                    'before' => $before,
                    'after' => $after,
                    'adjustment_reason' => trim((string) ($request->adjustment_reason ?? '')),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            $select = $this->stockSelectColumns();
            $row = Item::query()
                ->select($select)
                ->join('branch_item_stocks', function ($join) use ($branchId) {
                    $join
                        ->on('items.id', '=', 'branch_item_stocks.item_id')
                        ->where('branch_item_stocks.branch_id', '=', $branchId);
                })
                ->with('category')
                ->where('items.id', $item->id)
                ->first();

            return response()->json($row ?? $item->load('category'));
        });
    }

    public function destroy(Request $request, Item $item)
    {
        $user = $request->user();
        $branchId = $this->resolveBranchId($request);
        if (! $branchId) {
            return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
        }

        $payload = [
            'branch_id' => $branchId,
            'item_id' => $item->id,
            'sku' => $item->sku,
            'name' => $item->name,
            'category_id' => $item->category_id,
        ];

        DB::transaction(function () use ($branchId, $item) {
            $stock = BranchItemStock::query()
                ->lockForUpdate()
                ->where('branch_id', $branchId)
                ->where('item_id', $item->id)
                ->first();

            if ($stock) {
                $item->decrement('stock_qty', (int) $stock->quantity);
                $stock->delete();
            }

            $remaining = BranchItemStock::query()->where('item_id', $item->id)->count();
            if ($remaining === 0) {
                $item->delete();
            }
        });

        ActivityLog::create([
            'actor_user_id' => $user?->id,
            'event_type' => 'inventory_item_deleted',
            'description' => 'Deleted an inventory item via approved inventory management access.',
            'metadata' => $payload,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(null, 204);
    }
}
