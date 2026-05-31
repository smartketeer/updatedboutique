<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'id',
    'cashier_id',
    'request_id',
    'secret_hash',
    'expires_at',
    'revoked_at',
    'ip_address',
    'user_agent',
])]
class InventoryAccessSession extends Model
{
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function request()
    {
        return $this->belongsTo(InventoryAccessRequest::class, 'request_id');
    }
}
