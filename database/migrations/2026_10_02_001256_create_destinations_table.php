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
        Schema::create('destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workday_id')->constrained()->cascadeOnDelete();
            $table->string('address');
            $table->string('reference');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('status', 20)->default('pending');
            $table->boolean('is_unplanned')->default(false);
            $table->unsignedInteger('position')->nullable();
            $table->unsignedInteger('leg_distance_meters')->nullable();
            $table->unsignedInteger('leg_duration_seconds')->nullable();
            $table->json('leg_geometry')->nullable();
            $table->json('leg_steps')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['workday_id', 'position']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('destinations');
    }
};
