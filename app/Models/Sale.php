<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['client_id', 'customer_type', 'staff_id', 'total_amount', 'tax', 'discount', 'payment_method', 'reference_number', 'status'])]
class Sale extends Model
{
    use HasFactory;

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function customItems()
    {
        return $this->hasMany(SaleCustomItem::class);
    }

    public function modifications()
    {
        return $this->hasMany(SaleModification::class);
    }
}
