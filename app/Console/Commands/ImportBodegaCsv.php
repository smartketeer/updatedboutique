<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ImportBodegaCsv extends Command
{
    protected $signature = 'import:bodega-csv {file}';
    
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $file = $this->argument('file');
        if (!file_exists($file)) {
            $this->error("File not found: {$file}");
            return;
        }

        $lines = file($file);
        $countNew = 0;
        $countUpdated = 0;

        foreach ($lines as $index => $line) {
            if ($index === 0) continue; // Skip header

            $parts = explode(',', $line);
            if (count($parts) < 2) continue;

            $name = trim($parts[0]);
            $qtyString = trim($parts[1]);

            if (empty($name)) continue;

            // Extract numeric part from qtyString (e.g. "9 pcs" -> 9)
            preg_match('/^(\d+)/', $qtyString, $matches);
            $qty = isset($matches[1]) ? (int)$matches[1] : 0;

            $existing = DB::table('bodega_items')->whereRaw('LOWER(bdg_name) = ?', [strtolower($name)])->first();

            if ($existing) {
                DB::table('bodega_items')->where('bdg_id', $existing->bdg_id)->increment('bdg_stock_qty', $qty);
                $countUpdated++;
            } else {
                DB::table('bodega_items')->insert([
                    'bdg_name' => $name,
                    'bdg_stock_qty' => $qty,
                    'bdg_sku' => 'BDG-' . strtoupper(Str::random(6)),
                    'bdg_price' => 0,
                    'bdg_cost' => 0,
                    'bdg_is_service' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $countNew++;
            }
        }

        $this->info("Successfully imported! New items: {$countNew}. Updated items: {$countUpdated}.");
    }
}
