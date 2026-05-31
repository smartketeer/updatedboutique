<?php
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use App\Models\Branch;
use App\Models\BranchItemStock;

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

$branch = Branch::where('name', 'like', '%Roxas%')->orWhere('name', 'like', '%Megs%')->first();
if (!$branch) {
    echo "Roxas branch not found.";
    exit;
}

$stocks = BranchItemStock::with('item')
    ->where('branch_id', $branch->id)
    ->get();

$totalValue = 0;
echo "<h3>Roxas Branch Stocks</h3>";
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>";
foreach ($stocks as $stock) {
    if (!$stock->item) continue;
    $val = $stock->quantity * $stock->item->price;
    $totalValue += $val;
    if ($val > 0) {
        echo "<tr>";
        echo "<td>{$stock->item->name}</td>";
        echo "<td>{$stock->quantity}</td>";
        echo "<td>{$stock->item->price}</td>";
        echo "<td>{$val}</td>";
        echo "</tr>";
    }
}
echo "</table>";
echo "<h4>Calculated Total: {$totalValue}</h4>";
