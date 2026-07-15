<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationRequest extends Model
{
    protected $fillable = [
        'landlord_id',
        'hostel_id',
        'type',
        'document_path',
        'status',
        'notes',
        'admin_notes',
        'rejection_reason',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function landlord()
    {
        return $this->belongsTo(User::class, 'landlord_id');
    }

    public function hostel()
    {
        return $this->belongsTo(Hostel::class);
    }
}
