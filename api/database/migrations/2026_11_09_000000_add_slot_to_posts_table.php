<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->unsignedInteger('slot')->nullable();
        });

        // Existing posts keep the places they already had in the world: oldest first,
        // public and private counted apart.
        foreach ([false, true] as $private) {
            $ids = DB::table('posts')->where('is_private', $private)->orderBy('created_at')->orderBy('id')->pluck('id');
            foreach ($ids as $slot => $id) {
                DB::table('posts')->where('id', $id)->update(['slot' => $slot]);
            }
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->unique(['is_private', 'slot']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropUnique(['is_private', 'slot']);
            $table->dropColumn('slot');
        });
    }
};
