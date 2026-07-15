<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::table('hostels', function (Blueprint $table) {
            $table->text('admin_notes')->nullable()->after('status');
            $table->text('rejection_reason')->nullable()->after('admin_notes');
            $table->timestamp('reviewed_at')->nullable()->after('rejection_reason');
        });

        Schema::table('verification_requests', function (Blueprint $table) {
            $table->text('admin_notes')->nullable()->after('notes');
            $table->text('rejection_reason')->nullable()->after('admin_notes');
        });
    }

    public function down(): void
    {
        Schema::table('verification_requests', function (Blueprint $table) {
            $table->dropColumn(['admin_notes', 'rejection_reason']);
        });

        Schema::table('hostels', function (Blueprint $table) {
            $table->dropColumn(['admin_notes', 'rejection_reason', 'reviewed_at']);
        });

        Schema::dropIfExists('password_reset_tokens');
    }
};
