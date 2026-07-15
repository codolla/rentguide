<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\Message;
use App\Models\Notification;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(Message::query()
            ->with(['sender:id,name', 'receiver:id,name', 'hostel:id,name'])
            ->where(fn ($query) => $query
                ->where('sender_id', $request->user()->id)
                ->orWhere('receiver_id', $request->user()->id))
            ->latest()
            ->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'receiver_id' => ['required', 'exists:users,id'],
            'hostel_id' => ['required', 'exists:hostels,id'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        abort_if((int) $data['receiver_id'] === $request->user()->id, 422, 'You cannot message yourself.');

        $hostel = Hostel::findOrFail($data['hostel_id']);

        if ($request->user()->role === 'student') {
            abort_unless($hostel->landlord_id === (int) $data['receiver_id'], 403, 'Students can only contact the landlord for this listing.');
            abort_unless($hostel->verified && $hostel->status === 'verified', 403, 'This listing is not available for inquiries.');
        } elseif ($request->user()->role === 'landlord') {
            abort_unless($hostel->landlord_id === $request->user()->id, 403, 'Landlords can only reply for their own listings.');
        } else {
            abort(403, 'Admins cannot send listing messages.');
        }

        $message = Message::create($data + ['sender_id' => $request->user()->id]);
        $message->load(['sender:id,name', 'receiver:id,name,role', 'hostel:id,name']);

        Notification::create([
            'user_id' => $message->receiver_id,
            'type' => 'message',
            'title' => 'New message',
            'body' => "{$message->sender->name} sent a message about {$message->hostel->name}.",
            'action_url' => $message->receiver->role === 'landlord' ? 'landlord-messages' : 'student-messages',
        ]);

        return response()->json($message, 201);
    }
}
