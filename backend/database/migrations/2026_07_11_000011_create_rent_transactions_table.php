<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rent_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('hostel_id')->constrained('hostels')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('landlord_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('rent_amount', 12, 2);
            $table->decimal('commission_percentage', 5, 2);
            $table->decimal('system_fee', 12, 2);
            $table->decimal('landlord_amount', 12, 2);
            $table->string('status')->default('completed');
            $table->timestamp('rented_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_transactions');
    }
};
