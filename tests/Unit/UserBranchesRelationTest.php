<?php

namespace Tests\Unit;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserBranchesRelationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_be_attached_to_multiple_branches(): void
    {
        $luna = Branch::create(['name' => 'luna', 'address' => null, 'phone' => null, 'is_active' => true]);
        $roxas = Branch::create(['name' => 'roxas', 'address' => null, 'phone' => null, 'is_active' => true]);

        $user = User::factory()->create([
            'role' => 'staff',
            'branch_id' => $roxas->id,
        ]);

        $user->branches()->sync([$luna->id, $roxas->id]);

        $this->assertSame(
            [$luna->id, $roxas->id],
            $user->branches()->orderBy('branches.id')->pluck('branches.id')->map(fn ($v) => (int) $v)->all(),
        );
    }
}

