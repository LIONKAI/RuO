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
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('depot_address')->nullable()->after('fuel_liters_per_km');
            $table->decimal('depot_latitude', 10, 7)->nullable()->after('depot_address');
            $table->decimal('depot_longitude', 10, 7)->nullable()->after('depot_latitude');
        });

        Schema::table('destinations', function (Blueprint $table) {
            $table->unsignedBigInteger('workday_id')->nullable()->change();
            $table->date('service_date')->nullable()->after('workday_id');
            $table->string('phone', 30)->nullable()->after('reference');
            $table->string('public_token', 40)->nullable()->unique()->after('is_unplanned');
            $table->string('failure_reason')->nullable()->after('completed_at');
            $table->string('recipient_name')->nullable()->after('failure_reason');
            $table->string('pod_note', 500)->nullable()->after('recipient_name');
            $table->string('pod_photo_path')->nullable()->after('pod_note');
            $table->string('pod_signature_path')->nullable()->after('pod_photo_path');
            $table->decimal('delivered_latitude', 10, 7)->nullable()->after('pod_signature_path');
            $table->decimal('delivered_longitude', 10, 7)->nullable()->after('delivered_latitude');

            $table->index(['service_date', 'workday_id']);
        });

        Schema::table('workdays', function (Blueprint $table) {
            $table->decimal('last_latitude', 10, 7)->nullable()->after('completed_at');
            $table->decimal('last_longitude', 10, 7)->nullable()->after('last_latitude');
            $table->timestamp('last_position_at')->nullable()->after('last_longitude');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workdays', function (Blueprint $table) {
            $table->dropColumn(['last_latitude', 'last_longitude', 'last_position_at']);
        });

        Schema::table('destinations', function (Blueprint $table) {
            $table->dropIndex(['service_date', 'workday_id']);
            $table->dropColumn([
                'service_date', 'phone', 'public_token', 'failure_reason', 'recipient_name',
                'pod_note', 'pod_photo_path', 'pod_signature_path',
                'delivered_latitude', 'delivered_longitude',
            ]);
            $table->unsignedBigInteger('workday_id')->nullable(false)->change();
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn(['depot_address', 'depot_latitude', 'depot_longitude']);
        });
    }
};
