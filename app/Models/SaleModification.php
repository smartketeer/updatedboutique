<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'sale_id',
    'cashier_id',
    'admin_id',
    'type',
    'item_id',
    'label',
    'quantity',
    'unit_price_before',
    'unit_price_after',
    'subtotal_before',
    'subtotal_after',
    'reason',
    'approval_id',
    'approved_at',
    'metadata',
])]
class SaleModification extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
