<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_a_user_that_can_sign_in(): void
    {
        $this->artisan('mjukost:user', ['email' => 'New@Example.com'])
            ->expectsQuestion('Password (at least 6 characters)', 'secret12')
            ->expectsOutput('Created new@example.com')
            ->assertSuccessful();

        $this->postJson('/api/login', ['email' => 'new@example.com', 'password' => 'secret12'])->assertOk();
    }

    public function test_resetting_a_password_signs_out_existing_tokens(): void
    {
        $user = User::factory()->create(['email' => 'reader@example.com']);
        $token = $user->createToken('web')->plainTextToken;

        $this->artisan('mjukost:user', ['email' => 'reader@example.com'])
            ->expectsQuestion('Password (at least 6 characters)', 'newsecret')
            ->expectsOutput('Updated password for reader@example.com')
            ->assertSuccessful();

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
        $this->postJson('/api/login', ['email' => 'reader@example.com', 'password' => 'newsecret'])->assertOk();
    }

    public function test_rejects_short_passwords(): void
    {
        $this->artisan('mjukost:user', ['email' => 'new@example.com'])
            ->expectsQuestion('Password (at least 6 characters)', '12345')
            ->assertFailed();

        $this->assertDatabaseCount('users', 0);
    }
}
