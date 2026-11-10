# The 2D game (Hedgerow) – no tasks (Vulkan)

learnopengl "In Practice / 2D Game / Breakout" has no code: it introduces the game the following chapters build. The
course builds **its own game of the same genre, Hedgerow** – a ball, a paddle and a wall of blocks in a garden at
dusk, with the course's own sprites and levels (`textures/`, `levels/` from `src/GP/content/textures/game/`). Every
technique and step of learnopengl's chapters stays; only the art, the levels and the name are the course's own.
**No tasks**; `edits.txt` is empty.

start/ = solution/ = the start of the next chapter (`game-setup/start`), so the learner can build and run the project
the game is written in: one `main.cpp` – vulkan-tutorial's `HelloTriangleApplication` with everything the earlier
chapters built (instance and validation layer, swap chain, a render pass with one colour attachment, the descriptor
set layout (uniform buffer at binding 0, texture at binding 1), the pipeline layout with the sprite's push constants,
the `createPipeline` helper, the texture helpers, the uniform buffer, a descriptor pool for 16 textures), an empty
800×600 window titled "Hedgerow", the render pass clearing to black, and TODO sections for the game in the order of
learnopengl's files (Texture2D, ResourceManager, Game, the key callback). See `../game-setup/tasks.md` for the fixed
choices of the whole game (structs and free functions next to the application class instead of learnopengl's
classes, deterministic time and the scripted space bar).

Picture (lavapipe, 800×600, nothing depends on time): black (0, 0, 0) everywhere. No validation message.
