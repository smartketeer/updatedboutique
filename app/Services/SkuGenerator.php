<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Category;
use Illuminate\Support\Facades\DB;

class SkuGenerator
{
    const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const SKU_LENGTH = 16;
    const MAX_ATTEMPTS = 100;

    public static function generate(Item $item): string
    {
        $attempt = 0;
        do {
            $sku = self::buildSku($item);
            $exists = Item::where('sku', $sku)->exists();
            $attempt++;
        } while ($exists && $attempt < self::MAX_ATTEMPTS);

        if ($exists) {
            throw new \RuntimeException('Failed to generate a unique SKU after ' . self::MAX_ATTEMPTS . ' attempts.');
        }

        return $sku;
    }

    private static function buildSku(Item $item): string
    {
        $category = Category::find($item->category_id);
        $categoryCode = $category ? strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $category->name), 0, 3)) : 'GEN';
        $categoryCode = str_pad($categoryCode, 3, 'X', STR_PAD_RIGHT);

        $timestamp = now()->format('YmdHis');
        $randomString = self::generateRandomString(4);

        $sku = "{$categoryCode}-{$timestamp}-{$randomString}";
        return strtoupper(substr($sku, 0, self::SKU_LENGTH));
    }

    private static function generateRandomString(int $length): string
    {
        $characters = self::ALLOWED_CHARS;
        $charactersLength = strlen($characters);
        $randomString = '';
        for ($i = 0; $i < $length; $i++) {
            $randomString .= $characters[rand(0, $charactersLength - 1)];
        }
        return $randomString;
    }

    public static function validate(string $sku): bool
    {
        return preg_match('/^[A-Z0-9-]+$/', $sku) === 1 && 
               strlen($sku) <= self::SKU_LENGTH && 
               !preg_match('/[O0Il]/', $sku);
    }
}
