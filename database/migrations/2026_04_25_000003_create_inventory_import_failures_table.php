<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_import_failures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_import_id')->constrained('inventory_imports')->onDelete('cascade');
            $table->unsignedInteger('row_number');
            $table->json('data');
            $table->json('errors');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_import_failures');
    }
};
