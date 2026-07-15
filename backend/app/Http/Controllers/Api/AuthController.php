<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['student', 'landlord'])],
            'phone' => ['nullable', 'string', 'max:40'],
            'student_id' => ['nullable', 'string', 'max:80'],
            'programme' => ['nullable', 'string', 'max:160'],
            'business_name' => ['nullable', 'string', 'max:160'],
        ]);

        $user = User::create($data);

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('web')->plainTextToken,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'role' => ['required', Rule::in(['student', 'landlord', 'admin'])],
        ]);

        $user = User::where('email', $data['email'])->where('role', $data['role'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        if ($user->status === 'suspended') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        return response()->json([
            'user' => $user,
            'token' => $user->createToken('web')->plainTextToken,
        ]);
    }

    public function google(Request $request)
    {
        $data = $request->validate([
            'access_token' => ['required', 'string'],
            'role' => ['required', Rule::in(['student', 'landlord', 'admin'])],
        ]);

        $clientId = config('services.google.client_id');

        if (! $clientId) {
            return response()->json(['message' => 'Google sign-in is not configured.'], 500);
        }

        $tokenResponse = Http::asForm()->get('https://oauth2.googleapis.com/tokeninfo', [
            'access_token' => $data['access_token'],
        ]);

        if (! $tokenResponse->ok()) {
            return response()->json(['message' => 'Google sign-in token is invalid.'], 422);
        }

        $googleUser = $tokenResponse->json();

        if (($googleUser['aud'] ?? null) !== $clientId) {
            return response()->json(['message' => 'Google sign-in token is not for this app.'], 422);
        }

        $emailVerified = filter_var($googleUser['email_verified'] ?? false, FILTER_VALIDATE_BOOL);

        if (empty($googleUser['email']) || ! $emailVerified) {
            return response()->json(['message' => 'Use a verified Google email address to continue.'], 422);
        }

        $userInfoResponse = Http::withToken($data['access_token'])
            ->get('https://www.googleapis.com/oauth2/v3/userinfo');

        $profile = $userInfoResponse->ok() ? $userInfoResponse->json() : [];
        $name = $profile['name'] ?? $googleUser['name'] ?? strtok($googleUser['email'], '@');

        $user = User::where('email', $googleUser['email'])->first();

        if ($user && $user->role !== $data['role']) {
            return response()->json(['message' => 'This Google account is registered as '.$user->role.'.'], 422);
        }

        if ($user && $user->status === 'suspended') {
            return response()->json(['message' => 'This account has been suspended.'], 403);
        }

        if (! $user && $data['role'] === 'admin') {
            return response()->json(['message' => 'Admin Google sign-in requires an existing admin account.'], 422);
        }

        if (! $user) {
            $user = User::create([
                'name' => $name,
                'email' => $googleUser['email'],
                'email_verified_at' => now(),
                'password' => Str::random(32),
                'role' => $data['role'],
            ]);
        } elseif (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return response()->json([
            'user' => $user->fresh(),
            'token' => $user->createToken('web')->plainTextToken,
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                [
                    'token' => Hash::make($token),
                    'created_at' => now(),
                ]
            );

            $resetUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://127.0.0.1:5173')), '/')
                .'/?reset_token='.$token.'&email='.urlencode($user->email);

            Mail::raw(
                "Use this link to reset your AAMUSTED Rent Guide password:\n\n{$resetUrl}\n\nThis link expires in 60 minutes.",
                fn ($message) => $message
                    ->to($user->email)
                    ->subject('Reset your AAMUSTED Rent Guide password')
            );
        }

        return response()->json([
            'message' => 'If this email exists, password reset instructions will be sent.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $data['email'])->first();

        if (! $record || ! Hash::check($data['token'], $record->token) || now()->subMinutes(60)->gt($record->created_at)) {
            return response()->json(['message' => 'Password reset token is invalid or expired.'], 422);
        }

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            return response()->json(['message' => 'Password reset token is invalid or expired.'], 422);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();
        $user->tokens()->delete();

        return response()->json(['message' => 'Password reset successfully. You can sign in with your new password.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'student_id' => ['nullable', 'string', 'max:80'],
            'programme' => ['nullable', 'string', 'max:160'],
            'business_name' => ['nullable', 'string', 'max:160'],
            'profile_photo_file' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        if ($request->hasFile('profile_photo_file')) {
            if ($user->profile_photo) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $user->profile_photo));
            }

            $data['profile_photo'] = Storage::disk('public')->url(
                $request->file('profile_photo_file')->store('profile-photos', 'public')
            );
        }

        unset($data['profile_photo_file']);

        $user->update($data);

        return response()->json(['user' => $user->fresh()]);
    }

    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $request->user()->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $request->user()->update([
            'password' => Hash::make($data['password']),
        ]);

        return response()->json(['message' => 'Password updated.']);
    }
}
