<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessInventoryImport;
use App\Models\Branch;
use App\Models\InventoryImport;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class InventoryImportController extends Controller
{
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|file|max:10240|mimes:xls,xlsx,csv,txt',
            'branch_id' => 'nullable|exists:branches,id',
        ]);

        $file = $validated['file'];
        Storage::makeDirectory('imports/inventory');
        $storedPath = $file->store('imports/inventory');
        if (! is_string($storedPath) || trim($storedPath) === '') {
            throw ValidationException::withMessages([
                'file' => ['Failed to store the uploaded file. Please try again.'],
            ]);
        }

        $import = InventoryImport::create([
            'user_id' => $request->user()->id,
            'branch_id' => $validated['branch_id'] ?? null,
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'file_size' => $file->getSize(),
            'status' => 'uploaded',
        ]);

        $fullPath = Storage::path($storedPath);
        if (! is_string($fullPath) || trim($fullPath) === '' || ! file_exists($fullPath)) {
            $import->update([
                'status' => 'failed',
                'summary' => [
                    'header_errors' => ['Uploaded file is missing on the server. Please re-upload.'],
                ],
            ]);

            throw ValidationException::withMessages([
                'file' => ['Uploaded file is missing on the server. Please re-upload.'],
            ]);
        }

        $ext = strtolower((string) $file->getClientOriginalExtension());
        if ($ext === 'xlsx') {
            $magic = @file_get_contents($fullPath, false, null, 0, 2);
            if ($magic !== 'PK') {
                $import->update([
                    'status' => 'failed',
                    'summary' => [
                        'header_errors' => ['This file is not a valid .xlsx (Excel Workbook). Please Save As → Excel Workbook (.xlsx) or export as CSV and try again.'],
                    ],
                ]);

                throw ValidationException::withMessages([
                    'file' => ['This file is not a valid .xlsx (Excel Workbook). Please Save As → Excel Workbook (.xlsx) or export as CSV and try again.'],
                ]);
            }
        }

        try {
            [$columnMap, $headerErrors, $headerRowNumber] = $this->mapColumns($fullPath);
            if ($headerErrors) {
                $import->update([
                    'status' => 'failed',
                    'summary' => [
                        'header_errors' => $headerErrors,
                    ],
                ]);

                throw ValidationException::withMessages([
                    'file' => $headerErrors,
                ]);
            }

            $dataStartRowNumber = $this->detectDataStartRowNumber($fullPath, $columnMap, $headerRowNumber);

            [$previewRows, $stats] = $this->buildPreviewAndStats($fullPath, $columnMap, $import, $dataStartRowNumber);
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
                'summary' => [
                    'header_errors' => [$message],
                ],
            ]);

            throw ValidationException::withMessages([
                'file' => [$message],
            ]);
        }

        $import->update([
            'status' => 'ready',
            'total_rows' => $stats['total_rows'],
            'failed_rows' => $stats['error_rows'],
            'critical_error_rows' => $stats['critical_error_rows'],
            'summary' => [
                'required_columns' => array_keys($columnMap),
                'error_rate' => $stats['total_rows'] > 0 ? round($stats['critical_error_rows'] / $stats['total_rows'], 4) : 0,
            ],
        ]);

        return response()->json([
            'import' => $import,
            'preview_rows' => $previewRows,
            'stats' => $stats,
        ]);
    }

    public function start(Request $request, InventoryImport $import)
    {
        if (! in_array($import->status, ['ready', 'failed', 'rolled_back', 'completed', 'queued'], true)) {
            return response()->json(['message' => 'Import already started.'], 409);
        }
        if ($import->status === 'queued' && ! app()->environment(['local', 'testing'])) {
            return response()->json(['import' => $import]);
        }

        $import->failures()->delete();

        $import->update([
            'status' => 'queued',
            'validated_rows' => 0,
            'success_rows' => 0,
            'failed_rows' => 0,
            'critical_error_rows' => 0,
            'started_at' => now(),
            'finished_at' => null,
            'duration_ms' => null,
            'summary' => null,
        ]);

        if (app()->environment(['local', 'testing'])) {
            ProcessInventoryImport::dispatchSync($import->id);
            $import->refresh();
        } else {
            ProcessInventoryImport::dispatch($import->id);
        }

        return response()->json(['import' => $import]);
    }

    public function show(Request $request, InventoryImport $import)
    {
        $failures = $import->failures()
            ->orderBy('row_number')
            ->limit(200)
            ->get(['row_number', 'data', 'errors']);

        return response()->json([
            'import' => $import,
            'failures' => $failures,
        ]);
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

    private function buildPreviewAndStats(string $fullPath, array $columnMap, InventoryImport $import, int $dataStartRowNumber): array
    {
        $branches = Branch::query()->pluck('id')->all();
        $branchIdSet = array_fill_keys($branches, true);
        $skus = Item::query()
            ->whereNotNull('sku')
            ->pluck('sku')
            ->map(fn ($s) => strtolower((string) $s))
            ->all();
        $skuSet = array_fill_keys($skus, true);

        $reader = new \SpreadsheetReader($fullPath);
        $reader->ChangeSheet(0);

        $rowNumber = 0;
        $dataRowNumber = 0;
        $previewRows = [];
        $seen = [];

        $totalRows = 0;
        $errorRows = 0;
        $criticalErrorRows = 0;

        foreach ($reader as $row) {
            $rowNumber++;
            if ($rowNumber < $dataStartRowNumber) {
                continue;
            }

            // Skip empty rows
            if (! array_filter($row)) {
                continue;
            }

            $dataRowNumber++;
            $totalRows++;

            $normalized = $this->extractRow($row, $columnMap);
            $errors = $this->validateRow($normalized, $seen, $branchIdSet, $import);
            if (! isset($errors['sku']) && $normalized['sku'] !== '') {
                if (! isset($skuSet[strtolower($normalized['sku'])])) {
                    $errors['sku'][] = 'SKU not found in database.';
                }
            }

            if ($errors) {
                $errorRows++;
                $criticalErrorRows++;
            }

            if (count($previewRows) < 50) {
                $previewRows[] = [
                    'row_number' => $rowNumber,
                    'data' => $normalized,
                    'errors' => $errors,
                ];
            }
        }

        return [
            $previewRows,
            [
                'total_rows' => $totalRows,
                'error_rows' => $errorRows,
                'critical_error_rows' => $criticalErrorRows,
            ],
        ];
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
