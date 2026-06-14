<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('branch_requisitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // The cashier who requested
            $table->string('sku')->nullable();
            $table->string('item_name');
            $table->integer('quantity')->default(1);
            $table->string('reason')->nullable(); // Refill, Out of Stock, Others
            $table->string('status')->default('pending'); // pending, approved, rejected, fulfilled
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('branch_requisitions');
    }
};
