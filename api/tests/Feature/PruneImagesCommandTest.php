<?php

namespace Tests\Feature;

use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PruneImagesCommandTest extends TestCase
{
    use RefreshDatabase;

    private const OLD = '2 days ago';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_deletes_old_orphans_and_keeps_linked_and_recent_images(): void
    {
        Post::factory()->private()->create(['body' => "Hi\n\n![a](private://u1/1-kept.png)"]);
        Post::factory()->create(['body' => '![b](https://pi.example/storage/post-images/u1/2-kept.jpg)']);

        $this->putFile('local', 'private-images/u1/1-kept.png', self::OLD);
        $this->putFile('local', 'private-images/u1/3-orphan.png', self::OLD);
        $this->putFile('local', 'private-images/u1/4-just-pinned.png', 'now');
        $this->putFile('public', 'post-images/u1/2-kept.jpg', self::OLD);
        $this->putFile('public', 'post-images/u1/5-orphan.jpg', self::OLD);

        $this->artisan('mjukost:prune-images')
            ->expectsOutput('Orphaned images deleted: 2')
            ->assertSuccessful();

        Storage::disk('local')->assertExists(['private-images/u1/1-kept.png', 'private-images/u1/4-just-pinned.png']);
        Storage::disk('local')->assertMissing('private-images/u1/3-orphan.png');
        Storage::disk('public')->assertExists('post-images/u1/2-kept.jpg');
        Storage::disk('public')->assertMissing('post-images/u1/5-orphan.jpg');
    }

    public function test_a_private_path_does_not_protect_a_public_file_with_the_same_name(): void
    {
        Post::factory()->private()->create(['body' => '![a](private://u1/1-same.png)']);
        $this->putFile('public', 'post-images/u1/1-same.png', self::OLD);

        $this->artisan('mjukost:prune-images')->assertSuccessful();

        Storage::disk('public')->assertMissing('post-images/u1/1-same.png');
    }

    public function test_dry_run_deletes_nothing(): void
    {
        $this->putFile('local', 'private-images/u1/3-orphan.png', self::OLD);

        $this->artisan('mjukost:prune-images', ['--dry-run' => true])
            ->expectsOutput('Would delete private-images/u1/3-orphan.png')
            ->expectsOutput('Orphaned images found: 1')
            ->assertSuccessful();

        Storage::disk('local')->assertExists('private-images/u1/3-orphan.png');
    }

    private function putFile(string $disk, string $path, string $modified): void
    {
        Storage::disk($disk)->put($path, 'image');
        touch(Storage::disk($disk)->path($path), strtotime($modified));
    }
}
