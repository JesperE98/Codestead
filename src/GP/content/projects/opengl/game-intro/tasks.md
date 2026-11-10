# The 2D game (Hedgerow) – no tasks (OpenGL)

learnopengl "In Practice / 2D Game / Breakout" has no code: it introduces the game the following chapters build. The
course builds **its own game of the same genre, Hedgerow** – a ball, a paddle and a wall of blocks in a garden at
dusk, with the course's own sprites and levels (`textures/`, `levels/` from `src/GP/content/textures/game/`). Every
technique and step of learnopengl's chapters stays; only the art, the levels and the name are the course's own.
**No tasks**; `edits.txt` is empty.

start/ = solution/ = the start of the next chapter (`game-setup/start`), so the learner can build and run the project
the game is written in: one `main.cpp` with an empty 800×600 window titled "Hedgerow", OpenGL 3.3 core, blending on,
the render loop clearing to black, and TODO sections in the order of learnopengl's files (Shader, Texture2D,
ResourceManager, Game, program). See `../game-setup/tasks.md` for the fixed choices of the whole game (one file of
structs and free functions instead of learnopengl's classes, deterministic time and the scripted space bar).

Picture (Mesa, 800×600, nothing depends on time): black (0, 0, 0) everywhere. Nothing printed.
