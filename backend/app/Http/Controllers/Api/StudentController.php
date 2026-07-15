<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    private function authorizeStudent(Request $request): void
    {
        abort_unless($request->user()?->role === 'student', 403, 'Student access is required.');
    }

    public function dashboard(Request $request)
    {
        $this->authorizeStudent($request);

        $user = $request->user();

        return response()->json([
            'user' => $user,
            'saved_count' => $user->savedHostels()->count(),
            'new_listings' => Hostel::where('created_at', '>=', now()->subDays(7))->count(),
            'unread_messages' => Message::where('receiver_id', $user->id)->whereNull('read_at')->count(),
            'recommended_count' => Hostel::where('verified', true)->where('available', true)->count(),
            'recommended' => Hostel::with('landlord:id,name,business_name')
                ->where('verified', true)
                ->where('available', true)
                ->latest()
                ->limit(6)
                ->get(),
            'saved_listings' => $user->savedHostels()
                ->with('landlord:id,name,business_name')
                ->orderByDesc('saved_listings.created_at')
                ->limit(3)
                ->get(),
            'recent_messages' => Message::with(['sender:id,name', 'receiver:id,name', 'hostel:id,name'])
                ->where('sender_id', $user->id)
                ->orWhere('receiver_id', $user->id)
                ->latest()
                ->limit(3)
                ->get(),
        ]);
    }

    public function savedListings(Request $request)
    {
        $this->authorizeStudent($request);

        return response()->json($request->user()->savedHostels()->with('landlord:id,name')->get());
    }

    public function saveListing(Request $request, Hostel $hostel)
    {
        $this->authorizeStudent($request);

        $request->user()->savedHostels()->syncWithoutDetaching($hostel->id);

        return response()->json(['message' => 'Listing saved.']);
    }

    public function removeSavedListing(Request $request, Hostel $hostel)
    {
        $this->authorizeStudent($request);

        $request->user()->savedHostels()->detach($hostel->id);

        return response()->json(['message' => 'Listing removed.']);
    }

    public function reportListing(Request $request, Hostel $hostel)
    {
        $this->authorizeStudent($request);

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
            'severity' => ['nullable', 'in:low,medium,high'],
        ]);

        $report = Report::create([
            'reporter_id' => $request->user()->id,
            'hostel_id' => $hostel->id,
            'reason' => $data['reason'],
            'severity' => $data['severity'] ?? 'medium',
            'status' => 'open',
        ]);

        User::where('role', 'admin')->get()->each(function (User $admin) use ($report, $hostel) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'report',
                'title' => 'New listing report',
                'body' => "{$hostel->name} was reported for {$report->reason}.",
                'action_url' => 'admin-reports',
            ]);
        });

        return response()->json($report->load(['reporter:id,name', 'hostel:id,name']), 201);
    }

    public function reports(Request $request)
    {
        $this->authorizeStudent($request);
        return response()->json(Report::with('hostel:id,name')->where('reporter_id', $request->user()->id)->latest()->get());
    }

    public function storeReport(Request $request)
    {
        $this->authorizeStudent($request);
        $data = $request->validate(['hostel_id' => ['nullable', 'exists:hostels,id'], 'reason' => ['required', 'string', 'max:1000'], 'severity' => ['required', 'in:low,medium,high']]);
        $report = Report::create($data + ['reporter_id' => $request->user()->id, 'status' => 'open']);
        $hostelName = $report->hostel?->name ?? 'General platform issue';
        User::where('role', 'admin')->eachById(function (User $admin) use ($report, $hostelName) {
            Notification::create(['user_id' => $admin->id, 'type' => 'report', 'title' => 'New student issue report', 'body' => "{$hostelName}: {$report->reason}", 'action_url' => 'admin-reports']);
        });
        return response()->json($report->load(['reporter:id,name', 'hostel:id,name']), 201);
    }
}
