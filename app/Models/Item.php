<?php

namespace App\Models;

use App\Models\SkuAuditLog;
use App\Services\SkuGenerator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

#[Fillable(['category_id', 'name', 'sku', 'price', 'cost', 'stock_qty', 'is_service', 'primary_image_id'])]
class Item extends Model
{
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Item $item) {
            if (empty($item->sku) || SkuGenerator::skuExists($item->sku)) {
                $item->sku = SkuGenerator::generate($item);
            }
        });

        static::created(function (Item $item) {
            if (Schema::hasTable('sku_audit_logs')) {
                SkuAuditLog::create([
                    'item_id' => $item->id,
                    'sku' => $item->sku,
                    'action' => 'generated',
                    'user_id' => auth()->id() ?? null,
                    'metadata' => [
                        'category_id' => $item->category_id,
                        'name' => $item->name,
                    ],
                ]);
            }
        });

        static::updated(function (Item $item) {
            if (Schema::hasTable('sku_audit_logs') && $item->isDirty('sku')) {
                SkuAuditLog::create([
                    'item_id' => $item->id,
                    'sku' => $item->sku,
                    'action' => 'updated',
                    'user_id' => auth()->id() ?? null,
                    'metadata' => [
                        'old_sku' => $item->getOriginal('sku'),
                        'new_sku' => $item->sku,
                    ],
                ]);
            }
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function branchStocks()
    {
        return $this->hasMany(BranchItemStock::class);
    }

    public function productImages()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function primaryImage()
    {
        return $this->belongsTo(ProductImage::class, 'primary_image_id');
    }

    public function skuAuditLogs()
    {
        return $this->hasMany(SkuAuditLog::class);
    }
}
