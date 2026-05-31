<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['item_id', 'branch_id', 'actor_user_id', 'change_qty', 'new_qty', 'reason', 'reference', 'notes', 'meta'])]
class StockLog extends Model
{
    use HasFactory;

    protected $casts = [
        'meta' => 'array',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
