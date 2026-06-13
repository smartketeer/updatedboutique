<?php

namespace App\Console\Commands;

use App\Models\Item;
use App\Models\Category;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncInventoryCommand extends Command
{
    protected $signature = 'inventory:sync {direction=to-bodega}';
    protected $description = 'Sync inventory items between bodega and main POS';

    public function handle(): int
    {
        $direction = $this->argument('direction');
        
        $this->info("Starting inventory sync: {$direction}");

        if ($direction === 'to-bodega') {
            $this->syncToBodega();
        } elseif ($direction === 'from-bodega') {
            $this->syncFromBodega();
        } else {
            $this->error("Invalid direction. Use 'to-bodega' or 'from-bodega'.");
            return Command::FAILURE;
        }

        $this->info("Inventory sync complete!");
        return Command::SUCCESS;
    }

    private function syncToBodega(): void
    {
        $this->info("Syncing FROM main POS TO bodega (matching by SKU)...");
        $count = 0;

        // Get all items from main POS
        $posItems = DB::connection('pos')->table('items')->get();
        $this->info("Found {$posItems->count()} items in main POS");

        foreach ($posItems as $posItem) {
            // Check if item already exists in bodega by SKU
            $existingItem = Item::where('sku', $posItem->sku)->first();
            
            if ($existingItem) {
                // Update existing item
                $existingItem->update([
                    'name' => $posItem->name,
                    'category_id' => $this->getOrCreateCategoryId($posItem->category_id),
                    'price' => $posItem->price,
                    'cost' => $posItem->cost,
                    'stock_qty' => $posItem->stock_qty,
                    'is_service' => $posItem->is_service,
                ]);
                $this->info("✅ Matched item by SKU: {$posItem->sku} | Updated bodega item");
            } else {
                // Create new item
                Item::create([
                    'category_id' => $this->getOrCreateCategoryId($posItem->category_id),
                    'name' => $posItem->name,
                    'sku' => $posItem->sku,
                    'price' => $posItem->price,
                    'cost' => $posItem->cost,
                    'stock_qty' => $posItem->stock_qty,
                    'is_service' => $posItem->is_service,
                ]);
                $this->info("🆕 SKU: {$posItem->sku} | Created new item in bodega: {$posItem->name}");
            }
            $count++;
        }

        $this->info("Synced {$count} items TO bodega!");
    }

    private function syncFromBodega(): void
    {
        $this->info("Syncing FROM bodega TO main POS (matching by SKU)...");
        $count = 0;

        // Get all items from bodega
        $bodegaItems = Item::all();
        $this->info("Found {$bodegaItems->count()} items in bodega");

        foreach ($bodegaItems as $bodegaItem) {
            // Check if item already exists in main POS by SKU
            $existingItem = DB::connection('pos')->table('items')->where('sku', $bodegaItem->sku)->first();
            
            if ($existingItem) {
                // Update existing item in main POS
                DB::connection('pos')->table('items')->where('id', $existingItem->id)->update([
                    'name' => $bodegaItem->name,
                    'category_id' => $this->getOrCreateCategoryIdInPos($bodegaItem->category_id),
                    'price' => $bodegaItem->price,
                    'cost' => $bodegaItem->cost,
                    'stock_qty' => $bodegaItem->stock_qty,
                    'is_service' => $bodegaItem->is_service,
                    'updated_at' => now(),
                ]);
                $this->info("✅ Matched item by SKU: {$bodegaItem->sku} | Updated main POS item");
            } else {
                // Create new item in main POS
                DB::connection('pos')->table('items')->insert([
                    'category_id' => $this->getOrCreateCategoryIdInPos($bodegaItem->category_id),
                    'name' => $bodegaItem->name,
                    'sku' => $bodegaItem->sku,
                    'price' => $bodegaItem->price,
                    'cost' => $bodegaItem->cost,
                    'stock_qty' => $bodegaItem->stock_qty,
                    'is_service' => $bodegaItem->is_service,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $this->info("🆕 SKU: {$bodegaItem->sku} | Created new item in main POS: {$bodegaItem->name}");
            }
            $count++;
        }

        $this->info("Synced {$count} items FROM bodega!");
    }

    private function getOrCreateCategoryId(int $posCategoryId): int
    {
        // Get category from main POS
        $posCategory = DB::connection('pos')->table('categories')->find($posCategoryId);
        
        if (!$posCategory) {
            // If no category found, use first available
            return Category::first()->id;
        }

        // Find or create category in bodega
        $category = Category::firstOrCreate(
            ['name' => $posCategory->name],
            ['type' => $posCategory->type ?? 'product']
        );

        return $category->id;
    }

    private function getOrCreateCategoryIdInPos(int $bodegaCategoryId): int
    {
        // Get category from bodega
        $bodegaCategory = Category::find($bodegaCategoryId);
        
        if (!$bodegaCategory) {
            // If no category found, use first available in POS
            return DB::connection('pos')->table('categories')->value('id');
        }

        // Find or create category in main POS
        $posCategory = DB::connection('pos')->table('categories')->where('name', $bodegaCategory->name)->first();
        
        if (!$posCategory) {
            return DB::connection('pos')->table('categories')->insertGetId([
                'name' => $bodegaCategory->name,
                'type' => $bodegaCategory->type,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $posCategory->id;
    }
}
