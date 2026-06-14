<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Category;
use Illuminate\Support\Facades\DB;

class SkuGenerator
{
    const MAX_ATTEMPTS = 100;

    // Category name to code mapping
    private static $categoryCodeMap = [
        'Beauty & Personal Care' => 'BTY',
        'School & Office Supplies' => 'SCH',
        'Apparel & Fashion' => 'APP',
        'Footwear' => 'FTW',
    ];

    public static function generate(Item $item): string
    {
        $attempt = 0;
        do {
            $sku = self::buildSku($item, $attempt);
            $exists = self::skuExists($sku);
            $attempt++;
        } while ($exists && $attempt < self::MAX_ATTEMPTS);

        if ($exists) {
            throw new \RuntimeException('Failed to generate a unique SKU after ' . self::MAX_ATTEMPTS . ' attempts.');
        }

        return $sku;
    }

    private static function skuExists(string $sku): bool
    {
        // Check bodega database
        $existsInBodega = Item::where('sku', $sku)->exists();
        
        // Check main POS database (gracefully skip if connection fails)
        $existsInPos = false;
        try {
            $existsInPos = DB::connection('pos')->table('items')->where('sku', $sku)->exists();
        } catch (\Exception $e) {
            // POS database connection unavailable — skip cross-check
        }

        return $existsInBodega || $existsInPos;
    }

    private static function buildSku(Item $item, int $attempt = 0): string
    {
        $category = Category::find($item->category_id);
        
        // Get category code
        $categoryCode = 'GEN';
        if ($category) {
            $categoryName = trim($category->name);
            if (isset(self::$categoryCodeMap[$categoryName])) {
                $categoryCode = self::$categoryCodeMap[$categoryName];
            } else {
                // Fallback: generate 3-letter code from category name
                $categoryCode = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $categoryName), 0, 3));
                $categoryCode = str_pad($categoryCode, 3, 'X', STR_PAD_RIGHT);
            }
        }

        // Generate item parts from name
        $nameParts = self::extractNameParts($item->name);
        $itemSlug = implode('-', $nameParts);

        // Get next 4-digit number
        $nextNumber = self::getNextSequenceNumber($categoryCode);
        if ($attempt > 0) {
            $nextNumber += $attempt;
        }
        $numberPart = str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

        // Build SKU
        $sku = "{$categoryCode}-{$itemSlug}-{$numberPart}";
        return strtoupper($sku);
    }

    private static function extractNameParts(string $name): array
    {
        // Remove special characters, split into words
        $cleanName = preg_replace('/[^A-Za-z0-9\s]/', '', $name);
        $words = preg_split('/\s+/', trim($cleanName));
        
        $parts = [];
        foreach ($words as $word) {
            if (empty($word)) continue;
            // Take first 3 letters of each word
            $parts[] = strtoupper(substr($word, 0, 3));
        }
        
        // Limit to 3 parts to keep SKU manageable
        return array_slice($parts, 0, 3);
    }

    private static function getNextSequenceNumber(string $categoryCode): int
    {
        // Collect all existing sequence numbers from BOTH databases for this category
        $existingNumbers = [];

        // From bodega database
        $bodegaNumbers = Item::where('sku', 'LIKE', "{$categoryCode}-%")
            ->pluck('sku')
            ->map(function ($sku) {
                $skuParts = explode('-', $sku);
                $lastPart = end($skuParts);
                if (preg_match('/^\d{4}$/', $lastPart)) {
                    return (int)$lastPart;
                }
                return null;
            })
            ->filter()
            ->flip()
            ->toArray();
        $existingNumbers = array_merge($existingNumbers, $bodegaNumbers);

        // From main POS database (gracefully skip if connection fails)
        try {
            $posNumbers = DB::connection('pos')->table('items')
                ->where('sku', 'LIKE', "{$categoryCode}-%")
                ->pluck('sku')
                ->map(function ($sku) {
                    $skuParts = explode('-', $sku);
                    $lastPart = end($skuParts);
                    if (preg_match('/^\d{4}$/', $lastPart)) {
                        return (int)$lastPart;
                    }
                    return null;
                })
                ->filter()
                ->flip()
                ->toArray();
            $existingNumbers = array_merge($existingNumbers, $posNumbers);
        } catch (\Exception $e) {
            // POS database connection unavailable — skip cross-check
        }

        // Generate random number between 1 and 9999 that's not in existingNumbers
        $maxAttempts = 1000;
        for ($i = 0; $i < $maxAttempts; $i++) {
            $randomNumber = random_int(1, 9999);
            if (!isset($existingNumbers[$randomNumber])) {
                return $randomNumber;
            }
        }

        // Fallback if all numbers are taken (unlikely)
        return random_int(1, 9999);
    }

    public static function validate(string $sku): bool
    {
        return preg_match('/^[A-Z0-9-]+$/', $sku) === 1;
    }
}
