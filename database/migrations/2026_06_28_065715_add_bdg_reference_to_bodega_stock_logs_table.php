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
        Schema::table('bodega_stock_logs', function (Blueprint $table) {
            $table->string('bdg_reference')->nullable()->after('bdg_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bodega_stock_logs', function (Blueprint $table) {
            $table->dropColumn('bdg_reference');
        });
    }
};
