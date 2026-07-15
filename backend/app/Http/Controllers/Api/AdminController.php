<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Notification;
use App\Models\PlatformSetting;
use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    private const DEFAULT_SETTINGS = [
        'rules' => [true, true, true, false],
        'defaults' => [
            'currency' => 'GH₵ Ghana cedi',
            'radius' => '2 km',
            'sla' => '2 business days',
            'support' => 'support@aamustedrentguide.edu.gh',
        ],
    ];

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403, 'Admin access is required.');
    }

    public function dashboard(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json([
            'students' => User::where('role', 'student')->count(),
            'landlords' => User::where('role', 'landlord')->count(),
            'listings' => Hostel::count(),
            'verified_listings' => Hostel::where('verified', true)->count(),
            'open_reports' => Report::where('status', 'open')->count(),
            'pending_verifications' => VerificationRequest::where('status', 'pending')->count(),
            'pending_listings' => Hostel::where('status', 'pending')->count(),
            'recent_reports' => Report::with(['reporter:id,name', 'hostel:id,name'])->latest()->limit(5)->get(),
            'recent_verifications' => VerificationRequest::with(['landlord:id,name,business_name', 'hostel:id,name'])->latest()->limit(5)->get(),
            'recent_listings' => Hostel::with('landlord:id,name,business_name')
                ->where('status', 'pending')
                ->latest()
                ->limit(5)
                ->get(),
        ]);
    }

    public function users(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(User::latest()->paginate(20));
    }

    public function updateUserStatus(Request $request, User $user)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        abort_if($user->role === 'admin', 422, 'Admin accounts cannot be suspended here.');

        $user->update(['status' => $data['status']]);

        return response()->json($user->fresh());
    }

    public function updateUser(Request $request, User $user)
    {
        $this->authorizeAdmin($request);

        abort_if($user->role === 'admin', 422, 'Admin accounts cannot be edited here.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:40'],
            'student_id' => ['nullable', 'string', 'max:80'],
            'programme' => ['nullable', 'string', 'max:160'],
            'business_name' => ['nullable', 'string', 'max:160'],
            'status' => ['required', 'in:active,suspended'],
        ]);

        if ($user->role === 'student') {
            $data['business_name'] = null;
        }

        if ($user->role === 'landlord') {
            $data['student_id'] = null;
            $data['programme'] = null;
        }

        $user->update($data);

        return response()->json($user->fresh());
    }

    public function deleteUser(Request $request, User $user)
    {
        $this->authorizeAdmin($request);

        abort_if($user->role === 'admin', 422, 'Admin accounts cannot be deleted here.');

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    public function settings(Request $request)
    {
        $this->authorizeAdmin($request);

        $setting = PlatformSetting::firstOrCreate(
            ['key' => 'admin_settings'],
            ['value' => self::DEFAULT_SETTINGS]
        );

        return response()->json($this->normalizeSettings($setting->value));
    }

    public function updateSettings(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'rules' => ['required', 'array', 'size:4'],
            'rules.*' => ['required', 'boolean'],
            'defaults' => ['required', 'array'],
            'defaults.currency' => ['required', 'string', 'max:80'],
            'defaults.radius' => ['required', 'string', 'max:80'],
            'defaults.sla' => ['required', 'string', 'max:80'],
            'defaults.support' => ['required', 'email', 'max:255'],
        ]);

        $setting = PlatformSetting::updateOrCreate(
            ['key' => 'admin_settings'],
            ['value' => $this->normalizeSettings($data)]
        );

        return response()->json($setting->value);
    }

    public function landlords(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(User::where('role', 'landlord')->withCount('hostels')->latest()->paginate(20));
    }

    public function listings(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(Hostel::with(['landlord:id,name,business_name', 'currentRental.student:id,name,email,phone'])->latest()->paginate(20));
    }

    public function showListing(Request $request, Hostel $hostel)
    {
        $this->authorizeAdmin($request);

        return response()->json($hostel->load(['landlord:id,name,business_name,phone', 'reviews.user:id,name', 'currentRental.student:id,name,email,phone']));
    }

    public function approveListing(Request $request, Hostel $hostel)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'admin_notes' => ['nullable', 'string'],
        ]);

        $hostel->update([
            'verified' => true,
            'status' => 'verified',
            'admin_notes' => $data['admin_notes'] ?? $hostel->admin_notes,
            'rejection_reason' => null,
            'reviewed_at' => now(),
        ]);

        Notification::create([
            'user_id' => $hostel->landlord_id,
            'type' => 'listing_approved',
            'title' => 'Listing approved',
            'body' => "{$hostel->name} is now visible to students.",
            'action_url' => 'landlord-listings',
        ]);

        return response()->json($hostel);
    }

    public function rejectListing(Request $request, Hostel $hostel)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string'],
            'admin_notes' => ['nullable', 'string'],
        ]);

        $hostel->update([
            'verified' => false,
            'status' => 'rejected',
            'rejection_reason' => $data['rejection_reason'],
            'admin_notes' => $data['admin_notes'] ?? null,
            'reviewed_at' => now(),
        ]);

        Notification::create([
            'user_id' => $hostel->landlord_id,
            'type' => 'listing_rejected',
            'title' => 'Listing rejected',
            'body' => "{$hostel->name} needs changes: {$data['rejection_reason']}",
            'action_url' => 'landlord-listings',
        ]);

        return response()->json($hostel);
    }

    public function reports(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(Report::with(['reporter:id,name', 'hostel:id,name'])->latest()->paginate(20));
    }

    public function reviews(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(Review::with(['user:id,name', 'hostel:id,name'])->latest()->paginate(20));
    }

    public function updateReviewStatus(Request $request, Review $review)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'status' => ['required', 'in:active,pending,hidden'],
        ]);

        $review->update(['status' => $data['status']]);
        $this->refreshHostelReviewStats($review->hostel);

        return response()->json($review->refresh()->load(['user:id,name', 'hostel:id,name']));
    }

    public function resolveReport(Request $request, Report $report)
    {
        $this->authorizeAdmin($request);

        $report->update(['status' => 'resolved', 'resolved_at' => now()]);

        Notification::create([
            'user_id' => $report->reporter_id,
            'type' => 'report_resolved',
            'title' => 'Report resolved',
            'body' => 'Your listing report has been reviewed by an admin.',
            'action_url' => 'student-dashboard',
        ]);

        return response()->json($report);
    }

    public function verifications(Request $request)
    {
        $this->authorizeAdmin($request);

        return response()->json(VerificationRequest::with(['landlord:id,name,business_name', 'hostel:id,name'])->latest()->paginate(20));
    }

    public function approveVerification(Request $request, VerificationRequest $verificationRequest)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'admin_notes' => ['nullable', 'string'],
        ]);

        $verificationRequest->update([
            'status' => 'approved',
            'reviewed_at' => now(),
            'admin_notes' => $data['admin_notes'] ?? $verificationRequest->admin_notes,
            'rejection_reason' => null,
        ]);

        $verificationRequest->landlord()->update(['status' => 'active']);
        $verificationRequest->hostel?->update(['status' => 'verified', 'verified' => true]);

        Notification::create([
            'user_id' => $verificationRequest->landlord_id,
            'type' => 'verification_approved',
            'title' => 'Verification approved',
            'body' => 'Your landlord verification has been approved.',
            'action_url' => 'landlord-verification',
        ]);

        return response()->json($verificationRequest->refresh()->load(['landlord:id,name,business_name', 'hostel:id,name']));
    }

    public function rejectVerification(Request $request, VerificationRequest $verificationRequest)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'rejection_reason' => ['required', 'string'],
            'admin_notes' => ['nullable', 'string'],
        ]);

        $verificationRequest->update([
            'status' => 'rejected',
            'reviewed_at' => now(),
            'rejection_reason' => $data['rejection_reason'],
            'admin_notes' => $data['admin_notes'] ?? null,
        ]);

        Notification::create([
            'user_id' => $verificationRequest->landlord_id,
            'type' => 'verification_rejected',
            'title' => 'Verification rejected',
            'body' => "Your verification needs changes: {$data['rejection_reason']}",
            'action_url' => 'landlord-verification',
        ]);

        return response()->json($verificationRequest->refresh()->load(['landlord:id,name,business_name', 'hostel:id,name']));
    }

    private function refreshHostelReviewStats(?Hostel $hostel): void
    {
        if (! $hostel) {
            return;
        }

        $hostel->update([
            'rating' => round((float) $hostel->reviews()->where('status', 'active')->avg('rating'), 1),
            'reviews_count' => $hostel->reviews()->where('status', 'active')->count(),
        ]);
    }

    private function normalizeSettings(?array $settings): array
    {
        $settings ??= [];
        $defaults = array_merge(self::DEFAULT_SETTINGS['defaults'], $settings['defaults'] ?? []);
        $rules = array_values($settings['rules'] ?? self::DEFAULT_SETTINGS['rules']);

        return [
            'rules' => array_map(fn ($value) => (bool) $value, array_slice(array_pad($rules, 4, false), 0, 4)),
            'defaults' => [
                'currency' => (string) $defaults['currency'],
                'radius' => (string) $defaults['radius'],
                'sla' => (string) $defaults['sla'],
                'support' => (string) $defaults['support'],
            ],
        ];
    }
}
