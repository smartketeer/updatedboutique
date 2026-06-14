<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('bodega_tables'); // Clean up the stub table if it was created

        Schema::create('bodega_users', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->string('bdg_name');
            $table->string('bdg_email')->unique();
            $table->string('bdg_password');
            $table->rememberToken('bdg_remember_token');
            $table->timestamps();
        });

        Schema::create('bodega_categories', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->string('bdg_name');
            $table->string('bdg_description')->nullable();
            $table->timestamps();
        });

        Schema::create('bodega_items', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->unsignedBigInteger('bdg_category_id')->nullable();
            $table->string('bdg_name');
            $table->string('bdg_sku')->unique()->nullable();
            $table->decimal('bdg_price', 10, 2)->default(0);
            $table->decimal('bdg_cost', 10, 2)->default(0);
            $table->integer('bdg_stock_qty')->default(0);
            $table->boolean('bdg_is_service')->default(false);
            $table->unsignedBigInteger('bdg_primary_image_id')->nullable();
            $table->timestamps();

            $table->foreign('bdg_category_id')->references('bdg_id')->on('bodega_categories')->onDelete('set null');
        });

        Schema::create('bodega_stock_logs', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->unsignedBigInteger('bdg_item_id');
            $table->unsignedBigInteger('bdg_actor_user_id')->nullable();
            $table->integer('bdg_change_qty');
            $table->integer('bdg_new_qty');
            $table->string('bdg_reason')->nullable();
            $table->text('bdg_notes')->nullable();
            $table->timestamps();

            $table->foreign('bdg_item_id')->references('bdg_id')->on('bodega_items')->onDelete('cascade');
            $table->foreign('bdg_actor_user_id')->references('bdg_id')->on('bodega_users')->onDelete('set null');
        });

        Schema::create('bodega_activity_logs', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->unsignedBigInteger('bdg_actor_user_id')->nullable();
            $table->string('bdg_event_type');
            $table->text('bdg_description');
            $table->json('bdg_metadata')->nullable();
            $table->string('bdg_ip_address')->nullable();
            $table->string('bdg_user_agent')->nullable();
            $table->timestamps();

            $table->foreign('bdg_actor_user_id')->references('bdg_id')->on('bodega_users')->onDelete('set null');
        });

        Schema::create('bodega_stock_transfers', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->string('bdg_reference_number')->unique()->nullable();
            $table->unsignedBigInteger('bdg_to_branch_id')->nullable(); 
            $table->string('bdg_status')->default('pending');
            $table->unsignedBigInteger('bdg_requested_by')->nullable();
            $table->unsignedBigInteger('bdg_approved_by')->nullable();
            $table->text('bdg_notes')->nullable();
            $table->timestamps();

            $table->foreign('bdg_to_branch_id')->references('id')->on('branches')->onDelete('set null');
            $table->foreign('bdg_requested_by')->references('bdg_id')->on('bodega_users')->onDelete('set null');
            $table->foreign('bdg_approved_by')->references('bdg_id')->on('bodega_users')->onDelete('set null');
        });

        Schema::create('bodega_stock_transfer_items', function (Blueprint $table) {
            $table->id('bdg_id');
            $table->unsignedBigInteger('bdg_transfer_id');
            $table->unsignedBigInteger('bdg_item_id');
            $table->integer('bdg_quantity');
            $table->integer('bdg_received_quantity')->default(0);
            $table->timestamps();

            $table->foreign('bdg_transfer_id')->references('bdg_id')->on('bodega_stock_transfers')->onDelete('cascade');
            $table->foreign('bdg_item_id')->references('bdg_id')->on('bodega_items')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bodega_stock_transfer_items');
        Schema::dropIfExists('bodega_stock_transfers');
        Schema::dropIfExists('bodega_activity_logs');
        Schema::dropIfExists('bodega_stock_logs');
        Schema::dropIfExists('bodega_items');
        Schema::dropIfExists('bodega_categories');
        Schema::dropIfExists('bodega_users');
    }
};
