<?php

namespace Tests\Unit;

use App\Models\Category;
use App\Models\Item;
use App\Services\SkuGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkuGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_unique_sku()
    {
        $category = Category::factory()->create(['name' => 'Test Category']);
        
        $skus = [];
        for ($i = 0; $i < 100; $i++) {
            $item = Item::factory()->create(['category_id' => $category->id]);
            $skus[] = $item->sku;
        }

        $this->assertEquals(100, count(array_unique($skus)));
    }

    public function test_sku_uses_only_allowed_characters()
    {
        $category = Category::factory()->create();
        $item = Item::factory()->create(['category_id' => $category->id]);
        
        $this->assertMatchesRegularExpression('/^[A-Z0-9-]+$/', $item->sku);
        $this->assertDoesNotMatchRegularExpression('/[O0Il]/', $item->sku);
    }

    public function test_sku_includes_category_code()
    {
        $category = Category::factory()->create(['name' => 'Electronics']);
        $item = Item::factory()->create(['category_id' => $category->id]);
        
        $this->assertStringStartsWith('ELE-', $item->sku);
    }

    public function test_validation_passes_for_generated_sku()
    {
        $category = Category::factory()->create();
        $item = Item::factory()->create(['category_id' => $category->id]);
        
        $this->assertTrue(SkuGenerator::validate($item->sku));
    }
}
