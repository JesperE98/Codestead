# Final thoughts (Hedgerow) – no tasks (OpenGL)

learnopengl "2D Game / Final thoughts" closes the game chapters without new code: what was built (a game loop,
sprites, levels, collisions, particles, post-processing, power-ups, audio, text) and ideas to take it further (more
levels and a level editor, high scores, more power-ups, combining the effects, a sprite atlas / instanced rendering
instead of one draw call per sprite and particle, and splitting the code into classes and files as learnopengl does).

**No tasks**: `edits.txt` is empty and start/ = solution/ = `render-text`'s solution – the finished Hedgerow game, one
`main.cpp` of structs and free functions plus its shaders, `textures/`, `levels/` and `fonts/`.

Picture: the same as `render-text`'s solution at 3.0 s (frame 180; see `../render-text/tasks.md`): the menu – "Press
ENTER to start" and "Press W or S to select level" over level one, "Lives:3" at the top left, the ball on the paddle.
With the course's fixed input (only SPACE) the game stays in the menu; pressing ENTER, A/D and SPACE yourself plays it.
