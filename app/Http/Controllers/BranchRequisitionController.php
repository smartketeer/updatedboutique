<?php

namespace App\Http\Controllers;

use App\Models\BranchRequisition;
use App\Models\Item;
use Illuminate\Http\Request;

class BranchRequisitionController extends Controller
{
    // For Bodega to view all pending requests
    public function index(Request $request)
    {
        $status = $request->query('status'); // e.g. 'pending'
        $query = BranchRequisition::with(['branch', 'user'])->latest();
        
        if ($status) {
            $query->where('status', $status);
        }

        return response()->json($query->get());
    }

    // For Cashier to submit a request
    public function store(Request $request)
    {
        $request->validate([
            'branch_id' => 'required|exists:branches,id',
            'sku' => 'required|string|max:255',
            'item_name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        // Reject placeholder item names from frontend lookup failures
        $invalidNames = ['Item not found', 'Error searching item'];
        if (in_array($request->item_name, $invalidNames, true)) {
            return response()->json([
                'message' => 'The requested item does not exist in inventory. Please check the SKU.'
            ], 422);
        }

        // Verify the SKU actually exists in inventory
        $item = Item::where('sku', $request->sku)->first();
        if (!$item) {
            return response()->json([
                'message' => 'No item found with SKU "' . $request->sku . '". Please verify the SKU and try again.'
            ], 422);
        }

        // Use the actual item name from the database to ensure consistency
        $requisition = BranchRequisition::create([
            'branch_id' => $request->branch_id,
            'user_id' => $request->user()->id,
            'sku' => $request->sku,
            'item_name' => $item->name,
            'quantity' => $request->quantity,
            'reason' => $request->reason,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Request submitted successfully!',
            'requisition' => $requisition
        ], 201);
    }

    // For Bodega to approve/reject
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected,fulfilled'
        ]);

        $requisition = BranchRequisition::findOrFail($id);
        $requisition->update(['status' => $request->status]);

        return response()->json(['message' => 'Status updated successfully.', 'requisition' => $requisition]);
    }
    public function notifications(Request $request)
    {
        $branchId = $request->query('branch_id');
        if (!$branchId) {
            $user = $request->user();
            if ($user && $user->role === 'staff') {
                try {
                    $token = $user->currentAccessToken();
                    $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
                    $branchId = \App\Services\BranchResolver::getActiveBranchId($user, $tokenId);
                } catch (\Exception $e) {
                    // Ignore
                }
                if (!$branchId) {
                    $fallback = \App\Models\Branch::query()->where('is_active', true)->orderBy('id')->value('id');
                    $branchId = $fallback ? (int) $fallback : 0;
                }
            }
        }

        $notifications = BranchRequisition::with(['branch'])
            ->where('branch_id', $branchId)
            ->where('status', 'rejected')
            ->where('is_notified', false)
            ->get();

        return response()->json($notifications);
    }

    public function markNotified(Request $request, $id)
    {
        $requisition = BranchRequisition::findOrFail($id);
        
        $branchId = $request->header('X-Branch-ID');
        if (!$branchId) {
            $user = $request->user();
            if ($user && $user->role === 'staff') {
                try {
                    $token = $user->currentAccessToken();
                    $tokenId = ($token instanceof \Laravel\Sanctum\TransientToken) ? session()->getId() : $token->id;
                    $branchId = \App\Services\BranchResolver::getActiveBranchId($user, $tokenId);
                } catch (\Exception $e) {
                    // Ignore
                }
                if (!$branchId) {
                    $fallback = \App\Models\Branch::query()->where('is_active', true)->orderBy('id')->value('id');
                    $branchId = $fallback ? (int) $fallback : 0;
                }
            }
        }
        
        // Add basic security check to ensure they can only mark their own branch's notifications
        if ($branchId && $requisition->branch_id != $branchId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $requisition->update(['is_notified' => true]);

        return response()->json(['message' => 'Notification marked as read']);
    }
}
