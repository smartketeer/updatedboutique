<?php

namespace Tests\Feature;

use App\Jobs\ProcessInventoryImport;
use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\BranchItemStock;
use App\Models\InventoryImport;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class InventoryImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_import_processes_data_correctly()
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $branch = Branch::create([
            'name' => 'Test Branch',
            'is_active' => true,
        ]);

        $category = \App\Models\Category::create(['name' => 'Test Category', 'type' => 'inventory']);

        $item = Item::create([
            'category_id' => $category->id,
            'name' => 'Existing Product',
            'sku' => 'SKU123',
            'price' => 100,
            'stock_qty' => 0,
        ]);

        // We'll simulate a file. SpreadsheetReader needs a real file on disk.
        // For simplicity in this environment, we might not be able to easily create a valid XLS/XLSX
        // but we can check if the job logic handles the database correctly if we mock the reader
        // OR we can create a CSV since SpreadsheetReader supports it.
        
        $csvContent = "sku,product_name,quantity,price,cost,shop_id,location,restock_date,total_sold,Header 10\n";
        for ($i = 2; $i <= 10; $i++) {
            $csvContent .= "Row $i,,,,,,,,,\n";
        }
        $csvContent .= "SKU123,Existing Product,50,₱150,₱80,{$branch->id},A1,2026-04-28,10\n";

        $file = UploadedFile::fake()->createWithContent('inventory.csv', $csvContent);
        $path = $file->store('imports/inventory');

        $import = InventoryImport::create([
            'user_id' => $user->id,
            'branch_id' => $branch->id,
            'original_filename' => 'inventory.csv',
            'stored_path' => $path,
            'file_size' => 1024,
            'status' => 'queued',
            'started_at' => now(),
        ]);

        // Manually trigger the job
        $job = new ProcessInventoryImport($import->id);
        $job->handle();

        $import->refresh();

        $this->assertEquals('completed', $import->status);
        $this->assertEquals(1, $import->success_rows);

        $stock = BranchItemStock::where('branch_id', $branch->id)
            ->where('item_id', $item->id)
            ->first();

        $this->assertNotNull($stock);
        $this->assertEquals(50, $stock->quantity);
        $this->assertEquals(80, $stock->cost);
        $this->assertEquals('A1', $stock->location);
        $this->assertEquals('2026-04-28', $stock->last_restock_date);
        $this->assertEquals(10, $stock->total_sold);

        // Check ActivityLog
        $this->assertTrue(ActivityLog::where('event_type', 'inventory_import_completed')->exists());
        $this->assertTrue(ActivityLog::where('event_type', 'inventory_import_row_processed')->exists());
    }

    public function test_inventory_import_handles_errors_correctly()
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $branch = Branch::create(['name' => 'Test Branch', 'is_active' => true]);
        
        // Invalid data: missing product name, invalid price, invalid shop ID
        $csvContent = "sku,product_name,quantity,price,cost,shop_id,location,restock_date,total_sold\n";
        for ($i = 2; $i <= 10; $i++) $csvContent .= "Row $i,,,,,,,,\n";
        $csvContent .= "SKU123,,invalid,₱abc,₱80,999,A1,2026-04-28,10\n";

        $file = UploadedFile::fake()->createWithContent('inventory_errors.csv', $csvContent);
        $path = $file->store('imports/inventory');

        $import = InventoryImport::create([
            'user_id' => $user->id,
            'branch_id' => $branch->id,
            'original_filename' => 'inventory_errors.csv',
            'stored_path' => $path,
            'file_size' => 1024,
            'status' => 'queued',
            'started_at' => now(),
        ]);

        $job = new ProcessInventoryImport($import->id);
        $job->handle();

        $import->refresh();

        $this->assertEquals('completed', $import->status);
        $this->assertEquals(0, $import->critical_error_rows);
        $this->assertEquals(1, $import->success_rows);

        $this->assertTrue(Item::where('sku', 'SKU123')->exists());
        $item = Item::where('sku', 'SKU123')->first();
        $this->assertNotNull($item);

        $stock = BranchItemStock::where('branch_id', $branch->id)
            ->where('item_id', $item->id)
            ->first();
        $this->assertNotNull($stock);
        $this->assertEquals(0, $stock->quantity);
        $this->assertEquals(80, $stock->cost);
        $this->assertEquals('A1', $stock->location);
        $this->assertEquals('2026-04-28', $stock->last_restock_date);
        $this->assertEquals(10, $stock->total_sold);
    }
}
