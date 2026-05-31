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
        Schema::table('branch_item_stocks', function (Blueprint $table) {
            $table->decimal('cost', 15, 2)->nullable()->after('quantity');
            $table->string('location')->nullable()->after('cost');
            $table->date('last_restock_date')->nullable()->after('location');
            $table->integer('total_sold')->default(0)->after('last_restock_date');
        });

        Schema::table('inventory_imports', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->constrained()->onDelete('set null')->after('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branch_item_stocks', function (Blueprint $table) {
            $table->dropColumn(['cost', 'location', 'last_restock_date', 'total_sold']);
        });

        Schema::table('inventory_imports', function (Blueprint $table) {
            $table->dropForeign(['branch_id']);
            $table->dropColumn('branch_id');
        });
    }
};
