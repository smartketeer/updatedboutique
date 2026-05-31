<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'id',
    'cashier_id',
    'approved_by_admin_id',
    'purpose',
    'otp_encrypted',
    'otp_hash',
    'expires_at',
    'approved_at',
    'used_at',
    'revoked_at',
    'ip_address',
    'user_agent',
])]
class InventoryAccessRequest extends Model
{
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'approved_at' => 'datetime',
            'used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by_admin_id');
    }
}
