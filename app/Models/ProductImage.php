<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class ProductImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'item_id',
        'path',
        'thumb_path',
        'mime',
        'width',
        'height',
        'size_bytes',
    ];

    protected $appends = [
        'url',
        'thumb_url',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function getUrlAttribute()
    {
        if (! $this->path) return null;
        return Storage::disk('public')->url($this->path);
    }

    public function getThumbUrlAttribute()
    {
        if (! $this->thumb_path) return null;
        return Storage::disk('public')->url($this->thumb_path);
    }
}

