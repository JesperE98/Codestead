# Powerups (Hedgerow) – tasks (OpenGL)

**Screenshot time: t = 3.0 s (frame 180); second check time: t = 1.5 s (frame 90)** (verify.sh `VERIFY_T=3.0` /
`1.5`; the simulator runs the loop 181 / 91 times). All APIs use these times and points.

**Why a test task:** with the course's fixed input no brick is ever destroyed (the ball bounces off the solid stone
(5, 9) in frame 86 and is lost in frame 151 – see `collision-resolution`), so no power-up ever spawns from a brick, and
SpawnPowerUps never calls rand(). The task **`try-powerups`** therefore puts one power-up of each kind into
`game.PowerUps` in Init – in learnopengl's order speed, sticky, pass-through, pad-size-increase, confuse, chaos, with
learnopengl's colours and durations, at **x = 40, 150, 260, 370, 480, 590, y = 160** (row 4, the empty row between the
blue bricks and the stones), as if six bricks had just broken there. A real game would not have these lines (the next
chapters keep them until `render-text`'s first task removes them). What then happens (measured: the real program
printing the power-ups every frame, Mesa):
- They fall at (0, 150) px/s: 2.5 px per frame from frame 1 on; at **1.5 s (frame 90) all six are at y = 385**, mid-way
  down. The ball (released in frame 30, bounced in frame 86) flies past them; it does not touch power-ups.
- In **frame 161** (y = 560 after frame 160: the power-up's bottom reaches the paddle's top, 580) the paddle (x 350…450 –
  the ball was reset onto it in frame 151) catches the **pad-size-increase** power-up (x 370…430): the paddle grows to
  150 px (x 350…500). In the same loop the **confuse** power-up (x 480…540) now overlaps the wider paddle and is caught
  too: **the screen is confused** (Duration 15 s). The pad-size one (Duration 0) is deactivated and erased in the same
  frame's UpdatePowerUps; the confuse one stays in the vector, destroyed and activated.
- The other four fall past the bottom: destroyed in frame 177 (y ≥ 600) and erased. **At 3.0 s (frame 180)**: the
  confused picture (upside down, inverted), with the 150 px paddle at the top, the ball stuck on it (at 387.5, as
  ResetPlayer put it), no power-up visible.

learnopengl "2D Game / Powerups": `power_up.h`, the power-up parts of `game.h/.cpp` (`progress/8.game.cpp`) and
`ball_object.h` (Sticky, PassThrough). Files: `main.cpp` (= `postprocessing`'s solution with TODOs), the shaders,
`textures/` (+ **`powerup_speed.png`, `powerup_sticky.png`, `powerup_pass.png`, `powerup_increase.png`,
`powerup_confuse.png`, `powerup_chaos.png`**: 512×128 RGBA light pills with a dark icon, tinted by the power-up's
colour), `levels/`. See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (all APIs):**
- `const glm::vec2 POWERUP_SIZE(60.0f, 20.0f); const glm::vec2 VELOCITY(0.0f, 150.0f);` and `struct PowerUp :
  GameObject { std::string Type; float Duration = 0.0f; bool Activated = false; };` (learnopengl's PowerUp derives
  from GameObject too), learnopengl's constructor as `PowerUp MakePowerUp(std::string type, glm::vec3 color, float
  duration, glm::vec2 position, unsigned int sprite)` (Size POWERUP_SIZE, Velocity VELOCITY), in a section `// PowerUp
  (learnopengl: power_up.h)` after BallObject. `struct Game` gains `std::vector<PowerUp> PowerUps;`, the ball `bool
  Sticky = false, PassThrough = false;` (and Reset clears them).
- The six kinds (learnopengl's): "speed" (0.5, 0.5, 1.0), 0 s, chance 1/75; "sticky" (1.0, 0.5, 1.0), 20 s, 1/75;
  "pass-through" (0.5, 1.0, 0.5), 10 s, 1/75; "pad-size-increase" (1.0, 0.6, 0.4), 0 s, 1/75; "confuse" (1.0, 0.3, 0.3),
  15 s, 1/15; "chaos" (0.9, 0.25, 0.25), 15 s, 1/15. Textures `powerup_speed`, `powerup_sticky`, `powerup_pass`,
  `powerup_increase`, `powerup_confuse`, `powerup_chaos` (learnopengl's `powerup_passthrough` is the course's
  `powerup_pass.png`), loaded with alpha after the particle texture.
- learnopengl's Game member functions as free functions in a section `// PowerUps (learnopengl: game.cpp)` after the
  globals, before the collision section: `bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)`,
  `void UpdatePowerUps(Game& game, float dt)` (move, count down, deactivate with IsOtherPowerUpActive, then
  learnopengl's `game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(), [](const PowerUp&
  powerUp) { return powerUp.Destroyed && !powerUp.Activated; }), game.PowerUps.end());`, `#include <algorithm>`),
  `bool ShouldSpawn(unsigned int chance)` (`rand() % chance == 0`), `void SpawnPowerUps(Game& game, GameObject& block)`,
  `void ActivatePowerUp(PowerUp& powerUp)` (speed: `Ball.Velocity *= 1.2f` – learnopengl writes `1.2`; sticky: Sticky
  + paddle colour (1, 0.5, 1); pass-through: PassThrough + ball colour (1, 0.5, 0.5); pad-size-increase: `Player.Size.x
  += 50`; confuse only if not chaos; chaos only if not confuse).
- DoCollisions (learnopengl's): a destroyed brick calls `SpawnPowerUps(game, box)`; the resolution is skipped for
  non-solid bricks while PassThrough (`if (!(Ball.PassThrough && !box.IsSolid))`); after the bricks a range-for over
  `game.PowerUps`: below the window → Destroyed; `CheckCollision(Player, powerUp)` (the **AABB** overload: Player is a
  GameObject) → ActivatePowerUp, Destroyed, Activated; the paddle bounce ends with `Ball.Stuck = Ball.Sticky;`.
  ResetPlayer also switches every effect off (Chaos, Confuse, PassThrough, Sticky, the colours). Update calls
  `UpdatePowerUps(game, dt);` after the particles; Render draws the power-ups that are not destroyed after the paddle
  (`for (PowerUp& powerUp : game.PowerUps) if (!powerUp.Destroyed) DrawObject(powerUp, Renderer);`).
- rand(): glibc's – but with the fixed input SpawnPowerUps never runs, so the particles' numbers are as before.
  (DirectX 12 on Windows: MSVC's rand(); here it makes no difference to the power-ups.)

Named points (from the top-left, 800×600, Mesa/llvmpipe). At 1.5 s – the pills' coloured left part, 12 px from their
left end, at the row's height y = 395: **speed** (55,395), **sticky** (165,395), **pass** (275,395), **increase**
(385,395), **confuse** (495,395), **chaos** (605,395); at their start row y = 170: **speed4** (55,170), **increase4**
(385,170), **chaos4** (605,170). At 3.0 s: **row4** (400,170), **paddle** (358,588), **paddle-wide** (480,590) – where the
150 px paddle reaches beyond the normal one; **top-paddle** (442,12) and **top-paddle-wide** (320,10) – the same two
places in the confused (mirrored) picture; **sky** (200,250); **orange** (396,29); **ball** (400,567) – the ball stuck on
the paddle.

**Start picture** (= `postprocessing`'s end): at 1.5 s the pill points show the background: speed … chaos =
86,62,90, speed4 = 38,37,69, increase4 = 38,37,69, chaos4 = 51,49,82, paddle = 214,170,72. At 3.0 s: row4 = 38,37,69,
paddle = 214,170,72, paddle-wide = 30,40,46, top-paddle = 242,121,0, top-paddle-wide = 170,85,0, sky = 53,44,75, orange
= 196,98,0, ball = 192,230,180 (the ball back on the paddle).

## `powerup-object`
- **Task:** Add the power-ups: `POWERUP_SIZE` (60, 20), `VELOCITY` (0, 150), `struct PowerUp` derived from GameObject (Type, Duration, Activated) and `MakePowerUp`; give the ball `Sticky` and `PassThrough` (cleared in Reset), the game a vector `PowerUps`; load the six power-up textures; draw every power-up that is not destroyed after the paddle.
- **Hint:** `struct PowerUp : GameObject { std::string Type; float Duration = 0.0f; bool Activated = false; };` – MakePowerUp sets Position, Size = POWERUP_SIZE, Velocity = VELOCITY, Color, Sprite, Type, Duration. `LoadTexture("textures/powerup_speed.png", true, "powerup_speed");` … (`powerup_pass.png` as `"powerup_pass"`).
- **When done:** the constants, `struct PowerUp`, `PowerUp MakePowerUp(std::string type, glm::vec3 color, float
  duration, glm::vec2 position, unsigned int sprite)`; `bool Sticky = false, PassThrough = false;` in BallObject and
  `ball.Sticky = false; ball.PassThrough = false;` in Reset; `std::vector<PowerUp> PowerUps;` in Game; six LoadTexture
  calls; the draw loop in Render after the paddle. The vector is empty: **no visible change** (start picture).

## `try-powerups`
- **Task:** Try the power-ups out (no brick breaks with the course's fixed input): in Init, after the ball, push one power-up of each kind into `game.PowerUps` at y = 160 and x = 40, 150, 260, 370, 480, 590, with learnopengl's colours and durations.
- **Hint:** `game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, glm::vec2(40.0f, 160.0f), GetTexture("powerup_speed").ID));` and the same for sticky (20 s), pass-through (10 s), pad-size-increase (0 s), confuse and chaos (15 s each).
- **When done:** the six push_back lines (with a comment saying they are a try-out) at the end of Init. **Six tinted
  pills appear in row 4** – they do not move yet (nothing updates them; 6 more draws): speed4 = 118,118,235, increase4 =
  235,141,94, chaos4 = 212,59,59 at both times; row4 (400,170) at 3.0 s = 40,24,16 (the pad-size pill's dark icon); at
  1.5 s speed … chaos (y 395) = 86,62,90 (background) – everything else as the start picture.

## `update-powerups`
- **Task:** Write `IsOtherPowerUpActive` (is another power-up of this type still active?) and `UpdatePowerUps` (move every power-up by its velocity; count an active one's Duration down and, when it is over, deactivate it and switch its effect off unless another of the same type is active; then erase the power-ups that are destroyed and not active); call it in `Update` after the particles.
- **Hint:** `powerUp.Position += powerUp.Velocity * dt;`, `if (powerUp.Activated) { powerUp.Duration -= dt; if (powerUp.Duration <= 0.0f) { powerUp.Activated = false; … } }`. The removal: `game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(), [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }), game.PowerUps.end());` (`#include <algorithm>`).
- **When done:** the two functions as described (sticky → `Ball.Sticky = false` + paddle colour white;
  pass-through → `Ball.PassThrough = false` + ball colour white; confuse → `Effects.Confuse = false`; chaos →
  `Effects.Chaos = false`), `UpdatePowerUps(game, dt);` in Update. **The pills fall**: at 1.5 s all six at y = 385:
  speed = 118,118,235, sticky = 235,118,235, pass = 118,235,118, increase = 235,141,94, confuse = 235,71,71, chaos =
  212,59,59; speed4 = 38,37,69, increase4 = 38,37,69, chaos4 = 51,49,82 (row 4 empty again). At 3.0 s they have fallen
  out of the window (y = 610; nothing destroys or erases them yet – they are drawn below the window): the 3.0 s picture
  equals the start picture.

## `activate`
- **Task:** Write `ActivatePowerUp` (switch the power-up's effect on) and, in `DoCollisions` after the bricks, check every power-up that is not destroyed: below the window → destroyed; caught by the paddle (AABB) → activated and destroyed.
- **Hint:** `if (powerUp.Position.y >= game.Height) powerUp.Destroyed = true; if (CheckCollision(Player, powerUp)) { ActivatePowerUp(powerUp); powerUp.Destroyed = true; powerUp.Activated = true; }` – `CheckCollision(Player, powerUp)` is the AABB version (two GameObjects). Confuse only if chaos is not active, and the other way round.
- **When done:** `void ActivatePowerUp(PowerUp& powerUp)` (above) and the power-up loop before the paddle bounce in
  DoCollisions (its comment now `// and finally check collisions for player pad`). 1.5 s: unchanged (as after
  `update-powerups`). **3.0 s: the paddle caught pad-size-increase and then confuse in frame 161 – the confused picture
  with a 150 px paddle**: top-paddle = 41,85,183 and top-paddle-wide = 41,85,183 (the wide paddle, mirrored to the top),
  paddle = 23,139,255, paddle-wide = 120,187,255, row4 = 209,203,181, sky = 180,199,170, orange = 95,39,102, ball =
  62,158,255 (all inverted colours of the mirrored points).

## `spawn-powerups`
- **Task:** Write `ShouldSpawn` (true with a chance of 1 in `chance`) and `SpawnPowerUps` (each kind with its own chance – 1 in 75, the negative confuse and chaos 1 in 15 – at the block's position); call it in DoCollisions when a brick is destroyed.
- **Hint:** `unsigned int random = rand() % chance; return random == 0;` – `if (ShouldSpawn(75)) game.PowerUps.push_back(MakePowerUp("speed", …, block.Position, GetTexture("powerup_speed").ID));` … In DoCollisions: `if (!box.IsSolid) { box.Destroyed = true; SpawnPowerUps(game, box); } else { …shake… }`.
- **When done:** the two functions and the call (braces around the two statements). With the fixed input no brick is
  destroyed, so nothing spawns and rand() is not called: **no visible change** at either time (as after `activate`).
  Checked in the code.

## `sticky-pass`
- **Task:** Make the sticky and pass-through power-ups work: a sticky paddle keeps the ball (`Ball.Stuck = Ball.Sticky;` after the paddle bounce), pass-through skips the bounce on non-solid bricks; and ResetPlayer switches every power-up effect off.
- **Hint:** Wrap the resolution in `if (!(Ball.PassThrough && !box.IsSolid)) { … }`. ResetPlayer: `Effects.Chaos = Effects.Confuse = false; Ball.PassThrough = Ball.Sticky = false; Player.Color = glm::vec3(1.0f); Ball.Color = glm::vec3(1.0f);`
- **When done:** learnopengl's three changes (above). The ball is reset in frame 151, before the power-ups are caught
  (frame 161), and it never meets a brick it could pass or the paddle it could stick to: **no visible change** at either
  time (the 3.0 s picture stays confused). Checked in the code.
