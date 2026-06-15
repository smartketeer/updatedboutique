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
            $token = $user->currentAccessToken();
            $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
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
            'name' => [
                'required',
                'string',
                function ($attribute, $value, $fail) {
                    $existsInLocal = \App\Models\Item::whereRaw('LOWER(name) = ?', [strtolower($value)])->exists();
                    if ($existsInLocal) {
                        $fail('This item name already exists in the POS system.');
                        return;
                    }
                    try {
                        $existsInBodega = \Illuminate\Support\Facades\DB::connection('bodega')
                            ->table('items')
                            ->whereRaw('LOWER(name) = ?', [strtolower($value)])
                            ->exists();
                        if ($existsInBodega) {
                            $fail('This item name already exists in the Bodega system.');
                        }
                    } catch (\Exception $e) {
                        // ignore connection failure
                    }
                }
            ],
            'sku' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'cost' => 'required|numeric|min:0',
            'stock_qty' => 'required|integer|min:0',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $user = $request->user();
            $branchId = $this->resolveBranchId($request);
            if (! $branchId) {
                return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
            }

            $initialQty = (int) $validated['stock_qty'];
            $isService = false;
            $sku = trim((string) ($validated['sku'] ?? ''));

            $existing = null;
            if ($sku !== '') {
                $existing = Item::query()
                    ->whereRaw('LOWER(sku) = ?', [strtolower($sku)])
                    ->lockForUpdate()
                    ->first();
            }

            if ($existing) {
                // Type check removed

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
                $addedQty = $initialQty;
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
                        'item_type' => 'product',
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

            if (true) {
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
                    'item_type' => 'product',
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
            // is_service removed
            'adjustment_reason' => 'required|string|max:500',
        ], [
            'adjustment_reason.required' => 'An adjustment reason is required when modifying any product details.',
        ]);

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

    public function pullOut(Request $request, Item $item)
    {
        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:500',
        ]);

        return DB::transaction(function () use ($request, $validated, $item) {
            $user = $request->user();
            $branchId = $this->resolveBranchId($request);
            if (! $branchId) {
                return response()->json(['message' => 'No branch is configured yet.'], 422);
            }

            // Service check removed

            $stock = BranchItemStock::query()
                ->lockForUpdate()
                ->where('branch_id', $branchId)
                ->where('item_id', $item->id)
                ->first();

            $qty = (int) $validated['quantity'];

            if (! $stock || $stock->quantity < $qty) {
                return response()->json(['message' => 'Insufficient stock for pull out.'], 422);
            }

            $stock->decrement('quantity', $qty);
            $item->decrement('stock_qty', $qty);

            StockLog::create([
                'item_id' => $item->id,
                'branch_id' => $branchId,
                'actor_user_id' => $user?->id,
                'change_qty' => -$qty,
                'new_qty' => $stock->quantity,
                'reason' => 'cashier_pull_out',
                'notes' => trim($validated['reason']),
            ]);

            ActivityLog::create([
                'actor_user_id' => $user?->id,
                'event_type' => 'inventory_pull_out',
                'description' => 'Pulled out stock via inventory management access.',
                'metadata' => [
                    'branch_id' => $branchId,
                    'item_id' => $item->id,
                    'item_name' => $item->name,
                    'pulled_out_qty' => $qty,
                    'reason' => trim($validated['reason']),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json(['message' => 'Stock pulled out successfully.']);
        });
    }

    public function transfer(Request $request, Item $item)
    {
        $validated = $request->validate([
            'to_branch_id' => 'required|integer|exists:branches,id',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:500',
        ]);

        return DB::transaction(function () use ($request, $validated, $item) {
            $user = $request->user();
            $fromBranchId = $this->resolveBranchId($request);
            $toBranchId = (int) $validated['to_branch_id'];

            if (! $fromBranchId) {
                return response()->json(['message' => 'No active branch configured.'], 422);
            }

            if ($fromBranchId === $toBranchId) {
                return response()->json(['message' => 'Cannot transfer to the same branch.'], 422);
            }

            // Service check removed

            $fromStock = BranchItemStock::query()
                ->lockForUpdate()
                ->where('branch_id', $fromBranchId)
                ->where('item_id', $item->id)
                ->first();

            $qty = (int) $validated['quantity'];

            if (! $fromStock || $fromStock->quantity < $qty) {
                return response()->json(['message' => 'Insufficient stock for transfer.'], 422);
            }

            // Lock destination stock
            $toStock = BranchItemStock::query()
                ->lockForUpdate()
                ->firstOrCreate(
                    ['branch_id' => $toBranchId, 'item_id' => $item->id],
                    ['quantity' => 0]
                );

            $fromStock->decrement('quantity', $qty);
            $toStock->increment('quantity', $qty);

            // Log for from branch
            StockLog::create([
                'item_id' => $item->id,
                'branch_id' => $fromBranchId,
                'actor_user_id' => $user?->id,
                'change_qty' => -$qty,
                'new_qty' => $fromStock->quantity,
                'reason' => 'cashier_transfer_out',
                'notes' => trim($validated['reason']),
                'meta' => ['to_branch_id' => $toBranchId]
            ]);

            // Log for to branch
            StockLog::create([
                'item_id' => $item->id,
                'branch_id' => $toBranchId,
                'actor_user_id' => $user?->id,
                'change_qty' => $qty,
                'new_qty' => $toStock->quantity,
                'reason' => 'cashier_transfer_in',
                'notes' => trim($validated['reason']),
                'meta' => ['from_branch_id' => $fromBranchId]
            ]);

            ActivityLog::create([
                'actor_user_id' => $user?->id,
                'event_type' => 'inventory_transfer',
                'description' => 'Transferred stock via inventory management access.',
                'metadata' => [
                    'from_branch_id' => $fromBranchId,
                    'to_branch_id' => $toBranchId,
                    'item_id' => $item->id,
                    'item_name' => $item->name,
                    'transferred_qty' => $qty,
                    'reason' => trim($validated['reason']),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json(['message' => 'Stock transferred successfully.']);
        });
    }
}
