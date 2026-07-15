<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReviewController extends Controller
{
    public function index(Request $request)
    {
        $query = Review::with(['user:id,name', 'hostel:id,name'])->latest();

        $query->where('status', 'active')
            ->whereHas('hostel', fn ($hostel) => $hostel->where('verified', true)->where('status', 'verified'));

        return response()->json($query->get());
    }

    public function myReviews(Request $request)
    {
        abort_unless($request->user()->role === 'student', 403, 'Only students can use this review list.');

        return response()->json(Review::with(['user:id,name', 'hostel:id,name'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'hostel_id' => ['required', 'exists:hostels,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['required', 'string'],
        ]);

        abort_unless($request->user()->role === 'student', 403, 'Only students can post reviews.');

        $hostel = Hostel::whereKey($data['hostel_id'])
            ->where('verified', true)
            ->where('status', 'verified')
            ->firstOrFail();

        $review = DB::transaction(function () use ($data, $request, $hostel) {
            $review = Review::create($data + ['user_id' => $request->user()->id]);
            $this->refreshHostelReviewStats($hostel);

            return $review;
        });

        return response()->json($review->load(['user:id,name', 'hostel:id,name']), 201);
    }

    public function update(Request $request, Review $review)
    {
        abort_unless($review->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['required', 'string'],
        ]);

        DB::transaction(function () use ($review, $data) {
            $review->update($data);
            $this->refreshHostelReviewStats($review->hostel);
        });

        return response()->json($review->refresh()->load(['user:id,name', 'hostel:id,name']));
    }

    public function destroy(Request $request, Review $review)
    {
        abort_unless($review->user_id === $request->user()->id, 403);

        $hostel = $review->hostel;

        DB::transaction(function () use ($review, $hostel) {
            $review->delete();
            $this->refreshHostelReviewStats($hostel);
        });

        return response()->json(['message' => 'Review deleted.']);
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
}
