# Final thoughts

These last chapters gave a glimpse of what it's like to create something more than just a tech demo in {{api}}. We
created a complete 2D game from scratch: a game loop with input, sprites drawn with an orthographic projection, levels
loaded from files, a ball that collides with blocks and the paddle, particles, post-processing effects, power-ups,
text for the lives and the menu – and, in learnopengl's version, audio. All this using concepts from the earlier
chapters: textures, transformations, blending, framebuffers, multisampling and text rendering. We didn't really learn
new and exciting graphics techniques, but rather how to combine all the knowledge so far into a larger whole.

**This chapter has no tasks.** Its project is the finished game – the `render-text` chapter's solution: one
`main.cpp` plus its shaders, `textures/`, `levels/` and `fonts/`.
:::opengl
The `main.cpp` holds the game's structs and free functions.
:::
:::vulkan
The `main.cpp` holds vulkan-tutorial's application class and the game's structs and free functions.
:::
:::d3d12
The `main.cpp` holds the `D3D12App` class and the game's structs and free functions.
:::
With the course's fixed input (only SPACE) its expected result shows the menu over level one, "Lives:3" at the top left
and the ball on the paddle. In your own program, press ENTER to start, A and D to move the paddle and SPACE to release
the ball – and play.

Creating a simple game like this can be accomplished in thousands of different ways, of which this approach is just one
of many. The larger a game becomes, the more you start applying abstractions and design patterns; learnopengl recommends
the book and website *Game Programming Patterns* for reading on. The course wrote learnopengl's classes as plain structs
and free functions in a single file, because that is easy to follow in one file; a real project would split the code
into classes and files, as learnopengl does. Keep in mind that it is a difficult feat to create a game with extremely
clean and well-thought-out code (often close to impossible). Simply make your game in whatever way you think feels right
at the time. The more you practice video game development, the more you learn new and better approaches to solve
problems. Don't let the struggle to want to create perfect code demotivate you; keep on coding!

## Optimizations

The content of these chapters and the finished game's code were all focused on explaining concepts as simply as
possible, without delving much into optimization. learnopengl lists some of the more common improvements you'll find in
modern 2D games for when the frame rate starts to drop:

- **Sprite sheet / texture atlas**: instead of rendering a sprite with a single texture at a time, combine all
  required textures into a single large texture – like the glyph atlas of the Text Rendering chapter – and select the
  sprite with its texture coordinates. Switching textures can be expensive, so with an atlas we rarely have to; this
  also allows the GPU to cache the texture more efficiently.
- **Instanced rendering**: instead of rendering one quad at a time, batch all the quads and render them with a single
  draw call. Every sprite is made of the same vertices and differs only in its model matrix and colour, which an
  instanced array can hold (see the Instancing chapter). Particles and text glyphs can be drawn the same way.
- **Triangle strips**: a quad as a triangle strip needs only 4 vertices instead of 6, which saves a third of the data
  sent to the GPU.
- **Space partitioning**: when checking for collisions, we compare the ball to every block of the level, although most
  of them won't even come close to the ball in this frame. Space partitioning algorithms – BSP trees, quadtrees and
  octrees, k-d trees – divide the space into regions; then only the blocks in the ball's region(s) need checking. For a
  game this small that is likely overkill, but for larger games with more complicated collision detection it
  significantly increases performance.
- **Minimize state changes**: state changes (binding textures, switching shaders) are generally quite expensive, so
  avoid a large number of them. One approach is to remember the current state and only switch when a value has to
  change; another is to sort the objects by state – first everything with shader one, then everything with shader
  two, and so on, the same for textures, blend states and framebuffers.

:::opengl
These give you some hints of the tricks that can boost a 2D game's performance. They also give you a glimpse of the
power of OpenGL: by doing most of the rendering by hand, we have full control over the whole process – and thus also
complete power over how to optimize it.
:::
:::vulkan
In Vulkan, some of them look different, and Vulkan adds its own:

- **Several frames in flight**: the game records one command buffer and waits for its fence every frame, so the CPU
  waits while the GPU draws. vulkan-tutorial's *Frames in flight* chapter (`MAX_FRAMES_IN_FLIGHT`) lets the CPU record
  the next frame meanwhile – with a command buffer, a fence and a text vertex buffer per frame.
- **Batching the sprites**: each sprite is one `vkCmdDraw` with its own push constants. An instance buffer with every
  block's model matrix and colour would draw all blocks with one draw – the descriptor set per texture can stay, or a
  texture atlas makes it one.
- **A pipeline cache** (`VkPipelineCache`) stored between runs makes creating the pipelines at start-up faster.
- The state changes OpenGL makes implicit are explicit here: binding a pipeline sets all of its state at once, so
  sorting the draws by pipeline is the Vulkan form of "minimize state changes".
:::
:::d3d12
In Direct3D 12, some of them look different, and it adds its own:

- **Batching the sprites**: each sprite and particle is one draw with its own root constants – simple, but slow for
  many objects. A real game would batch them: instancing with a per-instance buffer, as in the Instancing chapter, or
  one dynamic vertex buffer per frame, like the text's.
- **Several frames in flight**: the game waits for the GPU at the end of every frame (`WaitForPreviousFrame`), so the
  CPU waits while the GPU draws. The D3D12HelloFrameBuffering sample keeps a command allocator and a fence value per
  back buffer, so the CPU records the next frame meanwhile.
- **A sprite atlas** like the glyph atlas: one texture, one descriptor table for all sprites.
- The state changes OpenGL makes implicit are explicit here: setting a pipeline state sets all of its state at once, so
  sorting the draws by pipeline state is the Direct3D 12 form of "minimize state changes".
:::

If you're not satisfied with the game's performance, feel free to take any of these as an exercise.

## Get creative

Now that you've seen how to create a simple game in {{api}}, it is up to you to create your own rendering and game
applications. Many of the techniques we've discussed so far can be used in most 2D games: sprite rendering, collision
detection, post-processing, text rendering and particles. Some ideas for Hedgerow itself: more levels and a level
editor, high scores, new power-ups, combining the effects, or sounds with one of the libraries of the Audio chapter.
It is now up to you to take these techniques, combine and modify them in whichever way you think is right, and develop
your own handcrafted game.

```quiz
Which of these is *not* one of learnopengl's suggested optimizations for a 2D game?
- [ ] Combining the textures into a sprite sheet / texture atlas
- [ ] Drawing all sprites with one instanced draw call
- [x] Rendering every sprite at a higher resolution and scaling the picture down
- [ ] Space partitioning, so the ball is only tested against blocks near it
---
Rendering at a higher resolution would cost more, not less. The others reduce texture switches, draw calls or collision tests.
```

```quiz
What does space partitioning save in the game's collision detection?
- [ ] The time to draw the blocks
- [ ] The memory of the level files
- [x] Collision tests: the ball is only tested against the blocks in its own region(s) of the window, not against every block of the level
- [ ] The time to resolve a collision once it is found
---
For one level's blocks it hardly matters; for a game with thousands of objects and expensive tests it does.
```

```quiz
Why does the course's game keep everything in one `main.cpp` of structs and free functions?
- [x] Because it is easy to follow in one file and the course's checks can read it, while learnopengl splits its game into classes and files; a real project would do the same as learnopengl
- [ ] Because {{api}} can only call free functions
- [ ] Because classes are slower than structs in C++
- [ ] Because a game must be compiled from a single file
---
In C++ a struct and a class differ only in their default access. The course follows learnopengl's code step by step, just in another form.
```

:::opengl
```quiz
learnopengl suggests minimizing state changes. What does that mean for the finished game?
- [ ] Calling `glGetError` less often
- [ ] Using fewer framebuffers
- [x] Avoiding needless `glBindTexture`, `glUseProgram` and similar calls – for example by remembering what is bound and only switching when needed, or by sorting the draws by shader and texture
- [ ] Creating every OpenGL object once at start-up
---
The game binds a texture for every sprite, also when the next block uses the same one. A state cache or sorted draws would skip those binds.
```
:::
:::vulkan
```quiz
The Vulkan game waits for the GPU every frame. What would several frames in flight change?
- [ ] The GPU would draw each frame faster
- [ ] The pictures would be smoother because frames are blended
- [ ] The validation layer would report fewer messages
- [x] The CPU could record the next frame while the GPU still draws the last one – which needs a command buffer, a fence and the buffers the CPU rewrites every frame, such as the text's vertex buffer, once per frame in flight
---
vulkan-tutorial's *Frames in flight* chapter does exactly that with `MAX_FRAMES_IN_FLIGHT = 2`. The text's vertex buffer, overwritten every frame, would then need one copy per frame.
```
:::
:::d3d12
```quiz
The Direct3D 12 game waits for the GPU at the end of every frame (`WaitForPreviousFrame`). What would several frames in flight change?
- [ ] The GPU would draw each frame faster
- [ ] The pictures would be smoother because frames are blended
- [ ] The debug layer would report fewer messages
- [x] The CPU could record the next frame while the GPU still draws the last one – which needs a command allocator and a fence value per frame, and per-frame copies of what the CPU rewrites every frame, such as the text's vertex buffer
---
The D3D12HelloFrameBuffering sample shows the pattern. Today the text buffer can be reset every frame only because the previous frame has finished.
```
:::

## Additional resources

- [Final thoughts](https://learnopengl.com/In-Practice/2D-Game/Final-thoughts): learnopengl's chapter this chapter
  follows.
- [Instancing](https://learnopengl.com/Advanced-OpenGL/Instancing): many objects with one draw call.

:::vulkan
- [Frames in flight (Vulkan Tutorial)](https://vulkan-tutorial.com/Drawing_a_triangle/Drawing/Frames_in_flight):
  recording the next frame while the GPU draws.
:::
:::d3d12
- [D3D12HelloFrameBuffering](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld/src/HelloFrameBuffering):
  several frames in flight.
:::
