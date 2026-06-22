<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Item;
use App\Services\BranchResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    private function resolveBranchId(Request $request, bool $required = true): ?int
    {
        $user = $request->user();
        if ($user && $user->role === 'staff') {
            // Prefer the session-selected branch from cache
            try {
                $token = $user->currentAccessToken();
                $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
                $resolved = BranchResolver::getActiveBranchId($user, $tokenId);
                if ($resolved) {
                    return $resolved;
                }
            } catch (ValidationException) {
                // No cached branch and no branch_id set; fall through
            }

            // Fallback: first active branch in the pivot
            $fallback = $user->branches()->where('is_active', true)->orderBy('branches.id')->value('branches.id');
            if ($fallback) {
                return (int) $fallback;
            }

            // Last resort: any active branch
            $fallback = Branch::query()->where('is_active', true)->orderBy('id')->value('id');
            if ($fallback) {
                return (int) $fallback;
            }

            return $required ? 0 : null;
        }

        $raw = $request->query('branch_id');
        if ($raw !== null && $raw !== '') {
            return (int) $raw;
        }

        if (! $required) {
            return null;
        }

        $fallback = Branch::query()->where('is_active', true)->orderBy('id')->value('id');
        return $fallback ? (int) $fallback : 0;
    }

    private function itemForBranchQuery(int $branchId)
    {
        $isAdmin = auth()->user()?->role === 'admin';
        $select = [
            'items.*',
            'branch_item_stocks.quantity as stock_qty',
            ($isAdmin && Schema::hasColumn('branch_item_stocks', 'cost')) ? 'branch_item_stocks.cost as branch_cost' : DB::raw('NULL as branch_cost'),
            Schema::hasColumn('branch_item_stocks', 'location') ? 'branch_item_stocks.location' : DB::raw('NULL as location'),
            Schema::hasColumn('branch_item_stocks', 'last_restock_date') ? 'branch_item_stocks.last_restock_date' : DB::raw('NULL as last_restock_date'),
            Schema::hasColumn('branch_item_stocks', 'total_sold') ? 'branch_item_stocks.total_sold' : DB::raw('0 as total_sold'),
        ];

        return Item::query()
            ->select($select)
            ->join('branch_item_stocks', function ($join) use ($branchId) {
                $join
                    ->on('items.id', '=', 'branch_item_stocks.item_id')
                    ->where('branch_item_stocks.branch_id', '=', $branchId);
            })
            ->with(['category', 'primaryImage']);
    }

    public function index(Request $request)
    {
        $branchId = $this->resolveBranchId($request);
        if (! $branchId) {
            return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
        }

        $query = $this->itemForBranchQuery($branchId)->orderBy('items.name');

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $q).'%';
            $query->where(function ($sub) use ($like) {
                $sub
                    ->where('items.name', 'like', $like)
                    ->orWhere('items.sku', 'like', $like)
                    ->orWhereHas('category', function ($cat) use ($like) {
                        $cat->where('name', 'like', $like);
                    });
            });
        }

        $categoryId = $request->query('category_id');
        if ($categoryId !== null && $categoryId !== '' && $categoryId !== 'all') {
            $query->where('items.category_id', (int) $categoryId);
        }

        $shouldPaginate = $request->query('page') !== null || $request->query('per_page') !== null;
        if ($shouldPaginate) {
            $perPage = (int) $request->query('per_page', 10);
            if ($perPage < 1) $perPage = 10;
            if ($perPage > 100) $perPage = 100;
            return response()->json($query->paginate($perPage));
        }

        return response()->json($query->get());
    }

    public function lookup(Request $request)
    {
        $validated = $request->validate([
            'sku' => 'required|string',
        ]);

        $branchId = $this->resolveBranchId($request);
        if (! $branchId) {
            return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
        }

        $sku = trim((string) $validated['sku']);
        $row = $this->itemForBranchQuery($branchId)
            ->whereRaw('LOWER(items.sku) = ?', [strtolower($sku)])
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Item not found.'], 404);
        }

        return response()->json($row);
    }

    public function byIds(Request $request)
    {
        $raw = $request->query('ids');
        $ids = [];

        if (is_array($raw)) {
            $ids = $raw;
        } else {
            $str = trim((string) $raw);
            if ($str !== '') {
                $ids = preg_split('/[,\s]+/', $str, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            }
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn ($n) => $n > 0)));
        if (count($ids) > 200) {
            return response()->json(['message' => 'Too many IDs requested.'], 422);
        }

        $branchId = $this->resolveBranchId($request);
        if (! $branchId) {
            return response()->json(['message' => 'No branch is configured yet. Please add a branch first.'], 422);
        }

        if (! $ids) {
            return response()->json([]);
        }

        return response()->json(
            $this->itemForBranchQuery($branchId)->whereIn('items.id', $ids)->get(),
        );
    }

    public function show(Item $item)
    {
        $branchId = request()->query('branch_id');
        if ($branchId !== null && $branchId !== '') {
            $row = $this->itemForBranchQuery((int) $branchId)->where('items.id', $item->id)->first();
            if ($row) {
                return response()->json($row);
            }
        }

        return response()->json($item->load(['category', 'primaryImage']));
    }

    public function categories()
    {
        return response()->json(Category::all());
    }

    public function lowStock(Request $request)
    {
        $lowStockThreshold = 10;
        $branchId = $this->resolveBranchId($request, required: false);

        if ($branchId) {
            $items = $this->itemForBranchQuery($branchId)
                ->where('branch_item_stocks.quantity', '<=', $lowStockThreshold)
                ->get();
        } else {
            $items = Item::where('stock_qty', '<=', $lowStockThreshold)
                ->with('primaryImage')
                ->get();
        }

        return response()->json($items);
    }

    public function checkDuplicate(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $name = trim(strtolower($validated['name']));
        $words = array_slice(explode(' ', $name), 0, 5);
        
        $query = Item::query();
        
        // Simple similarity check: match any word over 3 chars or the whole phrase
        $query->where(function ($q) use ($name, $words) {
            $escapedName = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $name);
            $q->whereRaw('LOWER(name) LIKE ?', ['%' . $escapedName . '%']);
            foreach ($words as $word) {
                if (strlen($word) > 3) {
                    $escapedWord = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $word);
                    $q->orWhereRaw('LOWER(name) LIKE ?', ['%' . $escapedWord . '%']);
                }
            }
        });

        $duplicates = $query->limit(5)->get();

        return response()->json([
            'has_duplicates' => $duplicates->isNotEmpty(),
            'duplicates' => $duplicates
        ]);
    }
}
