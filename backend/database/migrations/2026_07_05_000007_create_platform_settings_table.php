<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->timestamps();
        });

        DB::table('platform_settings')->insert([
            [
                'key' => 'admin_settings',
                'value' => json_encode([
                    'rules' => [true, true, true, false],
                    'defaults' => [
                        'currency' => 'GH₵ Ghana cedi',
                        'radius' => '2 km',
                        'sla' => '2 business days',
                        'support' => 'support@aamustedrentguide.edu.gh',
                    ],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
