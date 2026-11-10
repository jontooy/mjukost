<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PostTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_only_see_public_posts_newest_first(): void
    {
        $old = Post::factory()->create(['created_at' => now()->subDay()]);
        $new = Post::factory()->create();
        Post::factory()->private()->create();

        $this->getJson('/api/posts')->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.id', $new->id)
            ->assertJsonPath('1.id', $old->id);
        $this->getJson('/api/posts?is_private=0')->assertOk()->assertJsonCount(2);
        $this->getJson('/api/posts?is_private=1')->assertUnauthorized();
    }

    public function test_signed_in_users_filter_by_privacy(): void
    {
        Post::factory()->create();
        $private = Post::factory()->private()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/posts?is_private=1')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.id', $private->id)
            ->assertJsonPath('0.is_private', true);
        $this->getJson('/api/posts')->assertOk()->assertJsonCount(2);
    }

    public function test_post_json_has_exactly_the_frontend_fields(): void
    {
        Post::factory()->create();

        $this->assertEqualsCanonicalizing(
            ['id', 'user_id', 'title', 'body', 'is_private', 'slot', 'image_ascii', 'created_at', 'updated_at'],
            array_keys($this->getJson('/api/posts')->json('0')),
        );
    }

    public function test_guests_cannot_write(): void
    {
        $post = Post::factory()->create();
        $payload = ['title' => 'T', 'body' => 'B', 'is_private' => false];

        $this->postJson('/api/posts', $payload)->assertUnauthorized();
        $this->putJson("/api/posts/{$post->id}", $payload)->assertUnauthorized();
        $this->deleteJson("/api/posts/{$post->id}")->assertUnauthorized();
    }

    public function test_created_post_belongs_to_the_caller(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/posts', ['title' => 'Hello', 'body' => 'World', 'is_private' => true, 'slot' => 0, 'user_id' => (string) Str::uuid()])
            ->assertCreated()
            ->assertJsonPath('user_id', $user->id)
            ->assertJsonPath('title', 'Hello')
            ->assertJsonPath('is_private', true)
            ->assertJsonPath('slot', 0);
    }

    public function test_any_signed_in_user_can_update_a_post(): void
    {
        $post = Post::factory()->create(['updated_at' => now()->subDay()]);
        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/posts/{$post->id}", ['title' => 'New', 'body' => 'Text', 'is_private' => false])
            ->assertOk()
            ->assertJsonPath('title', 'New');
        $this->assertTrue($post->fresh()->updated_at->greaterThan(now()->subMinute()));
    }

    public function test_any_signed_in_user_can_delete_a_post(): void
    {
        $post = Post::factory()->create();
        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();
        $this->assertModelMissing($post);
    }

    public function test_a_post_needs_text_but_no_title(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/posts', ['body' => 'Only text', 'is_private' => false, 'slot' => 0])
            ->assertCreated()
            ->assertJsonPath('title', '');
        $this->postJson('/api/posts', ['title' => '', 'body' => 'Text', 'is_private' => false, 'slot' => 1])
            ->assertCreated()
            ->assertJsonPath('title', '');
        $this->postJson('/api/posts', ['title' => 'T', 'body' => '', 'is_private' => false, 'slot' => 2])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');
    }

    public function test_title_longer_than_200_characters_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/posts', ['title' => str_repeat('a', 201), 'body' => 'B', 'is_private' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('title');
    }

    public function test_a_place_takes_one_post_per_side(): void
    {
        Post::factory()->create(['slot' => 3]);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/posts', ['title' => 'T', 'body' => 'B', 'is_private' => false, 'slot' => 3])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slot');
        $this->postJson('/api/posts', ['title' => 'T', 'body' => 'B', 'is_private' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('slot');
        $this->postJson('/api/posts', ['title' => 'T', 'body' => 'B', 'is_private' => true, 'slot' => 3])
            ->assertCreated()
            ->assertJsonPath('slot', 3);
        $this->postJson('/api/posts', ['title' => 'T', 'body' => 'B', 'is_private' => false, 'slot' => 4])
            ->assertCreated();
    }

    public function test_moving_a_post_to_the_other_side_needs_its_place_free_there(): void
    {
        $public = Post::factory()->create(['slot' => 5]);
        Post::factory()->private()->create(['slot' => 5]);
        $free = Post::factory()->create(['slot' => 6]);
        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/posts/{$public->id}", ['title' => 'T', 'body' => 'B', 'is_private' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('is_private');
        $this->putJson("/api/posts/{$free->id}", ['title' => 'T', 'body' => 'B', 'is_private' => true])
            ->assertOk()
            ->assertJsonPath('slot', 6);
    }

    public function test_malformed_post_id_is_not_found(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson('/api/posts/not-a-uuid')->assertNotFound();
    }

    public function test_image_glyphs_are_saved_and_cleared_with_the_post(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $art = ['cols' => 2, 'rows' => 1, 'levels' => '09', 'colours' => '000000ffd479'];

        $id = $this->postJson('/api/posts', ['body' => '![a](x.png)', 'is_private' => false, 'slot' => 0, 'image_ascii' => $art])
            ->assertCreated()
            ->assertJsonPath('image_ascii', $art)
            ->json('id');
        $this->getJson('/api/posts')->assertJsonPath('0.image_ascii', $art);

        $this->putJson("/api/posts/{$id}", ['body' => 'No image now', 'is_private' => false])
            ->assertOk()
            ->assertJsonPath('image_ascii', null);
    }

    public function test_image_glyphs_must_fill_every_cell(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/posts', ['body' => 'B', 'is_private' => false, 'slot' => 0, 'image_ascii' => ['cols' => 2, 'rows' => 2, 'levels' => '09', 'colours' => '000000ffd479']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['image_ascii.levels', 'image_ascii.colours']);
    }
}
