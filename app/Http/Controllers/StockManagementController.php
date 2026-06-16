<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\BranchItemStock;
use App\Models\Item;
use App\Models\StockLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockManagementController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|integer|exists:branches,id',
            'item_id' => 'nullable|integer|exists:items,id',
            'reason' => 'nullable|string',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'limit' => 'nullable|integer|min:1|max:500',
        ]);

        $query = StockLog::query()
            ->with(['item.category', 'branch', 'actor'])
            ->orderByDesc('created_at');

        if (! empty($validated['branch_id'])) {
            $query->where('branch_id', (int) $validated['branch_id']);
        }
        if (! empty($validated['item_id'])) {
            $query->where('item_id', (int) $validated['item_id']);
        }
        if (! empty($validated['reason'])) {
            $reasons = array_map('trim', explode(',', $validated['reason']));
            $query->whereIn('reason', $reasons);
        }
        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        $limit = (int) ($validated['limit'] ?? 100);
        $rows = $query->limit($limit)->get();

        return response()->json($rows);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'branch_id' => 'required|integer|exists:branches,id',
            'item_id' => 'required|integer|exists:items,id',
            'reason' => 'required|string|in:receipt,issue,adjustment,supply',
            'quantity' => 'nullable|integer|min:0',
            'mode' => 'nullable|string|in:set,delta',
            'reference' => 'nullable|string|max:120',
            'notes' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:120',
            'unit_cost' => 'nullable|numeric|min:0',
            'receipt_date' => 'nullable|date',
        ]);

        $user = $request->user();
        $branchId = (int) $validated['branch_id'];
        $itemId = (int) $validated['item_id'];
        $reason = (string) $validated['reason'];

        $qty = array_key_exists('quantity', $validated) ? (int) ($validated['quantity'] ?? 0) : null;
        $mode = (string) ($validated['mode'] ?? '');

        return DB::transaction(function () use ($request, $user, $branchId, $itemId, $reason, $qty, $mode, $validated) {
            $item = Item::query()->lockForUpdate()->findOrFail($itemId);
            $stock = BranchItemStock::query()
                ->lockForUpdate()
                ->firstOrCreate(['branch_id' => $branchId, 'item_id' => $item->id], ['quantity' => 0]);

            $oldQty = (int) $stock->quantity;
            $delta = 0;
            $newQty = $oldQty;

            // Service checks removed

            if ($reason === 'receipt' || $reason === 'supply') {
                if ($qty === null || $qty <= 0) {
                    throw ValidationException::withMessages(['quantity' => ['Quantity must be greater than 0.']]);
                }
                $delta = $qty;
                $newQty = $oldQty + $delta;
            } elseif ($reason === 'issue') {
                if ($qty === null || $qty <= 0) {
                    throw ValidationException::withMessages(['quantity' => ['Quantity must be greater than 0.']]);
                }
                if ($qty > $oldQty) {
                    throw ValidationException::withMessages(['quantity' => ['Cannot issue more than current stock.']]);
                }
                $delta = -$qty;
                $newQty = $oldQty + $delta;
            } elseif ($reason === 'adjustment') {
                $effectiveMode = $mode !== '' ? $mode : 'set';
                if ($effectiveMode === 'set') {
                    if ($qty === null || $qty < 0) {
                        throw ValidationException::withMessages(['quantity' => ['Quantity must be 0 or more.']]);
                    }
                    $newQty = $qty;
                    $delta = $newQty - $oldQty;
                } else {
                    if ($qty === null) {
                        throw ValidationException::withMessages(['quantity' => ['Quantity is required.']]);
                    }
                    $delta = $qty;
                    $newQty = $oldQty + $delta;
                    if ($newQty < 0) {
                        throw ValidationException::withMessages(['quantity' => ['Resulting stock cannot be negative.']]);
                    }
                }
            }

            if ($delta === 0) {
                return response()->json(['message' => 'No stock change.'], 200);
            }

            $reference = isset($validated['reference']) ? trim((string) $validated['reference']) : '';
            if ($reference !== '') {
                $duplicate = StockLog::query()
                    ->where('branch_id', $branchId)
                    ->where('reason', $reason)
                    ->where('reference', $reference)
                    ->exists();

                if ($duplicate) {
                    throw ValidationException::withMessages(['reference' => ['Duplicate reference for this branch and entry type.']]);
                }
            }

            $stock->update(['quantity' => $newQty]);
            if ($delta > 0) {
                $item->increment('stock_qty', $delta);
            } elseif ($delta < 0) {
                $item->decrement('stock_qty', abs($delta));
            }

            $meta = [];
            if ($reason === 'adjustment') {
                $meta['mode'] = $mode !== '' ? $mode : 'set';
                $meta['previous_qty'] = $oldQty;
            }
            if (! empty($validated['supplier'])) $meta['supplier'] = (string) $validated['supplier'];
            if (array_key_exists('unit_cost', $validated) && $validated['unit_cost'] !== null) $meta['unit_cost'] = (float) $validated['unit_cost'];
            if (! empty($validated['receipt_date'])) $meta['receipt_date'] = (string) $validated['receipt_date'];

            $log = StockLog::create([
                'item_id' => $item->id,
                'branch_id' => $branchId,
                'actor_user_id' => $user?->id,
                'change_qty' => $delta,
                'new_qty' => $newQty,
                'reason' => $reason,
                'reference' => $reference !== '' ? $reference : null,
                'notes' => isset($validated['notes']) ? trim((string) $validated['notes']) : null,
                'meta' => $meta ? $meta : null,
            ]);

            ActivityLog::create([
                'actor_user_id' => $user?->id,
                'event_type' => 'stock_movement_created',
                'description' => 'Created a stock movement entry.',
                'metadata' => [
                    'branch_id' => $branchId,
                    'item_id' => $item->id,
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'reason' => $reason,
                    'change_qty' => $delta,
                    'new_qty' => $newQty,
                    'reference' => $reference !== '' ? $reference : null,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json($log->load(['item.category', 'branch', 'actor']), 201);
        });
    }
}
