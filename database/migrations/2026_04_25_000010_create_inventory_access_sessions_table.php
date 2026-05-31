<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_access_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('request_id');
            $table->string('secret_hash', 64);
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->foreign('request_id')->references('id')->on('inventory_access_requests')->cascadeOnDelete();

            $table->index(['cashier_id', 'expires_at']);
            $table->index(['request_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_access_sessions');
    }
};
