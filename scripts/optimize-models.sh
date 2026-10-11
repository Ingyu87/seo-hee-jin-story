#!/usr/bin/env bash
# Re-export the finished Blender GLBs into public/models:
#   meshopt compression + mesh simplification (scenery harder than faces) + webp textures.
set -euo pipefail
B=${BLENDER_DIR:-/workspace/blender}
OUT=public/models
mkdir -p "$OUT"
opt() { # src dst ratio error
  npx gltf-transform optimize "$1" "$OUT/$2.glb" \
    --compress meshopt --join true --join-named false --flatten false --instance false \
    --palette false --simplify true --simplify-ratio "$3" --simplify-error "$4" --texture-compress webp
}
opt "$B/kid/kid_acnh.glb"           seohui    0.3  0.001
opt "$B/kid2/kid2_acnh.glb"         seojin    0.3  0.001
opt "$B/story/npc_snowwhite.glb"    snowwhite 0.25 0.0015
opt "$B/story/npc_dwarfs.glb"       dwarfs    0.15 0.002
opt "$B/story/npc_queen.glb"        queen     0.2  0.0015
opt "$B/story/forest.glb"           forest    0.15 0.004
opt "$B/story/cottage.glb"          cottage   0.25 0.002
cp "$B/story/cottage_interactables.json" "$OUT/"
ls -la "$OUT"
