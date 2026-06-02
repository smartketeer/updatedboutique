<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'scope' => 'nullable|string|in:cashier,all',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        $limit = (int) ($validated['limit'] ?? 20);
        $scope = (string) ($validated['scope'] ?? 'cashier');

        $query = ActivityLog::query()
            ->with(['actor:id,name,email,role'])
            ->latest();

        if (! empty($validated['actor_user_id'])) {
            $query->where('actor_user_id', (int) $validated['actor_user_id']);
        }

        if ($scope === 'cashier') {
            $query->whereHas('actor', function ($q) {
                $q->where('role', 'staff');
            });
        }

        if ($exclude = request()->query('exclude_events')) {
            $excludeArray = explode(',', $exclude);
            $query->whereNotIn('event_type', $excludeArray);
        }

        return response()->json($query->limit($limit)->get());
    }
}

