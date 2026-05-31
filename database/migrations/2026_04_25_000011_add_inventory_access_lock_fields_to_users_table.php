<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('inventory_access_failed_attempts')->default(0);
            $table->timestamp('inventory_access_locked_until')->nullable();

            $table->index(['role', 'inventory_access_locked_until']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role', 'inventory_access_locked_until']);
            $table->dropColumn(['inventory_access_failed_attempts', 'inventory_access_locked_until']);
        });
    }
};
