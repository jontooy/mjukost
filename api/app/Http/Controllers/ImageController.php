<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImageController extends Controller
{
    private const PUBLIC_DIRECTORY = 'post-images';

    private const PRIVATE_DIRECTORY = 'private-images';

    private const PRIVATE_SCHEME = 'private://';

    private const SIGNED_URL_MINUTES = 60;

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimetypes:image/*', 'max:5120'],
            'is_private' => ['required', 'boolean'],
        ]);

        $file = $validated['file'];
        $userId = $request->user()->id;
        $name = (int) floor(microtime(true) * 1000).'-'.strtolower(preg_replace('/[^a-zA-Z0-9._-]/', '_', $file->getClientOriginalName()));

        if ($request->boolean('is_private')) {
            Storage::disk('local')->putFileAs(self::PRIVATE_DIRECTORY.'/'.$userId, $file, $name);

            return response()->json(['url' => self::PRIVATE_SCHEME.$userId.'/'.$name], 201);
        }

        $path = Storage::disk('public')->putFileAs(self::PUBLIC_DIRECTORY.'/'.$userId, $file, $name);

        return response()->json(['url' => Storage::disk('public')->url($path)], 201);
    }

    public function sign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'paths' => ['required', 'array', 'max:50'],
            'paths.*' => ['string', 'regex:/^[A-Za-z0-9-]+\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/'],
        ]);

        $disk = Storage::disk('local');
        $urls = [];

        foreach (array_unique($validated['paths']) as $path) {
            $file = self::PRIVATE_DIRECTORY.'/'.$path;

            if ($disk->fileExists($file)) {
                $urls[$path] = $disk->temporaryUrl($file, now()->addMinutes(self::SIGNED_URL_MINUTES));
            }
        }

        return response()->json(['urls' => (object) $urls]);
    }
}
