<?php

namespace App\Models;

use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// A post's slot is its place in the world: a poster along the road for public posts, a cell in
// the dungeon for private ones. Slots are unique among public posts and among private posts.
#[Fillable(['title', 'body', 'is_private', 'slot'])]
class Post extends Model
{
    public const MAX_SLOT = 10_000_000;

    /** @use HasFactory<PostFactory> */
    use HasFactory, HasUuids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_private' => 'boolean', 'slot' => 'integer'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
