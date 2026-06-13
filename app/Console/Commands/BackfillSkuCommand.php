<?php

namespace App\Console\Commands;

use App\Models\Item;
use App\Models\SkuAuditLog;
use App\Services\SkuGenerator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackfillSkuCommand extends Command
{
    protected $signature = 'sku:backfill';
    protected $description = 'Backfill SKUs for items that don\'t have one';

    public function handle(): int
    {
        $this->info('Starting SKU backfill...');

        $itemsWithoutSku = Item::whereNull('sku')->get();
        $this->info('Found ' . $itemsWithoutSku->count() . ' items without SKU.');

        $count = 0;
        DB::transaction(function () use ($itemsWithoutSku, &$count) {
            foreach ($itemsWithoutSku as $item) {
                $sku = SkuGenerator::generate($item);
                $item->update(['sku' => $sku]);
                
                if (Schema::hasTable('sku_audit_logs')) {
                    SkuAuditLog::create([
                        'item_id' => $item->id,
                        'sku' => $sku,
                        'action' => 'backfilled',
                        'user_id' => null,
                        'metadata' => [
                            'category_id' => $item->category_id,
                            'name' => $item->name,
                        ],
                    ]);
                }
                
                $count++;
            }
        });

        $this->info("Successfully backfilled {$count} SKUs!");

        return Command::SUCCESS;
    }
}
