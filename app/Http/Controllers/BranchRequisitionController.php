<?php

namespace App\Http\Controllers;

use App\Models\BranchRequisition;
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
            'sku' => 'nullable|string|max:255',
            'item_name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string|max:255',
        ]);

        $requisition = BranchRequisition::create([
            'branch_id' => $request->branch_id,
            'user_id' => $request->user()->id,
            'sku' => $request->sku,
            'item_name' => $request->item_name,
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
}
