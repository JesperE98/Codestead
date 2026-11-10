# Final thoughts (Hedgerow) – no tasks (Vulkan)

learnopengl "2D Game / Final thoughts" closes the game chapters without new code: what was built (a game loop,
sprites, levels, collisions, particles, post-processing, power-ups, audio, text) and ideas to take it further (more
levels and a level editor, high scores, more power-ups, combining the effects, a sprite atlas / instanced rendering
instead of one draw call per sprite and particle, and splitting the code into classes and files as learnopengl does).
For the Vulkan version a few more: several frames in flight (vulkan-tutorial's `MAX_FRAMES_IN_FLIGHT`; the game uses
one command buffer and one fence, so the CPU waits for every frame), one descriptor set per texture kept but the
sprites' push constants replaced by an instance buffer (one `vkCmdDraw` for all bricks), and a pipeline cache.

**No tasks**: `edits.txt` is empty and start/ = solution/ = `render-text`'s solution – the finished Hedgerow game, one
`main.cpp` with vulkan-tutorial's application class and the game's structs and free functions, plus its shaders,
`textures/`, `levels/` and `fonts/`.

Picture: the same as `render-text`'s solution at 3.0 s (frame 180; see `../render-text/tasks.md`): the menu – "Press
ENTER to start" and "Press W or S to select level" over level one, "Lives:3" at the top left, the ball on the paddle.
With the course's fixed input (only SPACE) the game stays in the menu; pressing ENTER, A/D and SPACE yourself plays it.
