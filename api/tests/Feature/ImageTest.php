<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // A real (not faked) private disk, so signed URLs are genuinely signed and served.
        config(['filesystems.disks.local.root' => storage_path('framework/testing/private')]);
        Storage::forgetDisk('local');
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('framework/testing/private'));

        parent::tearDown();
    }

    public function test_public_upload_returns_a_public_storage_url(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $url = $this->post('/api/images', ['file' => UploadedFile::fake()->create('My Photo.PNG', 100, 'image/png'), 'is_private' => '0'], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('url');

        $this->assertMatchesRegularExpression('#/storage/post-images/'.$user->id.'/\d{13}-my_photo\.png$#', $url);
        Storage::disk('public')->assertExists(Str::after($url, '/storage/'));
    }

    public function test_private_upload_is_only_served_through_a_signed_url_for_an_hour(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $ref = $this->post('/api/images', ['file' => UploadedFile::fake()->create('secret.jpg', 10, 'image/jpeg'), 'is_private' => '1'], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('url');
        $this->assertMatchesRegularExpression('#^private://'.$user->id.'/\d{13}-secret\.jpg$#', $ref);

        $path = Str::after($ref, 'private://');
        $urls = $this->postJson('/api/images/sign', ['paths' => [$path, $user->id.'/missing.jpg']])
            ->assertOk()
            ->json('urls');

        $this->assertSame([$path], array_keys($urls));
        $this->get($urls[$path], ['Origin' => 'https://privat.bahnhof.se'])
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'https://privat.bahnhof.se');
        $this->get('/storage/private-images/'.$path)->assertForbidden();

        $this->travel(61)->minutes();
        $this->get($urls[$path])->assertForbidden();
    }

    public function test_guests_cannot_upload_or_sign(): void
    {
        $this->postJson('/api/images', [])->assertUnauthorized();
        $this->postJson('/api/images/sign', ['paths' => ['a/b.png']])->assertUnauthorized();
    }

    public function test_rejects_non_images_and_files_over_5_mb(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create());

        $this->post('/api/images', ['file' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'), 'is_private' => '0'], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
        $this->post('/api/images', ['file' => UploadedFile::fake()->create('big.png', 5121, 'image/png'), 'is_private' => '0'], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }

    public function test_sign_rejects_paths_that_escape_the_private_folder(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/images/sign', ['paths' => ['../.env']])->assertUnprocessable();
        $this->postJson('/api/images/sign', ['paths' => ['user/../../x']])->assertUnprocessable();
    }
}
