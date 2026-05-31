<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\BranchItemStock;
use App\Models\Category;
use App\Models\InventoryImport;
use App\Models\InventoryImportFailure;
use App\Models\Item;
use App\Models\StockLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ProcessInventoryImport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $inventoryImportId) {}

    public function handle(): void
    {
        $import = InventoryImport::query()->findOrFail($this->inventoryImportId);
        if (! in_array($import->status, ['queued', 'processing'], true)) {
            return;
        }
        $import->update(['status' => 'processing']);

        @set_time_limit(0);
        $start = microtime(true);

        $storedPath = (string) ($import->stored_path ?? '');
        if (trim($storedPath) === '') {
            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => ['Stored file path is empty. Please re-upload the file.']],
            ]);

            return;
        }

        $fullPath = Storage::path($storedPath);
        if (! is_string($fullPath) || trim($fullPath) === '' || ! file_exists($fullPath)) {
            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => ['Uploaded file is missing on the server. Please re-upload.']],
            ]);

            return;
        }

        $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
        if ($ext === 'xlsx') {
            $magic = @file_get_contents($fullPath, false, null, 0, 2);
            if ($magic !== 'PK') {
                $import->update([
                    'status' => 'failed',
                    'finished_at' => now(),
                    'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                    'summary' => ['header_errors' => ['This file is not a valid .xlsx (Excel Workbook). Please Save As → Excel Workbook (.xlsx) or export as CSV and try again.']],
                ]);

                return;
            }
        }

        try {
            [$columnMap, $headerErrors, $headerRowNumber] = $this->mapColumns($fullPath);
            $dataStartRowNumber = $this->detectDataStartRowNumber($fullPath, $columnMap, $headerRowNumber);
        } catch (\Throwable $e) {
            $message = 'Failed to read the Excel file.';
            $raw = trim($e->getMessage());
            if ($raw !== '') {
                if (str_contains($raw, 'ZipArchive') || str_contains(strtolower($raw), 'zip')) {
                    $message = 'Failed to read the Excel file (ZIP support is missing or not working).';
                } elseif (str_contains(strtolower($raw), 'xmlreader')) {
                    $message = 'Failed to read the Excel file (XMLReader support is missing or not working).';
                }
            }
            if (app()->environment(['local', 'testing']) && $raw !== '') {
                $message .= ' '.$raw;
            }
            $message .= ' If this keeps happening, try exporting the sheet as CSV and upload the CSV instead.';

            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => [$message]],
            ]);

            return;
        }

        if ($headerErrors) {
            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => $headerErrors],
            ]);

            return;
        }

        $branches = Branch::query()->pluck('id')->all();
        $branchIdSet = array_fill_keys($branches, true);
        $defaultBranchId = $import->branch_id ?: Branch::query()->orderByDesc('is_active')->orderBy('id')->value('id');
        if (! $defaultBranchId) {
            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => ['No branches found.']],
            ]);

            return;
        }

        $categoryId = Category::query()->where('type', 'inventory')->value('id') ?: Category::query()->value('id');
        if (! $categoryId) {
            $categoryId = Category::create(['name' => 'Inventory', 'type' => 'inventory'])->id;
        }

        $stockHasCost = Schema::hasColumn('branch_item_stocks', 'cost');
        $stockHasLocation = Schema::hasColumn('branch_item_stocks', 'location');
        $stockHasLastRestockDate = Schema::hasColumn('branch_item_stocks', 'last_restock_date');
        $stockHasTotalSold = Schema::hasColumn('branch_item_stocks', 'total_sold');

        $totalRows = 0;
        $criticalErrorRows = 0;
        $validatedRows = 0;

        $seen = [];
        $perSkuInfo = [];
        $validSkuOriginalByLower = [];
        $validNameOriginalByLower = [];

        $import->failures()->delete();

        try {
            $reader = new \SpreadsheetReader($fullPath);
            $reader->ChangeSheet(0);
        } catch (\Throwable $e) {
            $message = 'Failed to open the Excel file.';
            $raw = trim($e->getMessage());
            if ($raw !== '') {
                if (str_contains($raw, 'ZipArchive') || str_contains(strtolower($raw), 'zip')) {
                    $message = 'Failed to open the Excel file (ZIP support is missing or not working).';
                } elseif (str_contains(strtolower($raw), 'xmlreader')) {
                    $message = 'Failed to open the Excel file (XMLReader support is missing or not working).';
                }
            }
            if (app()->environment(['local', 'testing']) && $raw !== '') {
                $message .= ' '.$raw;
            }

            $import->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                'summary' => ['header_errors' => [$message]],
            ]);

            return;
        }

        $rowNumber = 0;
        foreach ($reader as $row) {
            $rowNumber++;
            if ($rowNumber < $dataStartRowNumber) {
                continue;
            }

            if (! array_filter($row)) {
                continue;
            }

            $totalRows++;

            $data = $this->extractRow($row, $columnMap);
            $errors = $this->validateRow($data, $seen, $branchIdSet, $import);

            $skuKey = strtolower($data['sku']);
            $nameKey = strtolower($data['product_name']);

            if (! $errors && $data['sku'] !== '') {
                $priceProvided = $data['price'] !== null && trim((string) $data['price']) !== '';
                $nameProvided = $data['product_name'] !== '';

                $price = (float) str_replace(['₱', ',', ' '], '', (string) $data['price']);
                $name = (string) $data['product_name'];

                if (! isset($perSkuInfo[$skuKey])) {
                    $perSkuInfo[$skuKey] = [
                        'sku' => $data['sku'],
                        'product_name' => $name,
                        'price' => $price,
                        'name_provided' => $nameProvided,
                        'price_provided' => $priceProvided,
                    ];
                } else {
                    if ($nameProvided && ! $perSkuInfo[$skuKey]['name_provided']) {
                        $perSkuInfo[$skuKey]['product_name'] = $name;
                        $perSkuInfo[$skuKey]['name_provided'] = true;
                    }
                    if ($priceProvided && ! $perSkuInfo[$skuKey]['price_provided']) {
                        $perSkuInfo[$skuKey]['price'] = $price;
                        $perSkuInfo[$skuKey]['price_provided'] = true;
                    }
                }
            }

            $validatedRows++;

            if ($errors) {
                $criticalErrorRows++;
                InventoryImportFailure::create([
                    'inventory_import_id' => $import->id,
                    'row_number' => $rowNumber,
                    'data' => $data,
                    'errors' => $errors,
                ]);
            } else {
                if ($data['sku'] !== '') {
                    $validSkuOriginalByLower[$skuKey] = $data['sku'];
                } elseif ($nameKey !== '') {
                    $validNameOriginalByLower[$nameKey] = $data['product_name'];
                }
            }

            if ($validatedRows % 200 === 0) {
                $import->update([
                    'total_rows' => $totalRows,
                    'validated_rows' => $validatedRows,
                    'critical_error_rows' => $criticalErrorRows,
                    'failed_rows' => $criticalErrorRows,
                ]);
            }
        }

        $errorRate = $totalRows > 0 ? ($criticalErrorRows / $totalRows) : 0;

        $import->update([
            'total_rows' => $totalRows,
            'validated_rows' => $validatedRows,
            'critical_error_rows' => $criticalErrorRows,
            'failed_rows' => $criticalErrorRows,
            'summary' => [
                'error_rate' => round($errorRate, 4),
            ],
        ]);

        if ($totalRows > 0 && $errorRate > 0.05) {
            $import->update([
                'status' => 'failed', // Changed from rolled_back to failed for clarity if we stop here
                'finished_at' => now(),
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
            ]);

            return;
        }

        $successRows = 0;
        $failedRows = 0;
        $itemsByKey = [];
        if ($validSkuOriginalByLower) {
            $skuItems = Item::query()
                ->whereIn('sku', array_values($validSkuOriginalByLower))
                ->get();
            foreach ($skuItems as $item) {
                $itemsByKey['sku:'.strtolower((string) $item->sku)] = $item;
            }
        }
        if ($validNameOriginalByLower) {
            $nameItems = Item::query()
                ->whereIn(DB::raw('LOWER(name)'), array_keys($validNameOriginalByLower))
                ->get();
            foreach ($nameItems as $item) {
                $itemsByKey['name:'.strtolower((string) $item->name)] = $item;
            }
        }
        $updatedSku = [];

        $reader2 = new \SpreadsheetReader($fullPath);
        $reader2->ChangeSheet(0);

        DB::transaction(function () use ($import, $reader2, $columnMap, $branchIdSet, &$itemsByKey, $perSkuInfo, &$successRows, &$failedRows, &$updatedSku, $start, $dataStartRowNumber, $defaultBranchId, $categoryId, $stockHasCost, $stockHasLocation, $stockHasLastRestockDate, $stockHasTotalSold) {
            $rowNumber = 0;
            $seen = [];
            $parseMoney = function ($value): float {
                $str = trim((string) $value);
                if ($str === '') {
                    return 0.0;
                }
                $clean = str_replace(['₱', ',', ' '], '', $str);
                return is_numeric($clean) ? (float) $clean : 0.0;
            };

            foreach ($reader2 as $row) {
                $rowNumber++;
                if ($rowNumber < $dataStartRowNumber) {
                    continue;
                }

                if (! array_filter($row)) {
                    continue;
                }

                $data = $this->extractRow($row, $columnMap);
                $this->validateRow($data, $seen, $branchIdSet, $import);

                $sku = $data['sku'] !== '' ? $data['sku'] : null;
                $skuKey = strtolower($data['sku']);

                $rawName = $data['product_name'];
                if (! $sku && $rawName === '') {
                    continue;
                }
                $productName = $rawName !== '' ? $rawName : 'Imported Item '.$import->id.' Row '.$rowNumber;

                $branchIdRaw = $data['shop_id'] ?? $defaultBranchId;
                $branchId = (int) $branchIdRaw;
                if (! isset($branchIdSet[$branchId])) {
                    $branchId = (int) $defaultBranchId;
                }

                $qtyStr = trim((string) $data['quantity']);
                $qty = preg_match('/^\d+$/', $qtyStr) ? (int) $qtyStr : 0;

                $priceProvided = $data['price'] !== null && trim((string) $data['price']) !== '';
                $price = $priceProvided ? $parseMoney($data['price']) : 0.0;

                $costProvided = $data['cost'] !== null && trim((string) $data['cost']) !== '';
                $cost = $costProvided ? $parseMoney($data['cost']) : null;

                $itemKey = $sku ? 'sku:'.$skuKey : 'name:'.strtolower($productName);
                $item = $itemsByKey[$itemKey] ?? null;
                if (! $item) {
                    $item = $sku
                        ? Item::query()->where('sku', $sku)->first()
                        : Item::query()->whereRaw('LOWER(name) = ?', [strtolower($productName)])->first();
                }
                if (! $item) {
                    $item = Item::create([
                        'category_id' => $categoryId,
                        'name' => $productName,
                        'sku' => $sku,
                        'price' => $price,
                        'cost' => $cost ?? 0,
                        'stock_qty' => 0,
                        'is_service' => false,
                    ]);
                }
                $itemsByKey[$itemKey] = $item;

                if ($sku && ! isset($updatedSku[$skuKey])) {
                    $update = $perSkuInfo[$skuKey] ?? null;
                    if ($update) {
                        $before = [
                            'name' => $item->name,
                            'price' => $item->price,
                        ];
                        $dirty = false;
                        if (($update['name_provided'] ?? false) && $update['product_name'] !== '' && $item->name !== $update['product_name']) {
                            $item->name = $update['product_name'];
                            $dirty = true;
                        }
                        if (($update['price_provided'] ?? false) && (float) $item->price !== (float) $update['price']) {
                            $item->price = (float) $update['price'];
                            $dirty = true;
                        }
                        if ($dirty) {
                            $item->save();

                            ActivityLog::create([
                                'actor_user_id' => $import->user_id,
                                'event_type' => 'inventory_item_updated',
                                'description' => 'Updated an inventory item via import.',
                                'metadata' => [
                                    'item_id' => $item->id,
                                    'branch_id' => null,
                                    'before' => $before,
                                    'after' => [
                                        'name' => $item->name,
                                        'price' => $item->price,
                                    ],
                                    'source' => 'inventory_import',
                                    'inventory_import_id' => $import->id,
                                ],
                            ]);
                        }
                    }
                    $updatedSku[$skuKey] = true;
                }

                $restockDate = null;
                if ($data['restock_date']) {
                    $ts = strtotime((string) $data['restock_date']);
                    if ($ts !== false) {
                        $restockDate = date('Y-m-d', $ts);
                    }
                }

                $stockUpdate = [
                    'quantity' => $qty,
                ];
                if ($stockHasCost) {
                    $stockUpdate['cost'] = $cost;
                }
                if ($stockHasLocation) {
                    $stockUpdate['location'] = $data['location'] !== null && trim((string) $data['location']) !== '' ? (string) $data['location'] : null;
                }
                if ($stockHasLastRestockDate) {
                    $stockUpdate['last_restock_date'] = $restockDate;
                }
                if ($stockHasTotalSold) {
                    $stockUpdate['total_sold'] = (int) ($data['total_sold'] ?? 0);
                }

                $existingStock = BranchItemStock::query()
                    ->where('branch_id', $branchId)
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first();

                $oldQty = $existingStock ? (int) $existingStock->quantity : 0;
                if ($existingStock) {
                    $existingStock->update($stockUpdate);
                    $stock = $existingStock;
                } else {
                    $stock = BranchItemStock::query()->create([
                        'branch_id' => $branchId,
                        'item_id' => $item->id,
                        ...$stockUpdate,
                    ]);
                }

                $delta = $qty - $oldQty;
                if ($delta !== 0 && ! $item->is_service) {
                    StockLog::create([
                        'item_id' => $item->id,
                        'branch_id' => $branchId,
                        'actor_user_id' => $import->user_id,
                        'change_qty' => $delta,
                        'new_qty' => $qty,
                        'reason' => 'import',
                        'reference' => 'import:'.$import->id,
                        'meta' => [
                            'inventory_import_id' => $import->id,
                            'row_number' => $rowNumber,
                        ],
                    ]);
                }

                ActivityLog::create([
                    'actor_user_id' => $import->user_id,
                    'event_type' => 'inventory_import_row_processed',
                    'description' => "Processed row for item: {$item->name} (SKU: {$item->sku}) in branch ID: {$branchId}",
                    'metadata' => [
                        'inventory_import_id' => $import->id,
                        'branch_id' => $branchId,
                        'item_id' => $item->id,
                        'sku' => $item->sku,
                        'quantity' => $qty,
                        'cost' => $cost,
                        'location' => $data['location'],
                        'was_created' => $stock->wasRecentlyCreated,
                    ],
                ]);

                if ($stock->wasRecentlyCreated) {
                    ActivityLog::create([
                        'actor_user_id' => $import->user_id,
                        'event_type' => 'inventory_item_added_to_branch',
                        'description' => 'Added an inventory item to a branch via import.',
                        'metadata' => [
                            'branch_id' => $branchId,
                            'item_id' => $item->id,
                            'sku' => $item->sku,
                            'name' => $item->name,
                            'added_qty' => $qty,
                            'new_branch_qty' => $qty,
                            'source' => 'inventory_import',
                            'inventory_import_id' => $import->id,
                        ],
                    ]);
                }

                $successRows++;

                if (($successRows + $failedRows) % 200 === 0) {
                    $import->update([
                        'success_rows' => $successRows,
                        'failed_rows' => $failedRows,
                        'status' => 'processing',
                        'duration_ms' => (int) round((microtime(true) - $start) * 1000),
                    ]);
                }
            }

            $this->syncItemTotals();
        });

        $import->update([
            'success_rows' => $successRows,
            'failed_rows' => $failedRows,
            'status' => 'completed',
            'finished_at' => now(),
            'duration_ms' => (int) round((microtime(true) - $start) * 1000),
            'summary' => array_merge($import->summary ?? [], [
                'processed_rows' => $successRows + $failedRows,
            ]),
        ]);

        ActivityLog::create([
            'actor_user_id' => $import->user_id,
            'event_type' => 'inventory_import_completed',
            'description' => "Inventory import completed: {$successRows} succeeded, {$failedRows} failed.",
            'metadata' => [
                'inventory_import_id' => $import->id,
                'success_rows' => $successRows,
                'failed_rows' => $failedRows,
                'total_rows' => $totalRows,
                'duration_ms' => (int) round((microtime(true) - $start) * 1000),
            ],
        ]);
    }

    private function syncItemTotals(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('UPDATE items SET stock_qty = (SELECT SUM(quantity) FROM branch_item_stocks WHERE branch_item_stocks.item_id = items.id)');
        } else {
            DB::statement('UPDATE items i JOIN (SELECT item_id, SUM(quantity) AS total_qty FROM branch_item_stocks GROUP BY item_id) t ON i.id = t.item_id SET i.stock_qty = t.total_qty');
        }
    }

    private function mapColumns(string $fullPath): array
    {
        $reader = new \SpreadsheetReader($fullPath);
        $reader->ChangeSheet(0);

        $required = [
            'sku' => ['sku', 'itemcode', 'productcode'],
            'product_name' => ['productname', 'product', 'product_name', 'name', 'producttitle', 'description'],
            'quantity' => ['quantity', 'qty', 'stock', 'stockqty', 'stock_qty', 'stocks'],
            'price' => ['price', 'unitprice', 'unit_price', 'priceperproduct', 'sellingprice', 'salesprice', 'retailprice', 'priceperitem'],
            'cost' => ['cost', 'unitcost', 'unit_cost', 'capitalprice'],
            'shop_id' => ['shopid', 'shop_id', 'branchid', 'branch_id', 'storeid', 'store_id'],
            'location' => ['location', 'shelf', 'area'],
            'restock_date' => ['date', 'restockdate', 'lastrestock'],
            'total_sold' => ['sold', 'totalsold', 'numberofsales'],
        ];

        $maxScanRows = 100;
        $best = [
            'row_number' => 1,
            'score' => -1,
            'map' => [],
            'missing' => ['product_name'],
        ];

        $rowNumber = 0;
        foreach ($reader as $row) {
            $rowNumber++;
            if ($rowNumber > $maxScanRows) {
                break;
            }

            $header = is_array($row) ? $row : [];
            $normalizedToIndex = [];
            foreach ($header as $idx => $value) {
                $key = $this->normalizeHeader((string) $value);
                if ($key !== '') {
                    $normalizedToIndex[$key] = $idx;
                }
            }

            $map = [];
            $score = 0;
            foreach ($required as $field => $aliases) {
                $found = null;
                foreach ($aliases as $alias) {
                    $aliasNorm = $this->normalizeHeader($alias);
                    if (array_key_exists($aliasNorm, $normalizedToIndex)) {
                        $found = $normalizedToIndex[$aliasNorm];
                        break;
                    }
                }

                if ($found !== null) {
                    $map[$field] = $found;
                    $score++;
                }
            }

            $missing = [];
            if (! array_key_exists('product_name', $map) && ! array_key_exists('sku', $map)) {
                $missing[] = 'product_name';
            }

            if ($score > $best['score']) {
                $best = [
                    'row_number' => $rowNumber,
                    'score' => $score,
                    'map' => $map,
                    'missing' => $missing,
                ];
            }

            if (! $missing) {
                return [$map, [], $rowNumber];
            }
        }

        $errors = [];
        if ($best['missing']) {
            if ($best['missing'] === ['product_name']) {
                $errors[] = 'Missing required columns: product_name (or sku).';
            } else {
                $errors[] = 'Missing required columns: '.implode(', ', $best['missing']).'.';
            }
        }

        return [$best['map'], $errors, (int) $best['row_number']];
    }

    private function detectDataStartRowNumber(string $fullPath, array $columnMap, int $headerRowNumber): int
    {
        $reader = new \SpreadsheetReader($fullPath);
        $reader->ChangeSheet(0);

        $rowNumber = 0;
        $maxScanRows = max(80, $headerRowNumber + 40);
        foreach ($reader as $row) {
            $rowNumber++;
            if ($rowNumber <= $headerRowNumber) {
                continue;
            }
            if ($rowNumber > $maxScanRows) {
                break;
            }
            if (! is_array($row) || ! array_filter($row)) {
                continue;
            }

            $data = $this->extractRow($row, $columnMap);

            $name = trim((string) ($data['product_name'] ?? ''));
            $nameLower = strtolower($name);
            $sku = trim((string) ($data['sku'] ?? ''));
            if ($sku === '' && $name === '') {
                continue;
            }
            if (in_array($nameLower, ['address', 'city, state, zip', 'phone'], true)) {
                continue;
            }
            if (str_contains($nameLower, 'total') || str_contains($nameLower, 'estimated') || str_contains($nameLower, 'number of')) {
                continue;
            }

            if ($name === '' && $sku !== '') {
                $signals = [
                    $data['price'] ?? null,
                    $data['quantity'] ?? null,
                    $data['cost'] ?? null,
                ];
                $hasSignal = false;
                foreach ($signals as $v) {
                    if ($v !== null && trim((string) $v) !== '') {
                        $hasSignal = true;
                        break;
                    }
                }
                if (! $hasSignal) {
                    continue;
                }
            }

            return $rowNumber;
        }

        return max($headerRowNumber + 1, 1);
    }

    private function extractRow(array $row, array $columnMap): array
    {
        $get = function (string $field) use ($row, $columnMap) {
            $idx = $columnMap[$field] ?? null;
            if ($idx === null) {
                return null;
            }

            return $row[$idx] ?? null;
        };

        return [
            'sku' => trim((string) ($get('sku') ?? '')),
            'product_name' => trim((string) ($get('product_name') ?? '')),
            'quantity' => $get('quantity'),
            'price' => $get('price'),
            'cost' => $get('cost'),
            'shop_id' => $get('shop_id'),
            'location' => $get('location'),
            'restock_date' => $get('restock_date'),
            'total_sold' => $get('total_sold'),
        ];
    }

    private function validateRow(array $data, array &$seen, array $branchIdSet, InventoryImport $import): array
    {
        return [];
    }

    private function normalizeHeader(string $value): string
    {
        $value = strtolower(trim($value));

        return preg_replace('/[^a-z0-9]/', '', $value) ?? '';
    }
}
