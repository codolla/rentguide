<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'name' => 'AAMUSTED Rent Guide API',
        'status' => 'running',
        'api_base_url' => url('/api'),
        'health_url' => url('/up'),
        'endpoints' => [
            'listings' => url('/api/listings'),
            'login' => url('/api/auth/login'),
            'register' => url('/api/auth/register'),
        ],
    ]);
});
