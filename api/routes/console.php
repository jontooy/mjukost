<?php

use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

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

Artisan::command('mjukost:prune-images {--dry-run : List orphaned images without deleting them}', function () {
    // Photos pinned on the writing board are uploaded before the post is sealed, so recent files are kept.
    $cutoff = now()->subDay()->getTimestamp();
    $referenced = [];

    foreach (Post::query()->select(['id', 'body'])->lazyById() as $post) {
        preg_match_all('#private://([^\s)]+)#', $post->body, $private);
        preg_match_all('#/storage/(post-images/[^\s)?\#]+)#', $post->body, $public);

        foreach ($private[1] as $path) {
            $referenced['local:private-images/'.$path] = true;
        }
        foreach ($public[1] as $path) {
            $referenced['public:'.$path] = true;
        }
    }

    $dryRun = (bool) $this->option('dry-run');
    $count = 0;

    foreach (['local' => 'private-images', 'public' => 'post-images'] as $diskName => $directory) {
        $disk = Storage::disk($diskName);

        foreach ($disk->allFiles($directory) as $file) {
            if (isset($referenced[$diskName.':'.$file]) || $disk->lastModified($file) > $cutoff) {
                continue;
            }

            if (! $dryRun) {
                $disk->delete($file);
            }
            $this->line(($dryRun ? 'Would delete ' : 'Deleted ').$file);
            $count++;
        }
    }

    $this->info(($dryRun ? 'Orphaned images found: ' : 'Orphaned images deleted: ').$count);
})->purpose('Delete uploaded images that no post links to any more');

Schedule::command('mjukost:prune-images')->dailyAt('03:30');
Schedule::command('sanctum:prune-expired --hours=24')->dailyAt('03:40');
