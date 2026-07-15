<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hostel extends Model
{
    protected $fillable = [
        'landlord_id',
        'name',
        'location',
        'distance',
        'price',
        'rating',
        'reviews_count',
        'verified',
        'facilities',
        'image',
        'type',
        'available',
        'description',
        'status',
        'admin_notes',
        'rejection_reason',
        'reviewed_at',
        'resubmitted_at',
    ];

    protected function casts(): array
    {
        return [
            'facilities' => 'array',
            'verified' => 'boolean',
            'available' => 'boolean',
            'price' => 'integer',
            'rating' => 'float',
            'reviewed_at' => 'datetime',
            'resubmitted_at' => 'datetime',
        ];
    }

    public function landlord()
    {
        return $this->belongsTo(User::class, 'landlord_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function currentRental()
    {
        return $this->hasOne(RentTransaction::class)->where('status', 'completed')->latestOfMany('rented_at');
    }
}
