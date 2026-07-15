<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentTransaction extends Model
{
    protected $fillable = ['reference', 'hostel_id', 'student_id', 'landlord_id', 'rent_amount', 'commission_percentage', 'system_fee', 'landlord_amount', 'status', 'rented_at'];

    protected function casts(): array
    {
        return ['rent_amount' => 'decimal:2', 'commission_percentage' => 'decimal:2', 'system_fee' => 'decimal:2', 'landlord_amount' => 'decimal:2', 'rented_at' => 'datetime'];
    }

    public function hostel() { return $this->belongsTo(Hostel::class); }
    public function student() { return $this->belongsTo(User::class, 'student_id'); }
    public function landlord() { return $this->belongsTo(User::class, 'landlord_id'); }
}
