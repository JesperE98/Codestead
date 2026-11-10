# The 2D Game: Hedgerow

Over the course of the chapters so far we largely focused on the details of {{api}}: how it works and how to use it to
create all kinds of fancy rendering effects. Aside from a few technical demos, we haven't really utilized {{api}} in an
actual application. This is the purpose of the next chapters: building a small but complete 2D game from scratch.

learnopengl does this with a clone of a famous arcade game of the 1970s. The course does not rebuild that game: it
builds **its own game of the same kind**, called **Hedgerow**, with the course's own pictures and levels. The genre is
an old one – a ball, a paddle and a wall of blocks – and every technique and every step of learnopengl's chapters
stays; only the name, the art and the levels are the course's own. Where the text says "learnopengl's game", it means
learnopengl's version.

This chapter has no tasks. It describes the game and the road to it; its project is the one you will work in next,
and you can build and run it at the end.

## Hedgerow

Hedgerow plays in a garden at dusk. The background is a night sky that grows lighter towards the horizon, with a full
moon in the upper right, a line of hills and a row of round hedges at the bottom. In the upper half of the window
hangs the hedge you are going to clear: a wall of blocks, each a light tile tinted in its colour – orange, yellow,
green, blue – and here and there a block of grey stone. At the bottom sits the player's paddle, a wooden bar with brass
ends.

- The paddle moves left and right with **A** and **D**, as far as the edges of the window.
- A pale green **ball** sits on the paddle at the start of each try; **space** launches it upwards.
- The ball bounces off the left, right and top edges of the window, off the paddle and off the blocks. Where it hits
  the paddle decides the angle it leaves at, so the player can aim.
- A coloured block that is hit is **destroyed**. The stone blocks are **solid**: the ball bounces off them, but they
  never break.
- When every block that can be destroyed is gone, the level is complete. There are **four levels**, each a small text
  file of numbers that says which block goes where.
- When the ball falls past the paddle, out of the bottom of the window, the try is lost: the ball returns to the
  paddle (later in the part, with a limited number of lives).
- Destroyed blocks sometimes drop a **power-up**, which falls down and has to be caught with the paddle: a faster ball,
  a sticky paddle that holds the ball, a ball that passes through blocks, a wider paddle – and two that make the game
  harder by distorting the whole picture.

The game ends up with a menu to pick a level, a message when you win, a trail of particles behind the ball, a few
post-processing effects (the screen shakes when the ball hits a stone), text for the lives and the menu, and – in
learnopengl's version – sound.

## What the game uses, and what it adds

Most of what the game needs, you have already learned. The game is a good way to see it all come together:

- **Textures** (Getting Started): every object on the screen is a textured quad – a *sprite*.
- **Transformations and an orthographic projection** (Getting Started): sprites are moved, scaled and rotated with a
  model matrix, and an orthographic projection maps the game's coordinates – pixels – to the window.
- **Blending** (Advanced OpenGL): the ball, the paddle and the power-ups have transparent parts.
- **Framebuffers** (Advanced OpenGL): the post-processing effects render the game into a texture first and then draw
  that texture to the screen with a shader that shakes, mirrors or blurs it.
- **Text rendering** (the previous chapter): the lives counter and the menu.

What the game adds is the part that makes it a game rather than a picture:

- a **game loop** that updates the game state every frame by the time that has passed (*delta time*), so the game runs
  at the same speed on any computer;
- **input**, read from the keyboard into the game's state;
- **collision detection and resolution**: finding out whether the ball overlaps a block or the paddle, and how it
  bounces off;
- **particles**: many small, short-lived sprites (here drawn one by one, without instancing);
- **game states** – playing, the menu, the win screen – and **levels** loaded from files.

None of this is specific to an API. A game loop, input and collision detection are plain C++; drawing a sprite is the
same quad in every API. The chapters show how {{api}} draws them.

## The chapters ahead

The game is built over these chapters, each adding one piece; the first three come right after this one:

1. **Setting up** – the structure of the program: the game's state, the game loop with delta time, the keyboard input,
   and the functions that load and keep the shaders and textures.
2. **Rendering Sprites** – the orthographic projection and the sprite renderer: one textured quad, drawn anywhere at
   any size and angle.
3. **Levels** – the game objects, the level files, the background, the first level and the paddle.
4. **Ball**, **Collision detection** and **Collision resolution** – the ball, and how it hits and bounces off things.
5. **Particles**, **Postprocessing** and **Powerups** – the trail behind the ball, the effects, the power-ups.
6. **Audio**, **Render text** and **Final thoughts** – sound, the menu and the lives, and a look back.

## How the course writes the game

learnopengl splits its game into classes, each in its own header and source file: `Game`, `ResourceManager`, `Shader`,
`Texture2D`, `SpriteRenderer`, `GameObject`, `GameLevel` and later more. That is how a real project should be
organised. The course keeps the names of those classes and of their functions, but writes them as **plain structs and
free functions, all in one `main.cpp`**, in the order of learnopengl's files – the built-in simulator follows plain
structs and free functions. A member function like learnopengl's `Renderer->DrawSprite(…)` becomes a free function
that takes the struct as its first parameter, `DrawSprite(Renderer, …)`. The next chapter shows the details.

The game also has to be **deterministic** in the course, so that every API, every driver and the simulator show the
same picture for the same moment: the game's time advances by exactly 1/60 of a second per frame, and the only key ever
"pressed" by itself is the space bar, half a second after the start. The next chapter explains how.

:::opengl
## The project

The project is the start of the next chapter: one `main.cpp` that opens an 800 × 600 window titled "Hedgerow" (not
resizable) with an OpenGL 3.3 core context, switches blending on and clears the window to black in its render loop.
The rest are `// TODO:` sections for the game, in the order of learnopengl's files: Shader, Texture2D,
ResourceManager, Game and the program.
:::
:::vulkan
## The project

The project is the start of the next chapter: one `main.cpp` with vulkan-tutorial's `HelloTriangleApplication` and
everything the earlier chapters built – the instance with the validation layer, the swap chain, a render pass with one
colour attachment (a 2D game needs no depth buffer), the descriptor set layout (a uniform buffer at binding 0, a
texture at binding 1), the pipeline layout with push constants for the sprites, the `createPipeline` helper, the texture
helpers, the uniform buffer and a descriptor pool with room for 16 textures. It opens an 800 × 600 window titled
"Hedgerow" and clears it to black. The game's parts are `// TODO:` sections next to the class, in the order of
learnopengl's files: Texture2D, ResourceManager, Game and the key callback.
:::
:::d3d12
## The project

The project is the start of the next chapter: one `main.cpp` with the Direct3D 12 application class of the earlier
chapters (`D3D12App` with `LoadPipeline`, `LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList`,
`WaitForPreviousFrame`). It opens an 800 × 600 window titled "Hedgerow" that cannot be resized and clears it to
black. It already has `GraphicsContext Graphics`, a struct with the Direct3D 12 objects the game's functions will
create resources and draw with (the next chapter explains it). The game's parts are `// TODO:` sections, in the order of
learnopengl's files: Shader, Texture2D, ResourceManager, Game and the program.
:::

Press **Build & run** (Ctrl+Enter): the project is compiled and run in the built-in simulator, and you see an empty,
black window. That is all learnopengl's "Setting up" draws, too – the next chapter builds the skeleton that every later
chapter hangs its pieces on.

```quiz
When is a level of Hedgerow complete?
- [ ] When the ball has hit every block once
- [x] When every block that can be destroyed is gone – the solid stone blocks stay and don't count
- [ ] When the player has caught a power-up
- [ ] When the ball has bounced off the top of the window
---
The solid blocks are obstacles: the ball bounces off them but never breaks them. A level is complete when only they are left.
```

```quiz
Why does the game advance its state by the time each frame took (delta time) instead of by a fixed step per frame?
- [ ] Because the GPU can only draw a frame when the time has changed
- [ ] Because collision detection needs the time in seconds
- [x] So that the ball and the paddle move at the same speed in pixels per second whether the computer renders 30 or 300 frames per second
- [ ] Because a fixed step per frame would make the game deterministic
---
A speed of 500 pixels per second times a frame time of 1/60 s moves the paddle 8.3 pixels in that frame; at 1/120 s, half as far, twice as often. The course then makes the frame time itself fixed (1/60) so that the pictures can be compared.
```

```quiz
Which of these does the game need that the earlier parts of the course did not teach?
- [ ] Textured quads
- [ ] An orthographic projection
- [ ] Blending of transparent parts
- [x] Collision detection: whether the ball overlaps a block or the paddle, and how it bounces off
---
Textures, transformations, blending, framebuffers and text you know. The game loop, input, collision detection and resolution, particles and the game's states are what these chapters add.
```

```quiz
How does the course write learnopengl's game classes like `SpriteRenderer` with its member function `DrawSprite`?
- [ ] As C++ classes in their own files, exactly like learnopengl
- [x] As plain structs with free functions in one `main.cpp`, with learnopengl's names: `DrawSprite(Renderer, …)` takes the struct as its first parameter
- [ ] As one big `Game` class that holds all functions
- [ ] As shader code: the sprite renderer runs on the GPU
---
The names and the steps stay learnopengl's, so you can compare the code with learnopengl's at every step. A real project would split the code into classes and files as learnopengl does.
```

## Additional resources

- [Setting up](https://learnopengl.com/In-Practice/2D-Game/Setting-up): learnopengl's first chapter of code for its 2D
  game, the next chapter of the course; learnopengl's chapter before it introduces its game.
- [LearnOpenGL source code: the 2D game](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengl's complete game, with the state of the code after each chapter in `0.full_source/progress`.

:::vulkan
- [Vulkan Tutorial](https://vulkan-tutorial.com/): the application class the Vulkan version keeps.
:::
:::d3d12
- [D3D12HelloWorld samples](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld):
  the application class the Direct3D 12 version keeps.
:::
