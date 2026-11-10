# Ball (Hedgerow) – tasks (Vulkan)

**Screenshot time: t = 1.0 s (frame 60)** – as the OpenGL chapter (`../../opengl/ball/tasks.md`): every picture below
is frame 60 of the render loop (glfwGetTime() = 60/60), the frame verify.sh holds with `VERIFY_T=1.0` and the
simulator shows by running the loop 61 times.

learnopengl "2D Game / Ball": `ball_object.h/.cpp` (as in `progress/5.1.ball_object_collisions.*`: Radius and Stuck
only – Sticky and PassThrough come with the power-ups) and the ball parts of `progress/5.game.cpp`. Files: `main.cpp`
(= `levels`' solution with TODOs), `shaders/sprite.vert`, `shaders/sprite.frag`, `textures/`, `levels/` (unchanged).
See `../game-setup/tasks.md` for the fixed choices of the whole game (time = frame / 60, SPACE pressed in frame 30's
poll, released in frame 33's, the paddle never moves).

**Fixed choices (as OpenGL):**
- **BallObject derives from GameObject**, as in learnopengl, as a plain struct with learnopengl's default values:
  `struct BallObject : GameObject { float Radius = 12.5f; bool Stuck = true; };` (the GameObject fields come first).
  learnopengl's constructor becomes `BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity,
  VkDescriptorSet sprite)` (Size = 2 × radius, colour white – GameObject's default –, Stuck = true); the member
  functions become `void Move(BallObject& ball, float dt, unsigned int window_width)` (learnopengl returns the new
  position, which nobody uses – the course's Move returns nothing) and `void Reset(BallObject& ball, glm::vec2
  position, glm::vec2 velocity)`. The ball is drawn with `DrawObject(Ball, Renderer)` – a BallObject passed where a
  `GameObject&` is expected (its GameObject part).
- **Vulkan:** the ball's sprite is the `ball` texture's descriptor set, `GetTexture("ball").DescriptorSet` (OpenGL: the
  texture ID), like every GameObject since `levels`. Nothing else changes in the Vulkan code: the ball is one more
  `DrawSprite` (push constants model + colour, the texture's descriptor set, `vkCmdDraw(…, 6, 1, 0, 0)`) recorded in
  `recordCommandBuffer` through `Render`.
- `const glm::vec2 INITIAL_BALL_VELOCITY(100.0f, -350.0f); const float BALL_RADIUS = 12.5f;`, the global
  `BallObject Ball;` made in `Init` on top of the paddle: `playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS,
  -BALL_RADIUS * 2.0f)` = **(387.5, 555)**, size 25 × 25, texture `ball` (ball.png, RGBA).
- Draw order in `Render`: background, level, paddle, ball (71 draws for level one).
- No collisions yet: the ball flies through the bricks (they are drawn under it).

**The ball's path** (the same C++ as OpenGL, so the same floats): frames 0–29 stuck at (387.5, 555); frame 30 reads
SPACE (`Stuck = false`) and the same frame's `Update` moves it: (389.17, 549.17); then (100, −350) × 1/60 per frame.
**Frame 60 (1.0 s): Position = (439.17, 374.17)** – the ball covers x 439.2…464.2, y 374.2…399.2, centre (451.7,
386.7), on its way up to the right. (Later, without collisions: it reaches the top in frame 125, (547.5, 0), bounces
down and leaves the window at the bottom right; nothing resets it in this chapter.)

Named points (OpenGL's; from the top-left, 800×600, frame 60, measured on lavapipe): **ball** (451,386) – the ball's
centre at 1.0 s; **ball-edge** (441,386) – near its left rim; **on-paddle** (400,567) – the ball's centre while it is
stuck on the paddle; **on-paddle-top** (400,557); **paddle** (358,588) – the paddle's left brass end;
**beside-paddle** (300,590); **sky** (200,250); **hills** (400,450); **blue** (396,141), **orange** (396,29) – bricks
of column 7. **Every named point equals OpenGL's in every state.** The whole pictures are identical except the 1,886
pixels on the brick rows' edges at y = 37.5, 112.5 and 187.5 (pixel rows 37, 112, 187) explained in `levels`
(Vulkan's top-left rasterization rule gives a pixel whose centre lies exactly on an edge to the brick below).

**Start picture** (= `levels`' end): the garden, level one and the paddle, no ball: ball = 84,61,89 (background),
ball-edge = 84,61,89, on-paddle = 30,40,46, on-paddle-top = 30,40,46, paddle = 214,170,72, beside-paddle = 30,40,46,
sky = 53,44,75, hills = 46,52,74, blue = 39,118,196, orange = 196,98,0. 70 draws.

## ball-object
- **Task:** Add learnopengl's BallObject as a struct derived from `GameObject` with its own state – `Radius` (12.5) and `Stuck` (true) – and `MakeBallObject`, learnopengl's constructor.
- **Hint:** `struct BallObject : GameObject { float Radius = 12.5f; bool Stuck = true; };` – a BallObject has every GameObject field too. `MakeBallObject(pos, radius, velocity, sprite)` with `VkDescriptorSet sprite`: Size is `glm::vec2(radius * 2.0f, radius * 2.0f)`.
- **When done:** `struct BallObject : GameObject` with `float Radius = 12.5f;` and `bool Stuck = true;` after the
  GameLevel section; `BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, VkDescriptorSet
  sprite)` setting Position, Size (radius × 2 both ways), Velocity, Sprite, Radius, Stuck = true and returning the
  ball. Nothing uses them yet: no visible change (start picture).

## move-reset
- **Task:** Write `Move` (unless the ball is stuck: move it by `Velocity * dt` and bounce it off the left, right and top edges of the window) and `Reset` (put it back at a position with a velocity, stuck again).
- **Hint:** learnopengl's BallObject::Move with `ball.` instead of `this->`: at an edge reverse the velocity component and put the ball back on the edge (`Position.x = 0`, `Position.x = window_width - Size.x`, `Position.y = 0`). There is no bottom edge: the player has to catch the ball.
- **When done:** `void Move(BallObject& ball, float dt, unsigned int window_width)` – `if (!ball.Stuck)`:
  `ball.Position += ball.Velocity * dt;`, then `if (ball.Position.x <= 0.0f) { Velocity.x = -Velocity.x; Position.x =
  0.0f; } else if (ball.Position.x + ball.Size.x >= window_width) { …; Position.x = window_width - ball.Size.x; }` and
  `if (ball.Position.y <= 0.0f) { Velocity.y = -Velocity.y; Position.y = 0.0f; }`; `void Reset(BallObject& ball,
  glm::vec2 position, glm::vec2 velocity)` – Position, Velocity, `Stuck = true`. Not called yet: no visible change.

## draw-ball
- **Task:** Add the ball's constants `INITIAL_BALL_VELOCITY` (100, -350) and `BALL_RADIUS` (12.5) and a global `BallObject Ball`; in `Init` make it on top of the paddle, in its middle, with the `ball` texture; draw it in `Render` after the paddle.
- **Hint:** `glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);` `Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").DescriptorSet);` and `DrawObject(Ball, Renderer);` – the ball is a GameObject too.
- **When done:** `const glm::vec2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);`, `const float BALL_RADIUS = 12.5f;` after
  `PLAYER_VELOCITY`, `BallObject Ball;` after `GameObject Player;`, the two lines in `Init` after the player,
  `DrawObject(Ball, Renderer);` after `DrawObject(Player, Renderer);`. **The ball sits on the paddle** (x 387.5…412.5,
  y 555…580; 71 draws) – it does not move (nothing calls Move): on-paddle = 192,230,180, on-paddle-top = 212,238,196
  (the pale green glass ball); ball = 84,61,89 and everything else as the start picture.

## update
- **Task:** Move the ball every frame: call `Move` in `Update` with the window's width.
- **Hint:** `Move(Ball, dt, game.Width);`
- **When done:** `Update` holds `Move(Ball, dt, game.Width);`. **No visible change**: the ball is still stuck
  (`Stuck` stays true – nothing releases it yet), so Move does nothing: on-paddle = 192,230,180, as after `draw-ball`.

## launch
- **Task:** In `ProcessInput`, move the ball together with the paddle while it is stuck (A and D), and release it when SPACE is pressed.
- **Hint:** In both paddle branches: `Player.Position.x -= velocity; if (Ball.Stuck) Ball.Position.x -= velocity;` (with braces around the two statements). Then `if (game.Keys[GLFW_KEY_SPACE]) Ball.Stuck = false;`.
- **When done:** learnopengl's ProcessInput: in the A branch `{ Player.Position.x -= velocity; if (Ball.Stuck)
  Ball.Position.x -= velocity; }`, the same with `+=` in the D branch, and `if (game.Keys[GLFW_KEY_SPACE]) Ball.Stuck =
  false;` after them, all inside `if (game.State == GAME_ACTIVE)`. The scripted SPACE press (frame 30) releases the
  ball: **at 1.0 s it flies up to the right, at (439.17, 374.17)** (frame 60): ball = 195,231,182 (its centre),
  ball-edge = 216,239,199; the paddle is empty again: on-paddle = 30,40,46, on-paddle-top = 30,40,46; paddle =
  214,170,72, sky = 53,44,75, hills = 46,52,74, blue = 39,118,196, orange = 196,98,0 unchanged (the ball has not
  reached the bricks; it would fly through them – collisions are the next chapter). 71 draws. The picture depends on
  the time: at 0.5 s the ball is still on the paddle, at 2.0 s (frame 120) it is at (539.17, 24.17) in the orange row.
