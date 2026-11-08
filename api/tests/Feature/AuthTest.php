<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_a_token_that_authenticates_requests(): void
    {
        $user = User::factory()->create(['email' => 'reader@example.com']);

        $token = $this->postJson('/api/login', ['email' => 'Reader@Example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', 'reader@example.com')
            ->json('token');

        $this->withToken($token)->getJson('/api/user')
            ->assertOk()
            ->assertExactJson(['id' => $user->id, 'email' => 'reader@example.com']);
    }

    public function test_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'reader@example.com']);

        $this->postJson('/api/login', ['email' => 'reader@example.com', 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invalid login credentials');
    }

    public function test_user_imported_from_supabase_can_sign_in(): void
    {
        $supabaseHash = crypt('hunter22', '$2a$10$'.str_repeat('a', 22));
        $user = User::factory()->create(['email' => 'old@example.com']);
        DB::table('users')->where('id', $user->id)->update(['password' => '$2y$'.substr($supabaseHash, 4)]);

        $this->postJson('/api/login', ['email' => 'old@example.com', 'password' => 'hunter22'])->assertOk();
    }

    public function test_logout_revokes_the_token(): void
    {
        User::factory()->create(['email' => 'reader@example.com']);
        $token = $this->postJson('/api/login', ['email' => 'reader@example.com', 'password' => 'password'])->json('token');

        $this->withToken($token)->postJson('/api/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_tokens_expire_after_30_days(): void
    {
        $token = User::factory()->create()->createToken('web')->plainTextToken;

        $this->travel(29)->days();
        $this->withToken($token)->getJson('/api/user')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->travel(2)->days();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }
}
