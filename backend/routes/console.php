<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('about:rent-guide', function () {
    $this->info('AAMUSTED Rent Guide API');
});
