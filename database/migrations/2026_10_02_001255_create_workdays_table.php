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
        Schema::create('workdays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('status', 20)->default('draft');
            $table->unsignedInteger('route_version')->default(0);
            $table->timestamp('route_updated_at')->nullable();
            $table->decimal('total_km', 8, 2)->nullable();
            $table->decimal('estimated_fuel_liters', 8, 2)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['vehicle_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workdays');
    }
};
