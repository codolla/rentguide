<?php

namespace Database\Seeders;

use App\Models\Hostel;
use App\Models\Message;
use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use App\Models\VerificationRequest;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'AAMUSTED Admin',
            'email' => 'admin@aamustedrentguide.edu.gh',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $student = User::create([
            'name' => 'Kwesi Mensah',
            'email' => 'student@aamustedrentguide.edu.gh',
            'password' => Hash::make('password'),
            'role' => 'student',
            'phone' => '+233 24 123 4567',
            'student_id' => 'AAMUSTED/2023/ICT/042',
            'programme' => 'Information Technology Education',
            'status' => 'active',
        ]);

        $landlord = User::create([
            'name' => 'Mr. Kwame Mensah',
            'email' => 'landlord@aamustedrentguide.edu.gh',
            'password' => Hash::make('password'),
            'role' => 'landlord',
            'phone' => '+233 24 555 0188',
            'business_name' => 'Mensah Student Hostels',
            'status' => 'active',
        ]);

        $hostels = [
            [
                'name' => 'Greenview Student Hostel',
                'location' => '12 Tanoso Road, Kumasi',
                'distance' => '0.4 km from AAMUSTED',
                'price' => 3500,
                'rating' => 4.8,
                'reviews_count' => 47,
                'verified' => true,
                'facilities' => ['wifi', 'security', 'water', 'electricity'],
                'image' => 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&h=500&fit=crop&auto=format',
                'type' => 'Self-contain',
                'available' => true,
                'description' => 'A clean and modern self-contained hostel close to the AAMUSTED main gate.',
                'status' => 'verified',
            ],
            [
                'name' => 'Campus View Apartments',
                'location' => '7 University Avenue, Tanoso',
                'distance' => '0.8 km from AAMUSTED',
                'price' => 4200,
                'rating' => 4.6,
                'reviews_count' => 33,
                'verified' => true,
                'facilities' => ['wifi', 'security', 'electricity'],
                'image' => 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop&auto=format',
                'type' => '1-bedroom',
                'available' => true,
                'description' => 'Spacious apartment with gated access and shared laundry room.',
                'status' => 'verified',
            ],
            [
                'name' => 'Scholars Lodge',
                'location' => '3 Abuakwa Close, Kumasi',
                'distance' => '1.2 km from AAMUSTED',
                'price' => 2800,
                'rating' => 4.3,
                'reviews_count' => 62,
                'verified' => false,
                'facilities' => ['water', 'security', 'electricity'],
                'image' => 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop&auto=format',
                'type' => 'Room & parlour',
                'available' => false,
                'description' => 'Affordable room and parlour apartments in a quiet area.',
                'status' => 'pending',
            ],
        ];

        foreach ($hostels as $data) {
            Hostel::create($data + ['landlord_id' => $landlord->id]);
        }

        $student->savedHostels()->attach([1, 2]);

        Review::create([
            'user_id' => $student->id,
            'hostel_id' => 1,
            'rating' => 5,
            'comment' => 'Clean rooms, good security, and easy transport to campus.',
            'status' => 'active',
        ]);

        Message::create([
            'sender_id' => $landlord->id,
            'receiver_id' => $student->id,
            'hostel_id' => 1,
            'body' => 'Yes, you can inspect Greenview Student Hostel tomorrow at 2 PM.',
        ]);

        Message::create([
            'sender_id' => $student->id,
            'receiver_id' => $landlord->id,
            'hostel_id' => 1,
            'body' => 'Great. I will come after lectures with my student ID.',
        ]);

        Report::create([
            'reporter_id' => $student->id,
            'hostel_id' => 3,
            'reason' => 'Photos do not match actual room',
            'severity' => 'medium',
            'status' => 'open',
        ]);

        VerificationRequest::create([
            'landlord_id' => $landlord->id,
            'hostel_id' => 3,
            'type' => 'Property document',
            'status' => 'pending',
        ]);
    }
}
