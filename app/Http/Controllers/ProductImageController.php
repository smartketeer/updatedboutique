<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductImageController extends Controller
{
    public function index(Item $item)
    {
        $item->load('primaryImage');
        $images = $item->productImages()->latest()->get();

        return response()->json([
            'item' => $item,
            'images' => $images->map(fn ($img) => array_merge($img->toArray(), [
                'is_primary' => (int) $item->primary_image_id === (int) $img->id,
            ])),
        ]);
    }

    public function store(Request $request, Item $item)
    {
        $validated = $request->validate([
            'images' => 'required|array|min:1|max:10',
            'images.*' => 'required|file|mimes:jpeg,jpg,png,webp|max:5120',
            'thumbs' => 'nullable|array',
            'thumbs.*' => 'nullable|file|mimes:jpeg,jpg,png,webp|max:2048',
        ]);

        $files = $request->file('images') ?? [];
        $thumbs = $request->file('thumbs') ?? [];
        if (! $files) {
            throw ValidationException::withMessages(['images' => 'Please select at least one image.']);
        }

        if ($thumbs && count($thumbs) !== count($files)) {
            throw ValidationException::withMessages(['thumbs' => 'Thumbnail count must match image count.']);
        }

        $created = [];
        DB::transaction(function () use ($item, $files, $thumbs, &$created) {
            foreach ($files as $idx => $file) {
                $mime = (string) ($file->getMimeType() ?: '');
                $ext = match ($mime) {
                    'image/webp' => 'webp',
                    'image/png' => 'png',
                    default => 'jpg',
                };

                $id = (string) Str::uuid();
                $baseDir = 'product-images/'.$item->id;
                $path = $baseDir.'/'.$id.'.'.$ext;
                $thumbPath = $baseDir.'/'.$id.'.thumb.'.$ext;

                Storage::disk('public')->putFileAs($baseDir, $file, $id.'.'.$ext);

                $thumb = $thumbs[$idx] ?? null;
                if ($thumb) {
                    Storage::disk('public')->putFileAs($baseDir, $thumb, $id.'.thumb.'.$ext);
                } else {
                    $thumbPath = null;
                }

                $real = $file->getRealPath();
                $wh = $real ? @getimagesize($real) : null;
                $width = $wh && isset($wh[0]) ? (int) $wh[0] : null;
                $height = $wh && isset($wh[1]) ? (int) $wh[1] : null;

                $img = ProductImage::create([
                    'item_id' => $item->id,
                    'path' => $path,
                    'thumb_path' => $thumbPath,
                    'mime' => $mime ?: $ext,
                    'width' => $width,
                    'height' => $height,
                    'size_bytes' => (int) $file->getSize(),
                ]);

                $created[] = $img->id;
            }

            $item->refresh();
            if (! $item->primary_image_id && count($created) > 0) {
                $item->primary_image_id = $created[0];
                $item->save();
            }
        });

        return $this->index($item);
    }

    public function setPrimary(Item $item, ProductImage $image)
    {
        if ((int) $image->item_id !== (int) $item->id) {
            return response()->json(['message' => 'Image does not belong to this item.'], 422);
        }

        $item->primary_image_id = $image->id;
        $item->save();

        return $this->index($item);
    }

    public function destroy(Item $item, ProductImage $image)
    {
        if ((int) $image->item_id !== (int) $item->id) {
            return response()->json(['message' => 'Image does not belong to this item.'], 422);
        }

        DB::transaction(function () use ($item, $image) {
            $isPrimary = (int) $item->primary_image_id === (int) $image->id;

            $paths = array_values(array_filter([$image->path, $image->thumb_path]));
            if ($paths) {
                try {
                    Storage::disk('public')->delete($paths);
                } catch (\Exception $e) {
                    // Ignore file deletion errors (e.g. if file is already missing)
                }
            }

            $image->delete();

            if ($isPrimary) {
                $nextId = $item->productImages()->orderByDesc('id')->value('id');
                $item->primary_image_id = $nextId ?: null;
                $item->save();
            }
        });

        // Refresh the item from DB so that the updated primary_image_id is reflected
        $item->refresh();

        return $this->index($item);
    }
}
