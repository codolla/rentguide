<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hostel;
use App\Models\PlatformSetting;
use App\Models\RentTransaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AccountsController extends Controller
{
    private function authorizeAdmin(Request $request): void { abort_unless($request->user()?->role === 'admin', 403, 'Admin access is required.'); }
    private function percentage(): float { return (float) (PlatformSetting::where('key', 'rent_commission_percentage')->value('value') ?? 5); }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);
        $transactions = RentTransaction::with(['hostel:id,name,location', 'student:id,name,email', 'landlord:id,name,business_name'])->latest('rented_at')->get();

        return response()->json([
            'commission_percentage' => $this->percentage(),
            'statistics' => [
                'transactions' => $transactions->count(),
                'total_rent' => (float) $transactions->sum('rent_amount'),
                'system_total' => (float) $transactions->sum('system_fee'),
                'landlords_total' => (float) $transactions->sum('landlord_amount'),
                'rented_hostels' => $transactions->pluck('hostel_id')->unique()->count(),
            ],
            'transactions' => $transactions,
            'hostels' => Hostel::with('landlord:id,name,business_name')->where('status', 'verified')->orderBy('name')->get(['id', 'landlord_id', 'name', 'location', 'price']),
            'students' => User::where('role', 'student')->where('status', 'active')->orderBy('name')->get(['id', 'name', 'email']),
        ]);
    }

    public function updateCommission(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['percentage' => ['required', 'numeric', 'min:0', 'max:100']]);
        PlatformSetting::updateOrCreate(['key' => 'rent_commission_percentage'], ['value' => $data['percentage']]);
        return response()->json(['commission_percentage' => (float) $data['percentage']]);
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['hostel_id' => ['required', 'exists:hostels,id'], 'student_id' => ['required', 'exists:users,id'], 'rent_amount' => ['required', 'numeric', 'min:1'], 'rented_at' => ['nullable', 'date']]);
        $hostel = Hostel::findOrFail($data['hostel_id']);
        abort_unless(User::whereKey($data['student_id'])->where('role', 'student')->exists(), 422, 'The selected account is not a student.');
        $percentage = $this->percentage();
        $fee = round(((float) $data['rent_amount']) * $percentage / 100, 2);

        $transaction = DB::transaction(function () use ($data, $hostel, $percentage, $fee) {
            $transaction = RentTransaction::create([
                'reference' => 'RENT-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)), 'hostel_id' => $hostel->id,
                'student_id' => $data['student_id'], 'landlord_id' => $hostel->landlord_id, 'rent_amount' => $data['rent_amount'],
                'commission_percentage' => $percentage, 'system_fee' => $fee, 'landlord_amount' => (float) $data['rent_amount'] - $fee,
                'status' => 'completed', 'rented_at' => $data['rented_at'] ?? now(),
            ]);
            $hostel->update(['available' => false]);
            return $transaction;
        });

        return response()->json($transaction->load(['hostel:id,name,location', 'student:id,name,email', 'landlord:id,name,business_name']), 201);
    }
}
