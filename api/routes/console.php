<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;

Artisan::command('mjukost:user {email}', function (string $email) {
    $password = (string) $this->secret('Password (at least 6 characters)');

    if (strlen($password) < 6) {
        $this->error('Password must be at least 6 characters.');

        return 1;
    }

    $user = User::firstOrNew(['email' => strtolower($email)]);
    $user->password = $password;
    $user->save();

    if ($user->wasRecentlyCreated) {
        $this->info('Created '.$user->email);

        return 0;
    }

    $user->tokens()->delete();
    $this->info('Updated password for '.$user->email);

    return 0;
})->purpose('Create a user or set their password');
