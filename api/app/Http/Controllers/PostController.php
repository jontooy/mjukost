<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PostController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['is_private' => ['sometimes', 'boolean']]);

        $signedIn = $request->user('sanctum') !== null;
        $wantsPrivate = $request->has('is_private') ? $request->boolean('is_private') : null;

        if ($wantsPrivate === true && ! $signedIn) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $posts = Post::query()
            ->when(! $signedIn, fn ($query) => $query->where('is_private', false))
            ->when($wantsPrivate !== null, fn ($query) => $query->where('is_private', $wantsPrivate))
            ->latest()
            ->get();

        return response()->json($posts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedPost($request);
        $data += $request->validate([
            'slot' => [
                'required', 'integer', 'min:0', 'max:'.Post::MAX_SLOT,
                Rule::unique('posts')->where('is_private', $data['is_private']),
            ],
        ], ['slot.unique' => 'Someone has just written in this place.']);

        $post = $request->user()->posts()->create($data);

        return response()->json($post, 201);
    }

    // A post keeps its slot; moving it to the other side needs that place free there too.
    public function update(Request $request, Post $post): JsonResponse
    {
        $data = $this->validatedPost($request);
        $taken = $data['is_private'] !== $post->is_private
            && Post::query()->where('is_private', $data['is_private'])->where('slot', $post->slot)->exists();
        if ($taken) {
            throw ValidationException::withMessages(['is_private' => 'That place is already taken on the other side.']);
        }

        $post->update($data);

        return response()->json($post);
    }

    public function destroy(Post $post): Response
    {
        $post->delete();

        return response()->noContent();
    }

    /**
     * @return array{title: string, body: string, is_private: bool}
     */
    private function validatedPost(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string'],
            'is_private' => ['required', 'boolean'],
        ]);
    }
}
