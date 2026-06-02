<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Branch;
use App\Models\BranchItemStock;
use App\Models\Item;
use App\Models\OverrideApproval;
use App\Models\Sale;
use App\Models\SaleCustomItem;
use App\Models\SaleItem;
use App\Models\SaleModification;
use App\Models\Setting;
use App\Models\StockLog;
use App\Models\User;
use App\Services\BranchResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalesController extends Controller
{
    public function store(Request $request)
    {
        if (! (bool) Setting::getValue('daily_sales_enabled', true)) {
            return response()->json(['message' => 'Daily sales are currently disabled.'], 403);
        }

        $request->validate([
            'client_id' => 'nullable|exists:clients,id',
            'customer_type' => 'nullable|string|in:walk_in,online',
            'items' => 'required|array',
            'items.*.id' => 'required|exists:items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.price_override_reason' => 'nullable|string|max:255',
            'custom_items' => 'sometimes|array',
            'custom_items.*.name' => 'required|string|max:255',
            'custom_items.*.quantity' => 'required|integer|min:1',
            'custom_items.*.unit_price' => 'required|numeric|min:0',
            'custom_items.*.reason' => 'nullable|string|max:255',
            'payment_method' => 'required|string|in:cash,card,gcash',
            'discount' => 'nullable|numeric|min:0',
            'cashier_pin' => 'nullable|string',
            'override_approval_token' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request) {
            $staff = $request->user();
            if (! $staff) {
                throw ValidationException::withMessages(['staff' => ['Unauthorized.']]);
            }

            $tokenId  = $staff->currentAccessToken()->id;
            $branchId = BranchResolver::getActiveBranchId($staff, $tokenId);

            $priceAdjustmentsEnabled = (bool) Setting::getValue('pos_price_adjustments_enabled', true);
            $customItemsEnabled = (bool) Setting::getValue('pos_custom_items_enabled', true);

            $totalAmount = 0;
            $itemsToCreate = [];
            $customItemsToCreate = [];
            $modifications = [];
            $payloadPriceOverrides = [];
            $payloadCustomItems = [];

            foreach ($request->items as $itemData) {
                $item = Item::lockForUpdate()->find($itemData['id']);
                $stock = BranchItemStock::query()
                    ->where('branch_id', $branchId)
                    ->where('item_id', $itemData['id'])
                    ->lockForUpdate()
                    ->first();

                if (! $stock) {
                    ActivityLog::create([
                        'actor_user_id' => $staff->id,
                        'event_type' => 'inventory_item_not_available_in_branch',
                        'description' => 'Attempted to sell an item that is not available in this branch.',
                        'metadata' => [
                            'branch_id' => $branchId,
                            'item_id' => (int) $itemData['id'],
                            'requested_qty' => (int) ($itemData['quantity'] ?? 0),
                            'source' => 'sale_submission',
                        ],
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                    ]);

                    throw ValidationException::withMessages([
                        'items' => ['Item is not available in this branch.'],
                    ]);
                }

                $requestedQty = (int) $itemData['quantity'];
                $availableQty = (int) $stock->quantity;
                if (! $item->is_service && $availableQty < $requestedQty) {
                    $shortfall = $requestedQty - $availableQty;

                    ActivityLog::create([
                        'actor_user_id' => $staff->id,
                        'event_type' => 'inventory_insufficient_stock',
                        'description' => 'Insufficient stock during sale submission.',
                        'metadata' => [
                            'branch_id' => $branchId,
                            'item_id' => $item->id,
                            'sku' => $item->sku,
                            'name' => $item->name,
                            'requested_qty' => $requestedQty,
                            'available_qty' => $availableQty,
                            'shortfall' => $shortfall,
                            'source' => 'sale_submission',
                        ],
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                    ]);

                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for {$item->name}. Short by {$shortfall}."],
                    ]);
                }

                $baseUnitPrice = (float) $item->price;
                $requestedUnitPrice = array_key_exists('unit_price', $itemData) && $itemData['unit_price'] !== null
                    ? (float) $itemData['unit_price']
                    : $baseUnitPrice;
                $quantity = $requestedQty;
                $subtotal = round($requestedUnitPrice * $quantity, 2);
                $totalAmount += $subtotal;

                $itemsToCreate[] = [
                    'item_id' => $item->id,
                    'quantity' => $quantity,
                    'unit_price' => $requestedUnitPrice,
                    'subtotal' => $subtotal,
                ];

                if (abs($requestedUnitPrice - $baseUnitPrice) > 0.0001) {
                    if (! $priceAdjustmentsEnabled) {
                        throw ValidationException::withMessages(['items' => ['Price adjustments are disabled in settings.']]);
                    }
                    $reason = trim((string) ($itemData['price_override_reason'] ?? ''));
                    if ($reason === '') {
                        throw ValidationException::withMessages(['items' => ["Price override reason is required for {$item->name}."]]);
                    }
                    $payloadPriceOverrides[] = [
                        'item_id' => (int) $item->id,
                        'quantity' => $quantity,
                        'unit_price' => round($requestedUnitPrice, 2),
                        'reason' => $reason,
                    ];
                    $modifications[] = [
                        'type' => 'price_override',
                        'item_id' => $item->id,
                        'label' => $item->name,
                        'quantity' => $quantity,
                        'unit_price_before' => round($baseUnitPrice, 2),
                        'unit_price_after' => round($requestedUnitPrice, 2),
                        'subtotal_before' => round($baseUnitPrice * $quantity, 2),
                        'subtotal_after' => $subtotal,
                        'reason' => $reason,
                    ];
                }

                // Update stock levels and log
                if (! $item->is_service) {
                    $stock->decrement('quantity', $quantity);
                    $item->decrement('stock_qty', $quantity);
                    StockLog::create([
                        'item_id' => $item->id,
                        'branch_id' => $branchId,
                        'actor_user_id' => $staff->id,
                        'change_qty' => -$quantity,
                        'new_qty' => (int) $stock->quantity,
                        'reason' => 'sale',
                    ]);
                }
            }

            $customItems = $request->input('custom_items', []);
            foreach ($customItems as $customItem) {
                if (! $customItemsEnabled) {
                    throw ValidationException::withMessages(['custom_items' => ['Custom items are disabled in settings.']]);
                }
                $quantity = (int) $customItem['quantity'];
                $unitPrice = (float) $customItem['unit_price'];
                $reason = trim((string) ($customItem['reason'] ?? ''));
                if ($reason === '') {
                    throw ValidationException::withMessages(['custom_items' => ['Custom item reason is required.']]);
                }
                $subtotal = round($unitPrice * $quantity, 2);
                $totalAmount += $subtotal;

                $customItemsToCreate[] = [
                    'name' => (string) $customItem['name'],
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                ];

                $payloadCustomItems[] = [
                    'name' => (string) $customItem['name'],
                    'quantity' => $quantity,
                    'unit_price' => round($unitPrice, 2),
                    'reason' => $reason,
                ];
                $modifications[] = [
                    'type' => 'custom_item_add',
                    'item_id' => null,
                    'label' => (string) $customItem['name'],
                    'quantity' => $quantity,
                    'unit_price_before' => null,
                    'unit_price_after' => round($unitPrice, 2),
                    'subtotal_before' => null,
                    'subtotal_after' => $subtotal,
                    'reason' => $reason,
                ];
            }

            $approval = null;
            if ($modifications) {
                if (! is_string($request->cashier_pin) || $request->cashier_pin === '') {
                    throw ValidationException::withMessages(['cashier_pin' => ['Cashier PIN is required for overrides.']]);
                }
                if (! is_string($request->override_approval_token) || $request->override_approval_token === '') {
                    throw ValidationException::withMessages(['override_approval_token' => ['Admin override approval is required.']]);
                }

                $this->verifyPinOrFail($staff, (string) $request->cashier_pin);
                $approval = $this->consumeApprovalOrFail(
                    token: (string) $request->override_approval_token,
                    cashierId: (int) $staff->id,
                    expectedPurpose: 'sale_overrides',
                    expectedPayloadHash: $this->hashPayload([
                        'price_overrides' => $payloadPriceOverrides,
                        'custom_items' => $payloadCustomItems,
                    ]),
                );
            }

            $discount = $request->discount ?? 0;
            $tax = 0;
            $finalAmount = $totalAmount - $discount;

            if ($finalAmount < 0) {
                throw ValidationException::withMessages(['discount' => ['Discount cannot exceed subtotal.']]);
            }

            $saleAttributes = [
                'client_id' => $request->client_id,
                'staff_id' => $staff->id,
                'total_amount' => $finalAmount,
                'tax' => $tax,
                'discount' => $discount,
                'payment_method' => $request->payment_method,
                'status' => 'completed',
            ];

            if (Schema::hasColumn('sales', 'customer_type')) {
                $saleAttributes['customer_type'] = $request->customer_type ?: 'walk_in';
            }

            $sale = Sale::create($saleAttributes);

            foreach ($itemsToCreate as $itemToCreate) {
                $itemToCreate['sale_id'] = $sale->id;
                SaleItem::create($itemToCreate);
            }

            foreach ($customItemsToCreate as $itemToCreate) {
                $itemToCreate['sale_id'] = $sale->id;
                SaleCustomItem::create($itemToCreate);
            }

            if ($modifications && $approval) {
                foreach ($modifications as $m) {
                    SaleModification::create([
                        'sale_id' => $sale->id,
                        'cashier_id' => $staff->id,
                        'admin_id' => $approval->admin_id,
                        'type' => $m['type'],
                        'item_id' => $m['item_id'],
                        'label' => $m['label'],
                        'quantity' => $m['quantity'],
                        'unit_price_before' => $m['unit_price_before'],
                        'unit_price_after' => $m['unit_price_after'],
                        'subtotal_before' => $m['subtotal_before'],
                        'subtotal_after' => $m['subtotal_after'],
                        'reason' => $m['reason'],
                        'approval_id' => $approval->id,
                        'approved_at' => $approval->created_at,
                        'metadata' => [
                            'purpose' => $approval->purpose,
                            'expires_at' => $approval->expires_at?->toISOString(),
                        ],
                    ]);
                }
            }

            // Loyalty points update
            if ($request->client_id) {
                $client = Client::find($request->client_id);
                // 1 point per 100 pesos
                $points = floor($finalAmount / 100);
                $client->increment('loyalty_points', $points);
            }

            // Gcash QR handling (simulation)
            $qrCodeUrl = null;
            if ($request->payment_method === 'gcash') {
                $qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCASH_PAYMENT_{$sale->id}";
            }

            // --- Activity log: sale completed ---
            $branch      = Branch::find($branchId);
            $branchLabel = $branch?->name ?? 'Unknown Branch';

            // Build a concise item summary (regular + custom)
            $itemLabels = collect($itemsToCreate)->map(function ($row) {
                $item = Item::find($row['item_id']);
                $qty  = $row['quantity'];
                $name = $item?->name ?? "Item #{$row['item_id']}";
                return "{$name} ×{$qty}";
            });
            foreach ($customItemsToCreate as $ci) {
                $itemLabels->push("{$ci['name']} ×{$ci['quantity']} (custom)");
            }

            $itemSummary = $itemLabels->join(', ');
            $total       = number_format($finalAmount, 2);
            $description = "{$staff->name} ({$branchLabel}) sold: {$itemSummary}. Total: ₱{$total} via {$request->payment_method}.";

            ActivityLog::create([
                'actor_user_id' => $staff->id,
                'event_type'    => 'sale_completed',
                'description'   => $description,
                'metadata'      => [
                    'sale_id'        => $sale->id,
                    'branch_id'      => $branchId,
                    'branch_name'    => $branchLabel,
                    'items'          => $itemLabels->values()->all(),
                    'custom_items'   => collect($customItemsToCreate)->pluck('name')->all(),
                    'total_amount'   => $finalAmount,
                    'payment_method' => $request->payment_method,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            // --- end activity log ---

            return response()->json([
                'sale'        => $sale->load(['client', 'staff', 'saleItems.item', 'customItems', 'modifications.admin', 'modifications.cashier']),
                'qr_code_url' => $qrCodeUrl,
                'message'     => 'Transaction processed successfully.',
            ], 201);
        });
    }

    public function stockWarning(Request $request)
    {
        $validated = $request->validate([
            'issues' => 'required|array|min:1|max:50',
            'issues.*.item_id' => 'required|integer|exists:items,id',
            'issues.*.requested_qty' => 'required|integer|min:1',
            'issues.*.available_qty' => 'required|integer|min:0',
            'issues.*.shortfall' => 'required|integer|min:1',
        ]);

        $staff = $request->user();
        if (! $staff) {
            throw ValidationException::withMessages(['staff' => ['Unauthorized.']]);
        }

        $tokenId  = $staff->currentAccessToken()->id;
        $branchId = BranchResolver::getActiveBranchId($staff, $tokenId);

        ActivityLog::create([
            'actor_user_id' => $staff->id,
            'event_type' => 'inventory_stock_warning',
            'description' => 'Insufficient stock warning displayed in POS.',
            'metadata' => [
                'branch_id' => $branchId,
                'issues' => $validated['issues'],
                'source' => 'pos_realtime',
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->noContent();
    }

    public function index()
    {
        $user = request()->user();

        $query = Sale::query()->with(['client', 'staff', 'saleItems.item', 'customItems', 'modifications.admin', 'modifications.cashier'])->latest();
        $hasCustomerType = Schema::hasColumn('sales', 'customer_type');

        if ($user && $user->role === 'staff') {
            $query->where('staff_id', $user->id);
        }

        if ($branchId = request()->query('branch_id')) {
            $saleIds = ActivityLog::where('event_type', 'sale_completed')
                ->where('metadata->branch_id', (int) $branchId)
                ->pluck('metadata->sale_id');
            $query->whereIn('id', $saleIds);
        }

        if ($date = request()->query('date')) {
            $query->whereDate('created_at', $date);
        }

        if ($startDate = request()->query('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($endDate = request()->query('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        if ($payment = request()->query('payment_method')) {
            $query->where('payment_method', $payment);
        }

        if ($status = request()->query('status')) {
            if ($status === 'voids_and_pending') {
                $query->whereIn('status', ['voided', 'pending_void']);
            } else {
                $query->where('status', $status);
            }
        }

        if ($q = request()->query('q')) {
            $query->where(function ($inner) use ($q, $hasCustomerType) {
                $inner
                    ->whereHas('client', function ($clientQ) use ($q) {
                        $clientQ->where('name', 'like', "%{$q}%");
                    })
                    ->orWhereHas('saleItems.item', function ($itemQ) use ($q) {
                        $itemQ->where('name', 'like', "%{$q}%")
                            ->orWhere('sku', 'like', "%{$q}%");
                    });
                if ($hasCustomerType) {
                    $inner->orWhere('customer_type', 'like', "%{$q}%");
                }
            });
        }

        $sales = $query->get();
        
        $saleIds = $sales->pluck('id');
        $logs = ActivityLog::where('event_type', 'sale_completed')
            ->whereIn('metadata->sale_id', $saleIds)
            ->get()
            ->keyBy(function ($log) {
                return $log->metadata['sale_id'] ?? null;
            });
            
        $sales->transform(function ($sale) use ($logs) {
            $log = $logs->get($sale->id);
            $sale->branch_name = $log ? ($log->metadata['branch_name'] ?? 'Unknown Branch') : 'Unknown Branch';
            return $sale;
        });

        return response()->json($sales);
    }

    private function verifyPinOrFail(User $user, string $pin): void
    {
        $lockedUntil = $user->pin_locked_until;
        if ($lockedUntil && $lockedUntil->isFuture()) {
            throw ValidationException::withMessages(['cashier_pin' => ['PIN is temporarily locked.']]);
        }

        if (! $user->pin_hash) {
            throw ValidationException::withMessages(['cashier_pin' => ['PIN is not set for this account.']]);
        }

        if (! Hash::check($pin, $user->pin_hash)) {
            $attempts = (int) $user->pin_failed_attempts + 1;
            $lockUntil = null;
            if ($attempts >= 5) {
                $lockUntil = now()->addMinutes(5);
            }
            $user->forceFill([
                'pin_failed_attempts' => $attempts >= 5 ? 0 : $attempts,
                'pin_locked_until' => $lockUntil,
            ])->save();

            throw ValidationException::withMessages(['cashier_pin' => ['Invalid PIN.']]);
        }

        if ((int) $user->pin_failed_attempts !== 0 || $user->pin_locked_until) {
            $user->forceFill([
                'pin_failed_attempts' => 0,
                'pin_locked_until' => null,
            ])->save();
        }
    }

    private function consumeApprovalOrFail(string $token, int $cashierId, string $expectedPurpose, string $expectedPayloadHash): OverrideApproval
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            throw ValidationException::withMessages(['override_approval_token' => ['Invalid override token.']]);
        }

        [$approvalId, $secret] = $parts;
        if (! Str::isUuid($approvalId) || $secret === '') {
            throw ValidationException::withMessages(['override_approval_token' => ['Invalid override token.']]);
        }

        $approval = OverrideApproval::query()->lockForUpdate()->find($approvalId);
        if (! $approval) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token not found.']]);
        }

        if ((int) $approval->cashier_id !== $cashierId) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token is not for this cashier.']]);
        }

        if ($approval->purpose !== $expectedPurpose) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token purpose mismatch.']]);
        }

        if ($approval->used_at) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token has already been used.']]);
        }

        if ($approval->expires_at && $approval->expires_at->isPast()) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token has expired.']]);
        }

        $secretHash = hash('sha256', $secret);
        if (! hash_equals((string) $approval->secret_hash, $secretHash)) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token is invalid.']]);
        }

        if (! hash_equals((string) $approval->payload_hash, $expectedPayloadHash)) {
            throw ValidationException::withMessages(['override_approval_token' => ['Override token does not match the current transaction.']]);
        }

        $approval->forceFill(['used_at' => now()])->save();

        return $approval;
    }

    private function hashPayload(array $payload): string
    {
        $normalized = $this->normalizePayload($payload);
        $encoded = json_encode(
            $normalized,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
        );

        return hash('sha256', $encoded ?: '');
    }

    private function normalizePayload(mixed $value): mixed
    {
        if (is_array($value)) {
            $isList = array_is_list($value);
            $mapped = array_map(fn ($v) => $this->normalizePayload($v), $value);

            if ($isList) {
                usort($mapped, function ($a, $b) {
                    $aj = json_encode($a, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
                    $bj = json_encode($b, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);

                    return strcmp((string) $aj, (string) $bj);
                });

                return $mapped;
            }

            ksort($mapped);

            return $mapped;
        }

        return $value;
    }

    public function requestVoid(Request $request, Sale $sale)
    {
        $request->validate([
            'reason' => 'required|string|min:5|max:255',
        ]);

        return DB::transaction(function () use ($request, $sale) {
            $staff = $request->user();
            if (! $staff) {
                throw ValidationException::withMessages(['staff' => ['Unauthorized.']]);
            }

            $sale = Sale::lockForUpdate()->find($sale->id);

            if ($sale->status === 'voided') {
                return response()->json(['message' => 'Sale is already voided.'], 400);
            }
            if ($sale->status === 'pending_void') {
                return response()->json(['message' => 'Sale is already pending void approval.'], 400);
            }
            if ($sale->status !== 'completed') {
                return response()->json(['message' => 'Only completed sales can be voided.'], 400);
            }

            // 1. Mark as pending_void
            $sale->status = 'pending_void';
            $sale->save();

            // 2. Log the request
            $total = number_format($sale->total_amount, 2);
            $reason = trim($request->reason);
            
            ActivityLog::create([
                'actor_user_id' => $staff->id,
                'event_type'    => 'sale_void_requested',
                'description'   => "{$staff->name} requested to void sale #{$sale->id} (₱{$total}). Reason: {$reason}.",
                'metadata'      => [
                    'sale_id'   => $sale->id,
                    'reason'    => $reason,
                    'total_amount' => $sale->total_amount,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'sale' => $sale->load(['client', 'staff', 'saleItems.item', 'customItems', 'modifications.admin', 'modifications.cashier']),
                'message' => 'Void requested successfully. Waiting for admin approval.',
            ], 200);
        });
    }

    public function approveVoid(Request $request, Sale $sale)
    {
        return DB::transaction(function () use ($request, $sale) {
            $admin = $request->user();
            if (! $admin || $admin->role !== 'admin') {
                throw ValidationException::withMessages(['admin' => ['Unauthorized.']]);
            }

            // Find the branch ID from the sale creation activity log
            $creationLog = ActivityLog::where('event_type', 'sale_completed')
                ->where('metadata->sale_id', $sale->id)
                ->first();
            $branchId = $creationLog ? ($creationLog->metadata['branch_id'] ?? null) : null;

            if (! $branchId) {
                throw ValidationException::withMessages(['branch' => ['Could not determine branch for stock return.']]);
            }

            // Must lock for update to prevent race conditions
            $sale = Sale::lockForUpdate()->find($sale->id);

            if ($sale->status !== 'pending_void') {
                return response()->json(['message' => 'Sale is not pending void approval.'], 400);
            }

            // 1. Mark as voided
            $sale->status = 'voided';
            $sale->save();

            $restoredItems = [];

            // 2. Return items to stock
            foreach ($sale->saleItems as $saleItem) {
                $item = Item::lockForUpdate()->find($saleItem->item_id);
                if ($item && !$item->is_service) {
                    $stock = BranchItemStock::query()
                        ->where('branch_id', $branchId)
                        ->where('item_id', $item->id)
                        ->lockForUpdate()
                        ->first();
                        
                    if ($stock) {
                        $stock->increment('quantity', $saleItem->quantity);
                        $item->increment('stock_qty', $saleItem->quantity);
                        
                        StockLog::create([
                            'item_id' => $item->id,
                            'branch_id' => $branchId,
                            'actor_user_id' => $admin->id,
                            'change_qty' => $saleItem->quantity,
                            'new_qty' => (int) $stock->quantity,
                            'reason' => 'void_sale_approved',
                        ]);
                        
                        $restoredItems[] = "{$item->name} ×{$saleItem->quantity}";
                    }
                }
            }

            // 3. Subtract loyalty points if applicable
            if ($sale->client_id) {
                $client = Client::find($sale->client_id);
                if ($client) {
                    $points = floor($sale->total_amount / 100);
                    $client->decrement('loyalty_points', $points);
                    // Prevent negative points just in case
                    if ($client->loyalty_points < 0) {
                        $client->loyalty_points = 0;
                        $client->save();
                    }
                }
            }

            // 4. Log the void approval
            $total = number_format($sale->total_amount, 2);
            $restoredSummary = count($restoredItems) > 0 ? implode(', ', $restoredItems) : 'No physical items to return';
            
            ActivityLog::create([
                'actor_user_id' => $admin->id,
                'event_type'    => 'sale_void_approved',
                'description'   => "{$admin->name} approved void for sale #{$sale->id} (₱{$total}). Returned: {$restoredSummary}.",
                'metadata'      => [
                    'sale_id'   => $sale->id,
                    'branch_id' => $branchId,
                    'total_amount' => $sale->total_amount,
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'sale' => $sale->load(['client', 'staff', 'saleItems.item', 'customItems', 'modifications.admin', 'modifications.cashier']),
                'message' => 'Transaction void approved successfully. Stock has been returned.',
            ], 200);
        });
    }

    public function getVoidReason(Sale $sale)
    {
        $log = ActivityLog::where('event_type', 'sale_void_requested')
            ->where('metadata->sale_id', $sale->id)
            ->first();

        $reason = 'No reason found in activity logs.';
        if ($log && isset($log->metadata['reason'])) {
            $reason = $log->metadata['reason'];
        }

        return response()->json(['reason' => $reason]);
    }
}
