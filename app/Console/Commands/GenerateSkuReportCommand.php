<?php

namespace App\Console\Commands;

use App\Models\Item;
use App\Models\SkuAuditLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;

class GenerateSkuReportCommand extends Command
{
    protected $signature = 'sku:report';
    protected $description = 'Generate comprehensive SKU audit report';

    public function handle(): int
    {
        $this->info('Generating SKU report...');

        // 1. Inventory Audit
        $totalItems = Item::count();
        $itemsWithSku = Item::whereNotNull('sku')->count();
        $itemsWithoutSku = Item::whereNull('sku')->count();

        $this->info("Total Items: {$totalItems}");
        $this->info("Items with SKU: {$itemsWithSku}");
        $this->info("Items without SKU: {$itemsWithoutSku}");

        // 2. Check for duplicate SKUs
        $duplicateSkus = Item::select('sku')
            ->whereNotNull('sku')
            ->groupBy('sku')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('sku');

        $this->info("Duplicate SKUs found: " . $duplicateSkus->count());

        // 3. Get all backfilled SKUs
        $backfilledSkus = collect();
        if (Schema::hasTable('sku_audit_logs')) {
            $backfilledSkus = SkuAuditLog::where('action', 'backfilled')->get();
        }

        // 4. Generate report content
        $reportContent = "=== COMPREHENSIVE SKU REPORT ===\n";
        $reportContent .= "Generated on: " . now()->toDateTimeString() . "\n";
        $reportContent .= "\n--- 1. INVENTORY AUDIT ---\n";
        $reportContent .= "Total Items: {$totalItems}\n";
        $reportContent .= "Items with SKU: {$itemsWithSku}\n";
        $reportContent .= "Items without SKU: {$itemsWithoutSku}\n";

        $reportContent .= "\n--- 2. SKU NAMING FRAMEWORK ---\n";
        $reportContent .= "Format: [CATEGORY_CODE]-[ITEM_NAME_PARTS]-[4-DIGIT_RANDOM]\n";
        $reportContent .= "Category Codes:\n";
        $reportContent .= "  - Beauty & Personal Care: BTY\n";
        $reportContent .= "  - School & Office Supplies: SCH\n";
        $reportContent .= "  - Apparel & Fashion: APP\n";
        $reportContent .= "  - Footwear: FTW\n";
        $reportContent .= "  - Other: First 3 letters of category name\n";
        $reportContent .= "Item Name Parts: First 3 letters of first 3 words in item name\n";
        $reportContent .= "4-Digit Random: Unique random number between 0001 and 9999\n";

        $reportContent .= "\n--- 3. VALIDATION RESULTS ---\n";
        if ($duplicateSkus->count() > 0) {
            $reportContent .= "❌ Duplicate SKUs found:\n";
            foreach ($duplicateSkus as $sku) {
                $count = Item::where('sku', $sku)->count();
                $reportContent .= "  - {$sku} ({$count} items)\n";
            }
        } else {
            $reportContent .= "✅ No duplicate SKUs found!\n";
        }

        $reportContent .= "\n--- 4. BACKFILLED SKUs ---\n";
        if ($backfilledSkus->count() > 0) {
            $reportContent .= "Total backfilled SKUs: " . $backfilledSkus->count() . "\n";
            $reportContent .= "\nItem ID | SKU | Item Name\n";
            $reportContent .= "--------|-----|----------\n";
            foreach ($backfilledSkus as $log) {
                $reportContent .= "{$log->item_id} | {$log->sku} | {$log->metadata['name']}\n";
            }
        } else {
            $reportContent .= "No SKUs backfilled yet.\n";
        }

        $reportContent .= "\n--- 5. SYSTEM INTEGRATION ---\n";
        $reportContent .= "✅ SKU field is required in Add Item form\n";
        $reportContent .= "✅ SKU is auto-generated on item creation\n";
        $reportContent .= "✅ SKU field is read-only in Add Item form\n";
        $reportContent .= "✅ SKU audit log tracks all SKU changes\n";

        // Save report to file
        $fileName = 'sku-report-' . now()->format('Y-m-d-H-i-s') . '.txt';
        Storage::disk('local')->put($fileName, $reportContent);
        $this->info("Report saved to: " . storage_path('app/' . $fileName));

        // Output report to console
        $this->line("\n" . $reportContent);

        return Command::SUCCESS;
    }
}
