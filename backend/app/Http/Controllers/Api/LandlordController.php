<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Message;
use App\Models\Review;
use App\Models\VerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LandlordController extends Controller
{
    private function authorizeLandlord(Request $request): void
    {
        abort_unless($request->user()?->role === 'landlord', 403, 'Landlord access is required.');
    }

    public function dashboard(Request $request)
    {
        $this->authorizeLandlord($request);

        $user = $request->user();
        $hostels = $user->hostels()->withCount('reviews')->latest()->get();
        $hostelIds = $hostels->pluck('id');
        $reviews = Review::whereIn('hostel_id', $hostelIds);

        return response()->json([
            'landlord' => $user,
            'total_listings' => $hostels->count(),
            'active_rooms' => $hostels->where('available', true)->count(),
            'student_inquiries' => Message::where('receiver_id', $user->id)->count(),
            'average_rating' => round((float) $reviews->avg('rating'), 1),
            'verified_listings' => $hostels->where('status', 'verified')->count(),
            'pending_listings' => $hostels->where('status', 'pending')->count(),
            'rejected_listings' => $hostels->where('status', 'rejected')->count(),
            'listings' => $hostels,
            'recent_messages' => Message::query()
                ->with(['sender:id,name', 'receiver:id,name', 'hostel:id,name'])
                ->where('sender_id', $user->id)
                ->orWhere('receiver_id', $user->id)
                ->latest()
                ->limit(5)
                ->get(),
            'verification_requests' => VerificationRequest::with('hostel:id,name')
                ->where('landlord_id', $user->id)
                ->latest()
                ->limit(5)
                ->get(),
        ]);
    }

    public function listings(Request $request)
    {
        $this->authorizeLandlord($request);

        return response()->json($request->user()->hostels()->with('currentRental.student:id,name,email,phone')->latest()->get());
    }

    public function messages(Request $request)
    {
        $this->authorizeLandlord($request);

        $user = $request->user();

        return response()->json(Message::query()
            ->with(['sender:id,name', 'receiver:id,name', 'hostel:id,name'])
            ->where('sender_id', $user->id)
            ->orWhere('receiver_id', $user->id)
            ->latest()
            ->get());
    }

    public function reviews(Request $request)
    {
        $this->authorizeLandlord($request);

        $hostelIds = $request->user()->hostels()->pluck('id');

        return response()->json(Review::query()
            ->with(['user:id,name', 'hostel:id,name'])
            ->whereIn('hostel_id', $hostelIds)
            ->latest()
            ->get());
    }

    public function verifications(Request $request)
    {
        $this->authorizeLandlord($request);

        return response()->json(VerificationRequest::with('hostel:id,name')
            ->where('landlord_id', $request->user()->id)
            ->latest()
            ->get());
    }

    public function storeListing(Request $request)
    {
        $this->authorizeLandlord($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'distance' => ['required', 'string', 'max:80'],
            'price' => ['required', 'integer', 'min:1'],
            'type' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string'],
            'facilities' => ['nullable', 'array'],
            'image' => ['nullable', 'string'],
            'image_file' => ['nullable', 'image', 'max:10240'],
        ]);

        if ($request->hasFile('image_file')) {
            $data['image'] = Storage::disk('public')->url(
                $request->file('image_file')->store('hostel-images', 'public')
            );
        }

        unset($data['image_file']);

        $hostel = $request->user()->hostels()->create($data + ['status' => 'pending']);

        return response()->json($hostel, 201);
    }

    public function updateListing(Request $request, Hostel $hostel)
    {
        $this->authorizeLandlord($request);

        abort_unless($hostel->landlord_id === $request->user()->id, 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'location' => ['sometimes', 'string', 'max:255'],
            'distance' => ['sometimes', 'string', 'max:80'],
            'price' => ['sometimes', 'integer', 'min:1'],
            'type' => ['sometimes', 'string', 'max:80'],
            'description' => ['nullable', 'string'],
            'facilities' => ['nullable', 'array'],
            'image' => ['nullable', 'string'],
            'image_file' => ['nullable', 'image', 'max:10240'],
            'available' => ['sometimes', 'boolean'],
        ]);

        if ($request->hasFile('image_file')) {
            $data['image'] = Storage::disk('public')->url(
                $request->file('image_file')->store('hostel-images', 'public')
            );
        }

        unset($data['image_file']);

        $contentFields = [
            'name',
            'location',
            'distance',
            'price',
            'type',
            'description',
            'facilities',
            'image',
        ];

        if (collect($contentFields)->contains(fn ($field) => array_key_exists($field, $data))) {
            $data['verified'] = false;
            $data['status'] = 'pending';
            $data['rejection_reason'] = null;
            $data['reviewed_at'] = null;
            $data['resubmitted_at'] = now();
        }

        $hostel->update($data);

        return response()->json($hostel->refresh());
    }

    public function submitVerification(Request $request)
    {
        $this->authorizeLandlord($request);

        $data = $request->validate([
            'hostel_id' => ['nullable', 'exists:hostels,id'],
            'type' => ['required', 'string', 'max:120'],
            'document_path' => ['nullable', 'string'],
            'document_file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($request->hasFile('document_file')) {
            $data['document_path'] = Storage::disk('public')->url(
                $request->file('document_file')->store('verification-documents', 'public')
            );
        }

        unset($data['document_file']);

        if (!empty($data['hostel_id'])) {
            abort_unless(
                $request->user()->hostels()->whereKey($data['hostel_id'])->exists(),
                403
            );
        }

        $verification = VerificationRequest::create($data + [
            'landlord_id' => $request->user()->id,
            'status' => 'pending',
        ]);

        return response()->json($verification->load('hostel:id,name'), 201);
    }
}
