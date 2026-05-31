<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductImagesTest extends TestCase
{
    use RefreshDatabase;

    private function tinyPngUpload(string $name): UploadedFile
    {
        $bytes = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X3N8AAAAASUVORK5CYII=',
            true,
        );
        return UploadedFile::fake()->createWithContent($name, $bytes !== false ? $bytes : 'x');
    }

    public function test_admin_can_upload_images_and_set_primary()
    {
        Storage::fake('public');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $category = Category::create(['name' => 'Cat', 'type' => 'product']);
        $item = Item::create([
            'category_id' => $category->id,
            'name' => 'Item 1',
            'sku' => 'SKU-IMG-1',
            'price' => 10,
            'cost' => 5,
            'stock_qty' => 0,
            'is_service' => false,
        ]);

        $file1 = $this->tinyPngUpload('a.png');
        $thumb1 = $this->tinyPngUpload('a.thumb.png');
        $res = $this->post(
            "/api/items/{$item->id}/images",
            ['images' => [$file1], 'thumbs' => [$thumb1]],
            ['Accept' => 'application/json'],
        );

        $res->assertOk();

        $item->refresh();
        $this->assertNotNull($item->primary_image_id);

        $payload = $res->json();
        $this->assertIsArray($payload);
        $this->assertCount(1, $payload['images']);
        $this->assertTrue((bool) $payload['images'][0]['is_primary']);

        $files = Storage::disk('public')->allFiles("product-images/{$item->id}");
        $this->assertGreaterThanOrEqual(2, count($files));

        $file2 = $this->tinyPngUpload('b.png');
        $thumb2 = $this->tinyPngUpload('b.thumb.png');
        $res2 = $this->post(
            "/api/items/{$item->id}/images",
            ['images' => [$file2], 'thumbs' => [$thumb2]],
            ['Accept' => 'application/json'],
        );
        $res2->assertOk();

        $payload2 = $res2->json();
        $this->assertCount(2, $payload2['images']);

        $secondId = $payload2['images'][0]['id'];
        $setPrimary = $this->patch("/api/items/{$item->id}/images/{$secondId}/primary", [], ['Accept' => 'application/json']);
        $setPrimary->assertOk();

        $item->refresh();
        $this->assertEquals($secondId, $item->primary_image_id);
    }

    public function test_admin_can_delete_primary_image_and_primary_moves()
    {
        Storage::fake('public');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $category = Category::create(['name' => 'Cat', 'type' => 'product']);
        $item = Item::create([
            'category_id' => $category->id,
            'name' => 'Item 1',
            'sku' => 'SKU-IMG-2',
            'price' => 10,
            'cost' => 5,
            'stock_qty' => 0,
            'is_service' => false,
        ]);

        $this->post(
            "/api/items/{$item->id}/images",
            ['images' => [$this->tinyPngUpload('a.png')], 'thumbs' => [$this->tinyPngUpload('a.thumb.png')]],
            ['Accept' => 'application/json'],
        )->assertOk();

        $this->post(
            "/api/items/{$item->id}/images",
            ['images' => [$this->tinyPngUpload('b.png')], 'thumbs' => [$this->tinyPngUpload('b.thumb.png')]],
            ['Accept' => 'application/json'],
        )->assertOk();

        $item->refresh();
        $primaryId = $item->primary_image_id;
        $this->assertNotNull($primaryId);

        $del = $this->delete("/api/items/{$item->id}/images/{$primaryId}", [], ['Accept' => 'application/json']);
        $del->assertOk();

        $item->refresh();
        $this->assertNotEquals($primaryId, $item->primary_image_id);
    }

    public function test_rejects_invalid_upload_format()
    {
        Storage::fake('public');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $category = Category::create(['name' => 'Cat', 'type' => 'product']);
        $item = Item::create([
            'category_id' => $category->id,
            'name' => 'Item 1',
            'sku' => 'SKU-IMG-3',
            'price' => 10,
            'cost' => 5,
            'stock_qty' => 0,
            'is_service' => false,
        ]);

        $bad = UploadedFile::fake()->create('x.txt', 10, 'text/plain');

        $res = $this->post(
            "/api/items/{$item->id}/images",
            ['images' => [$bad]],
            ['Accept' => 'application/json'],
        );

        $res->assertStatus(422);
    }
}
