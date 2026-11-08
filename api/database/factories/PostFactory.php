<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(),
            'body' => fake()->paragraph(),
            'is_private' => false,
            'slot' => fake()->unique()->numberBetween(0, Post::MAX_SLOT),
        ];
    }

    public function private(): static
    {
        return $this->state(fn () => ['is_private' => true]);
    }
}
