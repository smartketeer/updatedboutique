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

        $logs = $query->limit($limit)->get();

        $itemIds = [];
        $branchIds = [];

        foreach ($logs as $log) {
            $meta = $log->metadata;
            if (!is_array($meta)) continue;
            
            if (isset($meta['branch_id'])) {
                $branchIds[] = $meta['branch_id'];
            }
            if (isset($meta['item_id'])) {
                $itemIds[] = $meta['item_id'];
            }
            if (isset($meta['issues']) && is_array($meta['issues'])) {
                foreach ($meta['issues'] as $issue) {
                    if (isset($issue['item_id'])) {
                        $itemIds[] = $issue['item_id'];
                    }
                }
            }
            
            // For general metadata before/after keys
            foreach (['before', 'after'] as $key) {
                if (isset($meta[$key]) && is_array($meta[$key])) {
                    if (isset($meta[$key]['branch_id'])) {
                        $branchIds[] = $meta[$key]['branch_id'];
                    }
                    if (isset($meta[$key]['item_id'])) {
                        $itemIds[] = $meta[$key]['item_id'];
                    }
                }
            }
        }

        $items = \App\Models\Item::whereIn('id', array_unique($itemIds))->pluck('name', 'id');
        $branches = \App\Models\Branch::whereIn('id', array_unique($branchIds))->pluck('name', 'id');

        $logs->transform(function ($log) use ($items, $branches) {
            $meta = $log->metadata;
            if (!is_array($meta)) return $log;

            $transformMeta = function (&$array) use ($items, $branches) {
                if (isset($array['branch_id'])) {
                    if ($branches->has($array['branch_id'])) {
                        $array['branch_name'] = $branches[$array['branch_id']];
                    }
                    unset($array['branch_id']);
                }
                if (isset($array['item_id'])) {
                    if ($items->has($array['item_id'])) {
                        $array['item_name'] = $items[$array['item_id']];
                    }
                    unset($array['item_id']);
                }
                
                // Reorder so name is at the top/front if possible
                if (isset($array['item_name'])) {
                    $array = ['item_name' => $array['item_name']] + $array;
                }
            };

            $transformMeta($meta);
            
            if (isset($meta['branch_name'])) {
                $meta = ['branch_name' => $meta['branch_name']] + $meta;
            }

            if (isset($meta['issues']) && is_array($meta['issues'])) {
                foreach ($meta['issues'] as &$issue) {
                    if (is_array($issue)) {
                        $transformMeta($issue);
                    }
                }
            }

            foreach (['before', 'after'] as $key) {
                if (isset($meta[$key]) && is_array($meta[$key])) {
                    $transformMeta($meta[$key]);
                }
            }

            $log->metadata = $meta;
            return $log;
        });

        return response()->json($logs);
    }
}

