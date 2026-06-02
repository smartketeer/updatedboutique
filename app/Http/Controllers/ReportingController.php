<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\BranchItemStock;
use App\Models\Sale;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class ReportingController extends Controller
{
    public function dailySummary(Request $request)
    {
        $today = Carbon::today();
        $base = Sale::query()
            ->where('status', 'completed')
            ->whereDate('created_at', $today);

        // Optional: filter by branch (via the staff's branch_id)
        if ($branchId = $request->query('branch_id')) {
            $base->whereHas('staff', function ($q) use ($branchId) {
                $q->where('branch_id', (int) $branchId);
            });
        }

        $totalSales = (clone $base)->sum('total_amount');
        $totalCount = (clone $base)->count();
        $totalDiscount = (clone $base)->sum('discount');

        return response()->json([
            'date' => $today->toDateString(),
            'total_revenue' => $totalSales,
            'total_transactions' => $totalCount,
            'total_discount' => $totalDiscount,
        ]);
    }

    public function staffPerformance(Request $request)
    {
        $now = Carbon::now();
        $range = (string) $request->query('range', 'month');

        $salesScope = function ($query) use ($now, $range) {
            $query->where('status', 'completed');

            if ($range === 'today') {
                $query->whereDate('created_at', Carbon::today());

                return;
            }

            if ($range === 'week') {
                $end = Carbon::today()->endOfDay();
                $start = Carbon::today()->subDays(6)->startOfDay();
                $query->whereBetween('created_at', [$start, $end]);

                return;
            }

            if ($range === 'year') {
                $query->whereYear('created_at', $now->year);

                return;
            }

            $query
                ->whereYear('created_at', $now->year)
                ->whereMonth('created_at', $now->month);
        };

        $staffPerformance = User::query()
            ->where('role', 'staff')
            ->withCount(['sales' => $salesScope])
            ->withSum(['sales' => $salesScope], 'total_amount')
            ->orderBy('sales_sum_total_amount', 'desc')
            ->get();

        return response()->json($staffPerformance);
    }

    public function weeklyRevenue()
    {
        $end = Carbon::today()->endOfDay();
        $start = Carbon::today()->subDays(6)->startOfDay();

        $rows = Sale::query()
            ->selectRaw('DATE(created_at) as date, SUM(total_amount) as total_revenue, COUNT(*) as total_transactions')
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $series = [];
        for ($d = $start->copy()->startOfDay(); $d->lte($end); $d->addDay()) {
            $key = $d->toDateString();
            $row = $rows->get($key);
            $series[] = [
                'date' => $key,
                'total_revenue' => $row ? (float) $row->total_revenue : 0.0,
                'total_transactions' => $row ? (int) $row->total_transactions : 0,
            ];
        }

        return response()->json([
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'days' => $series,
        ]);
    }

    public function monthlyRevenue()
    {
        $end = Carbon::today()->endOfDay();
        $start = Carbon::today()->subMonths(11)->startOfMonth()->startOfDay();

        $rows = Sale::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m-01') as date, SUM(total_amount) as total_revenue, COUNT(*) as total_transactions")
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $series = [];
        for ($d = $start->copy(); $d->lte($end); $d->addMonth()) {
            $key = $d->copy()->startOfMonth()->toDateString();
            $row = $rows->get($key);
            $series[] = [
                'date' => $key,
                'total_revenue' => $row ? (float) $row->total_revenue : 0.0,
                'total_transactions' => $row ? (int) $row->total_transactions : 0,
            ];
        }

        return response()->json([
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'days' => $series,
        ]);
    }

    public function yearlyRevenue()
    {
        $end = Carbon::today()->endOfYear()->endOfDay();
        $start = Carbon::today()->subYears(4)->startOfYear()->startOfDay();

        $rows = Sale::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-01-01') as date, SUM(total_amount) as total_revenue, COUNT(*) as total_transactions")
            ->where('status', 'completed')
            ->whereBetween('created_at', [$start, $end])
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $series = [];
        for ($d = $start->copy(); $d->lte($end); $d->addYear()) {
            $key = $d->copy()->startOfYear()->toDateString();
            $row = $rows->get($key);
            $series[] = [
                'date' => $key,
                'total_revenue' => $row ? (float) $row->total_revenue : 0.0,
                'total_transactions' => $row ? (int) $row->total_transactions : 0,
            ];
        }

        return response()->json([
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'days' => $series,
        ]);
    }

    public function inventoryValuation()
    {
        $hasBranchCost = Schema::hasColumn('branch_item_stocks', 'cost');
        $exprCost = $hasBranchCost
            ? 'COALESCE(SUM(branch_item_stocks.quantity * COALESCE(branch_item_stocks.cost, items.cost)), 0) as total_cost'
            : 'COALESCE(SUM(branch_item_stocks.quantity * items.cost), 0) as total_cost';
        $exprPrice = 'COALESCE(SUM(branch_item_stocks.quantity * items.price), 0) as total_price';

        $globalTotals = BranchItemStock::query()
            ->join('items', 'items.id', '=', 'branch_item_stocks.item_id')
            ->where('items.is_service', false)
            ->selectRaw("$exprCost, $exprPrice")
            ->first();

        $totalValuation = (float) ($globalTotals->total_cost ?? 0);
        $totalEstimatedValue = (float) ($globalTotals->total_price ?? 0);

        $branches = \App\Models\Branch::all();
        $branchValuations = [];
        foreach ($branches as $branch) {
            $branchTotals = BranchItemStock::query()
                ->join('items', 'items.id', '=', 'branch_item_stocks.item_id')
                ->where('items.is_service', false)
                ->where('branch_id', $branch->id)
                ->selectRaw("$exprCost, $exprPrice")
                ->first();
                
            $branchValuations[] = [
                'id' => $branch->id,
                'name' => $branch->name,
                'valuation' => (float) ($branchTotals->total_cost ?? 0),
                'estimated_value' => (float) ($branchTotals->total_price ?? 0),
            ];
        }

        return response()->json([
            'total_valuation' => $totalValuation,
            'total_estimated_value' => $totalEstimatedValue,
            'branches' => $branchValuations,
        ]);
    }
}
