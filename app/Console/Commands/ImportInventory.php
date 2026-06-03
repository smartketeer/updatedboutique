<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Item;
use App\Models\BranchItemStock;
use App\Models\StockLog;
use Illuminate\Support\Facades\DB;

class ImportInventory extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'import:inventory {branch_name} {file_path}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import inventory from a CSV file for a specific branch';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $branchName = $this->argument('branch_name');
        $filePath = $this->argument('file_path');

        if (!file_exists($filePath)) {
            $this->error("File not found: {$filePath}");
            return;
        }

        $this->info("Importing inventory for branch: {$branchName} from {$filePath}");

        // Find or create branch
        $branch = Branch::firstOrCreate(
            ['name' => $branchName],
            ['is_active' => true]
        );

        // Ensure we have a default category
        $category = Category::firstOrCreate(
            ['name' => 'General Merchandise'],
            ['type' => 'product']
        );

        $file = fopen($filePath, 'r');
        $header = fgetcsv($file); // Read the header row
        
        // Find column indexes based on header names (case-insensitive)
        $colDesc = -1;
        $colCapital = -1;
        $colPrice = -1;
        $colStock = -1;

        foreach ($header as $index => $colName) {
            $colName = strtolower(trim($colName));
            if (str_contains($colName, 'description') || str_contains($colName, 'name')) {
                $colDesc = $index;
            } elseif (str_contains($colName, 'capital')) {
                $colCapital = $index;
            } elseif (str_contains($colName, 'price')) {
                $colPrice = $index;
            } elseif (str_contains($colName, 'unsold') || str_contains($colName, 'current stock') || $colName === 'stock' || $colName === 'stocks') {
                // Prioritize the 'unsold' column as the current stock based on the images, 
                // but fallback to 'stock' if found later.
                if ($colStock === -1 || str_contains($colName, 'unsold')) {
                    $colStock = $index;
                }
            }
        }

        // If headers don't match perfectly, assume hardcoded positions based on the provided screenshots:
        // A=0: Location, B=1: Description, C=2: Date, D=3: Capital Price, E=4: Price per product, F=5: Number of Sales, G=6: Total, H=7: Stocks, I=8: Sold, J=9: Total number of Unsold Products
        if ($colDesc === -1) $colDesc = 1;
        if ($colCapital === -1) $colCapital = 3;
        if ($colPrice === -1) $colPrice = 4;
        if ($colStock === -1) $colStock = 9;

        $importedCount = 0;

        DB::beginTransaction();
        try {
            while (($row = fgetcsv($file)) !== false) {
                // Skip empty rows or rows that don't have enough columns
                if (empty($row) || count($row) <= $colDesc || empty(trim($row[$colDesc]))) {
                    continue;
                }

                $name = trim($row[$colDesc]);

                // Skip the actual header row if it is found lower in the file
                if (strtolower($name) === 'description' || strtolower($name) === 'name') {
                    continue;
                }
                
                // Clean money values (remove currency symbols and commas)
                $costStr = isset($row[$colCapital]) ? preg_replace('/[^0-9.]/', '', $row[$colCapital]) : '0';
                $priceStr = isset($row[$colPrice]) ? preg_replace('/[^0-9.]/', '', $row[$colPrice]) : '0';
                $cost = (float) ($costStr ?: 0);
                $price = (float) ($priceStr ?: 0);
                
                // Clean stock value
                $stockStr = isset($row[$colStock]) ? preg_replace('/[^0-9]/', '', $row[$colStock]) : '0';
                $stockQty = (int) ($stockStr ?: 0);

                // Check if item exists globally (by name)
                $item = Item::where('name', $name)->first();

                if (!$item) {
                    $item = Item::create([
                        'category_id' => $category->id,
                        'name' => $name,
                        'cost' => $cost,
                        'price' => $price,
                        'stock_qty' => 0, // We'll accumulate branch stocks later
                        'is_service' => false,
                    ]);
                } else {
                    // Update prices if they are higher/newer (optional, but let's keep the existing logic simple)
                    if ($price > 0 && $item->price == 0) {
                        $item->update(['price' => $price, 'cost' => $cost]);
                    }
                }

                // Add or update branch stock
                $branchStock = BranchItemStock::firstOrCreate(
                    ['branch_id' => $branch->id, 'item_id' => $item->id],
                    ['quantity' => 0]
                );

                $oldQty = $branchStock->quantity;
                
                // Set the quantity to the imported unsold stock
                $branchStock->update(['quantity' => $stockQty]);
                
                // Update global item stock total
                $delta = $stockQty - $oldQty;
                if ($delta !== 0) {
                    $item->increment('stock_qty', $delta);
                    
                    StockLog::create([
                        'item_id' => $item->id,
                        'branch_id' => $branch->id,
                        'actor_user_id' => null,
                        'change_qty' => $delta,
                        'new_qty' => $stockQty,
                        'reason' => 'initial_csv_import',
                    ]);
                }

                $importedCount++;
            }

            DB::commit();
            $this->info("Successfully imported {$importedCount} items for branch '{$branchName}'.");
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("Error during import: " . $e->getMessage());
        }

        fclose($file);
    }
}
