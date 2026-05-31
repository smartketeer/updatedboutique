<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['branch_id', 'user_id']);
            $table->index(['user_id', 'branch_id']);
        });

        DB::table('users')
            ->select(['id', 'branch_id'])
            ->whereNotNull('branch_id')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('branch_user')->updateOrInsert(
                        ['branch_id' => (int) $row->branch_id, 'user_id' => (int) $row->id],
                        ['created_at' => now(), 'updated_at' => now()],
                    );
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_user');
    }
};

