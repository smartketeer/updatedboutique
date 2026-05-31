<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'branch_id',
    'original_filename',
    'stored_path',
    'file_size',
    'total_rows',
    'validated_rows',
    'success_rows',
    'failed_rows',
    'critical_error_rows',
    'status',
    'started_at',
    'finished_at',
    'duration_ms',
    'summary',
])]
class InventoryImport extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'summary' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function failures()
    {
        return $this->hasMany(InventoryImportFailure::class);
    }
}
