<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['inventory_import_id', 'row_number', 'data', 'errors'])]
class InventoryImportFailure extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'errors' => 'array',
        ];
    }

    public function inventoryImport()
    {
        return $this->belongsTo(InventoryImport::class);
    }
}
