<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The post's first image as glyphs for its poster, computed by the writer when the post is saved.
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->json('image_ascii')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('image_ascii');
        });
    }
};
