# The 2D game (Hedgerow) – no tasks (DirectX 12)

learnopengl "In Practice / 2D Game / Breakout" has no code: it introduces the game the following chapters build. The
course builds **its own game of the same genre, Hedgerow** – a ball, a paddle and a wall of blocks in a garden at
dusk, with the course's own sprites and levels (`textures/`, `levels/` from `src/GP/content/textures/game/`). Every
technique and step of learnopengl's chapters stays; only the art, the levels and the name are the course's own.
**No tasks**; `edits.txt` is empty.

start/ = solution/ = the start of the next chapter (`game-setup/start`), so the learner can build and run the project
the game is written in: one `main.cpp` with the Direct3D 12 application class of the earlier chapters (`D3D12App`:
`LoadPipeline`, `LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame`), an 800×600 window
titled `L"Hedgerow"` that cannot be resized, the frame cleared to black, the `GraphicsContext Graphics` the game's
functions will create resources and draw with, and TODO sections in the order of learnopengl's files (Shader,
Texture2D, ResourceManager, Game, program). See `../game-setup/tasks.md` for the fixed choices of the whole game.

Picture (nothing depends on time): black (0, 0, 0) everywhere. Nothing is printed.
