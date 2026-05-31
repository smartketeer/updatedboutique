<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_logs', 'branch_id')) {
                $table->foreignId('branch_id')->nullable()->constrained()->onDelete('set null')->after('item_id');
            }
            if (! Schema::hasColumn('stock_logs', 'actor_user_id')) {
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->onDelete('set null')->after('branch_id');
            }
            if (! Schema::hasColumn('stock_logs', 'reference')) {
                $table->string('reference')->nullable()->after('reason');
            }
            if (! Schema::hasColumn('stock_logs', 'notes')) {
                $table->string('notes')->nullable()->after('reference');
            }
            if (! Schema::hasColumn('stock_logs', 'meta')) {
                $table->json('meta')->nullable()->after('notes');
            }
        });

        Schema::table('stock_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_logs', 'branch_id')) {
                return;
            }
            $table->index(['branch_id', 'item_id', 'created_at'], 'stock_logs_branch_item_created_at_idx');
            $table->unique(['branch_id', 'reason', 'reference'], 'stock_logs_branch_reason_reference_unique');
        });
    }

    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            if (Schema::hasColumn('stock_logs', 'branch_id')) {
                $table->dropUnique('stock_logs_branch_reason_reference_unique');
                $table->dropIndex('stock_logs_branch_item_created_at_idx');
            }
        });

        Schema::table('stock_logs', function (Blueprint $table) {
            if (Schema::hasColumn('stock_logs', 'meta')) {
                $table->dropColumn('meta');
            }
            if (Schema::hasColumn('stock_logs', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('stock_logs', 'reference')) {
                $table->dropColumn('reference');
            }
            if (Schema::hasColumn('stock_logs', 'actor_user_id')) {
                $table->dropForeign(['actor_user_id']);
                $table->dropColumn('actor_user_id');
            }
            if (Schema::hasColumn('stock_logs', 'branch_id')) {
                $table->dropForeign(['branch_id']);
                $table->dropColumn('branch_id');
            }
        });
    }
};
