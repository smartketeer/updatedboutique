<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashierAccountBranchSelectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_endpoint_is_disabled(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $res = $this->postJson('/api/cashiers', [
            'name' => 'Cashier One',
            'email' => 'cashier1@botique.com',
            'password' => 'password123',
            'branch_ids' => [1],
        ]);

        $res->assertStatus(405);
    }

    public function test_update_links_user_only_to_selected_branches_and_does_not_default_to_luna(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $luna = Branch::create(['name' => 'luna', 'address' => null, 'phone' => null, 'is_active' => true]);
        $roxas = Branch::create(['name' => 'roxas', 'address' => null, 'phone' => null, 'is_active' => true]);

        $user = User::factory()->create([
            'role' => 'staff',
            'name' => 'Cashier Three',
            'email' => 'cashier3@botique.com',
            'branch_id' => $luna->id,
        ]);
        $user->branches()->sync([$luna->id]);

        $res = $this->putJson("/api/cashiers/{$user->id}", [
            'branch_ids' => [$roxas->id],
        ]);

        $res->assertStatus(200);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'role' => 'staff',
            'branch_id' => $roxas->id,
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
        ]);

        $this->assertDatabaseHas('branch_user', [
            'user_id' => $user->id,
            'branch_id' => $roxas->id,
        ]);

        $this->assertDatabaseMissing('branch_user', [
            'user_id' => $user->id,
            'branch_id' => $luna->id,
        ]);
    }
}
