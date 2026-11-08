<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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
        $post = $request->user()->posts()->create($this->validatedPost($request));

        return response()->json($post, 201);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        $post->update($this->validatedPost($request));

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
