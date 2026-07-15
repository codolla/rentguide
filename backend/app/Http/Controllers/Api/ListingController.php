<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use Illuminate\Http\Request;

class ListingController extends Controller
{
    public function index(Request $request)
    {
        $query = Hostel::query()
            ->with('landlord:id,name,business_name')
            ->where('verified', true)
            ->where('status', 'verified')
            ->where('available', true);

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('location', 'like', "%{$search}%"));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return response()->json($query->latest()->paginate(12));
    }

    public function show(Hostel $listing)
    {
        abort_unless($listing->verified && $listing->status === 'verified', 404);

        return response()->json($listing->load(['landlord:id,name,business_name,phone', 'reviews.user:id,name']));
    }
}
