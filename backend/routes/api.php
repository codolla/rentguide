<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AccountsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LandlordController;
use App\Http\Controllers\Api\ListingController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\StudentController;
use Illuminate\Support\Facades\Route;

Route::get('/config', fn () => response()->json([
    'google_client_id' => config('services.google.client_id'),
]));

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/google', [AuthController::class, 'google']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::apiResource('listings', ListingController::class)->only(['index', 'show']);
Route::apiResource('reviews', ReviewController::class)->only(['index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/password', [AuthController::class, 'updatePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::post('/listings/{hostel}/save', [StudentController::class, 'saveListing']);
    Route::delete('/listings/{hostel}/save', [StudentController::class, 'removeSavedListing']);
    Route::post('/listings/{hostel}/report', [StudentController::class, 'reportListing']);
    Route::get('/student/dashboard', [StudentController::class, 'dashboard']);
    Route::get('/saved-listings', [StudentController::class, 'savedListings']);
    Route::get('/student/reports', [StudentController::class, 'reports']);
    Route::post('/student/reports', [StudentController::class, 'storeReport']);

    Route::apiResource('messages', MessageController::class)->only(['index', 'store']);
    Route::get('/my-reviews', [ReviewController::class, 'myReviews']);
    Route::apiResource('reviews', ReviewController::class)->only(['store', 'update', 'destroy']);

    Route::prefix('landlord')->group(function () {
        Route::get('/dashboard', [LandlordController::class, 'dashboard']);
        Route::get('/listings', [LandlordController::class, 'listings']);
        Route::post('/listings', [LandlordController::class, 'storeListing']);
        Route::put('/listings/{hostel}', [LandlordController::class, 'updateListing']);
        Route::get('/messages', [LandlordController::class, 'messages']);
        Route::get('/reviews', [LandlordController::class, 'reviews']);
        Route::get('/verifications', [LandlordController::class, 'verifications']);
        Route::post('/verification', [LandlordController::class, 'submitVerification']);
    });

    Route::prefix('admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/settings', [AdminController::class, 'settings']);
        Route::put('/settings', [AdminController::class, 'updateSettings']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);
        Route::put('/users/{user}/status', [AdminController::class, 'updateUserStatus']);
        Route::get('/landlords', [AdminController::class, 'landlords']);
        Route::get('/listings', [AdminController::class, 'listings']);
        Route::get('/listings/{hostel}', [AdminController::class, 'showListing']);
        Route::post('/listings/{hostel}/approve', [AdminController::class, 'approveListing']);
        Route::post('/listings/{hostel}/reject', [AdminController::class, 'rejectListing']);
        Route::get('/reviews', [AdminController::class, 'reviews']);
        Route::put('/reviews/{review}/status', [AdminController::class, 'updateReviewStatus']);
        Route::get('/reports', [AdminController::class, 'reports']);
        Route::post('/reports/{report}/resolve', [AdminController::class, 'resolveReport']);
        Route::get('/verifications', [AdminController::class, 'verifications']);
        Route::post('/verifications/{verificationRequest}/approve', [AdminController::class, 'approveVerification']);
        Route::post('/verifications/{verificationRequest}/reject', [AdminController::class, 'rejectVerification']);
        Route::get('/accounts', [AccountsController::class, 'index']);
        Route::put('/accounts/commission', [AccountsController::class, 'updateCommission']);
        Route::post('/accounts/transactions', [AccountsController::class, 'store']);
    });
});
