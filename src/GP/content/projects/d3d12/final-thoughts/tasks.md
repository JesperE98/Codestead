# Final thoughts (Hedgerow) – no tasks (DirectX 12)

learnopengl "2D Game / Final thoughts" closes the game chapters without new code: what was built (a game loop,
sprites, levels, collisions, particles, post-processing, power-ups, audio, text) and ideas to take it further (more
levels and a level editor, high scores, more power-ups, combining the effects, and splitting the code into classes and
files as learnopengl does). For Direct3D 12 in particular: one draw per sprite and particle with its own root constants
is simple but slow – a real game would batch the sprites (instancing with a per-instance buffer, as in the
`instancing` chapter, or one dynamic vertex buffer per frame like the text's), keep several frames in flight instead of
waiting for the GPU every frame (the D3D12HelloFrameBuffering sample), and use a sprite atlas like the glyph atlas.

**No tasks**: `edits.txt` is empty and start/ = solution/ = `render-text`'s solution – the finished Hedgerow game, one
`main.cpp` (the D3D12App class and the game's structs and free functions) plus its shaders (`sprite.hlsl`,
`particle.hlsl`, `post_processing.hlsl`, `text_2d.hlsl`), `textures/`, `levels/` and `fonts/`.

Picture: the same as `render-text`'s solution at 3.0 s (frame 180; see `../render-text/tasks.md`): the menu – "Press
ENTER to start" and "Press W or S to select level" over level one, "Lives:3" at the top left, the ball on the paddle.
With the course's fixed input (only SPACE) the game stays in the menu; pressing ENTER, A/D and SPACE yourself plays it.
