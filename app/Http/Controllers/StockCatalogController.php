<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\BranchItemStock;
use App\Models\Category;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockCatalogController extends Controller
{
    public function storeItem(Request $request)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => [
                'required',
                'string',
                function ($attribute, $value, $fail) use ($request) {
                    if ($request->boolean('force_create')) {
                        return;
                    }
                    $existsInLocal = \App\Models\Item::whereRaw('LOWER(name) = ?', [strtolower($value)])->exists();
                    if ($existsInLocal) {
                        $fail('This item name already exists in the POS system.');
                        return;
                    }
                }
            ],
            'sku' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'cost' => 'required|numeric|min:0',
            // is_service removed
            'branch_id' => 'required|integer|exists:branches,id',
            'stock' => 'nullable|numeric|min:0',
        ]);

        return DB::transaction(function () use ($request, $validated) {
            $branchId = (int) $validated['branch_id'];
            $requestedIsService = false;
            $sku = trim((string) ($validated['sku'] ?? ''));
            $initialStock = isset($validated['stock']) ? (int) $validated['stock'] : 0;

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

                BranchItemStock::query()
                    ->lockForUpdate()
                    ->firstOrCreate(
                        ['branch_id' => $branchId, 'item_id' => $existing->id],
                        ['quantity' => $initialStock],
                    );

                ActivityLog::create([
                    'actor_user_id' => $request->user()?->id,
                    'event_type' => 'catalog_item_attached_to_branch',
                    'description' => 'Attached an existing catalog item to a branch with initial stock.',
                    'metadata' => [
                        'branch_id' => $branchId,
                        'item_id' => $existing->id,
                        'sku' => $existing->sku,
                        'name' => $existing->name,
                        'category_id' => $existing->category_id,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);

                return response()->json($existing->load('category'), 201);
            }

            $item = Item::create([
                'category_id' => (int) $validated['category_id'],
                'name' => (string) $validated['name'],
                'sku' => $sku !== '' ? $sku : null,
                'price' => (float) $validated['price'],
                'cost' => (float) $validated['cost'],
                'stock_qty' => $initialStock,
                'is_service' => $requestedIsService,
            ]);

            // Reverse Sync to Bodega
            try {
                $bdgCategoryId = null;
                $posCategory = Category::find($item->category_id);
                if ($posCategory) {
                    $bdgCategory = DB::table('bodega_categories')->where('bdg_name', $posCategory->name)->first();
                    if ($bdgCategory) {
                        $bdgCategoryId = $bdgCategory->bdg_id;
                    }
                }
                
                DB::table('bodega_items')->insert([
                    'bdg_category_id' => $bdgCategoryId,
                    'bdg_name' => $item->name,
                    'bdg_sku' => $item->sku,
                    'bdg_price' => $item->price,
                    'bdg_cost' => $item->cost,
                    'bdg_stock_qty' => 0,
                    'bdg_is_service' => $item->is_service,
                    'bdg_primary_image_id' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } catch (\Exception $e) {
                // Silently handle if Bodega reverse sync fails or is unavailable
            }

            BranchItemStock::query()->create([
                'branch_id' => $branchId,
                'item_id' => $item->id,
                'quantity' => $initialStock,
            ]);

            ActivityLog::create([
                'actor_user_id' => $request->user()?->id,
                'event_type' => 'catalog_item_created',
                'description' => 'Created a catalog item with initial stock.',
                'metadata' => [
                    'branch_id' => $branchId,
                    'item_id' => $item->id,
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'category_id' => $item->category_id,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json($item->load('category'), 201);
        });
    }

    public function updateItem(Request $request, Item $item)
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|required|exists:categories,id',
            'name' => 'sometimes|required|string',
            'sku' => 'sometimes|nullable|string|unique:items,sku,'.$item->id,
            'price' => 'sometimes|required|numeric|min:0',
            'cost' => 'sometimes|required|numeric|min:0',
            // is_service removed
        ]);

        $before = [
            'category_id' => $item->category_id,
            'name' => $item->name,
            'sku' => $item->sku,
            'price' => $item->price,
            'cost' => $item->cost,
            'is_service' => $item->is_service,
        ];

        $item->update($validated);

        $after = [
            'category_id' => $item->category_id,
            'name' => $item->name,
            'sku' => $item->sku,
            'price' => $item->price,
            'cost' => $item->cost,
            'is_service' => $item->is_service,
        ];

        ActivityLog::create([
            'actor_user_id' => $request->user()?->id,
            'event_type' => 'catalog_item_updated',
            'description' => 'Updated a catalog item.',
            'metadata' => [
                'item_id' => $item->id,
                'before' => $before,
                'after' => $after,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json($item->load('category'));
    }

    public function destroyItem(Request $request, Item $item)
    {
        DB::transaction(function () use ($item) {
            $item->delete();
        });

        ActivityLog::create([
            'actor_user_id' => $request->user()?->id,
            'event_type' => 'catalog_item_deleted',
            'description' => 'Deleted a catalog item.',
            'metadata' => [
                'item_id' => $item->id,
                'sku' => $item->sku,
                'name' => $item->name,
                'category_id' => $item->category_id,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(null, 204);
    }

    public function destroyItems(Request $request)
    {
        $validated = $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'required|integer|exists:items,id',
        ]);

        $ids = array_unique(array_map('intval', $validated['ids']));
        $items = Item::whereIn('id', $ids)->get();

        DB::transaction(function () use ($items, $request) {
            foreach ($items as $item) {
                $item->delete();
                ActivityLog::create([
                    'actor_user_id' => $request->user()?->id,
                    'event_type'    => 'catalog_item_deleted',
                    'description'   => 'Deleted a catalog item (bulk).',
                    'metadata'      => [
                        'item_id'     => $item->id,
                        'sku'         => $item->sku,
                        'name'        => $item->name,
                        'category_id' => $item->category_id,
                    ],
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ]);
            }
        });

        return response()->json(['deleted' => count($items)], 200);
    }

    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:categories,name',
            'type' => 'required|string|in:product,service',
        ]);

        $category = Category::create($validated);

        try {
            \Illuminate\Support\Facades\DB::connection('bodega')->table('bodega_categories')->insertOrIgnore([
                'bdg_name' => $validated['name'],
                'bdg_description' => $validated['type'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Ignore if Bodega DB is unreachable
        }

        ActivityLog::create([
            'actor_user_id' => $request->user()?->id,
            'event_type' => 'catalog_category_created',
            'description' => 'Created a category.',
            'metadata' => [
                'category_id' => $category->id,
                'name' => $category->name,
                'type' => $category->type,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json($category, 201);
    }
}

