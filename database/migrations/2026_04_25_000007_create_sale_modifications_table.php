<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_modifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->onDelete('cascade');
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type');
            $table->foreignId('item_id')->nullable()->constrained('items')->nullOnDelete();
            $table->string('label');
            $table->integer('quantity')->nullable();
            $table->decimal('unit_price_before', 10, 2)->nullable();
            $table->decimal('unit_price_after', 10, 2)->nullable();
            $table->decimal('subtotal_before', 10, 2)->nullable();
            $table->decimal('subtotal_after', 10, 2)->nullable();
            $table->string('reason')->nullable();
            $table->uuid('approval_id')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['sale_id', 'created_at']);
            $table->index(['cashier_id', 'created_at']);
            $table->index(['admin_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_modifications');
    }
};
