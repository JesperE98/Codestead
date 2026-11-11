# Powerups (Hedgerow) – tasks (DirectX 12)

**Screenshot time: t = 3.0 s (frame 180); second check time: t = 1.5 s (frame 90)** – OpenGL's
(projects/opengl/powerups/tasks.md): the 181st / 91st `OnUpdate` + `OnRender` (frame n's clock reads n / 60 s; SPACE as
`OnKeyDown(VK_SPACE)` before frame 30's `OnUpdate`, `OnKeyUp` before frame 33's – see `../game-setup/tasks.md`).

**Why a test task** (as OpenGL): with the course's fixed input no brick is ever destroyed (the ball bounces off the
solid stone (5, 9) in frame 86 and is lost in frame 151), so no power-up spawns from a brick and SpawnPowerUps never
calls rand(). The task **`try-powerups`** puts one power-up of each kind into `game.PowerUps` in Init – speed, sticky,
pass-through, pad-size-increase, confuse, chaos, with learnopengl's colours and durations, at **x = 40, 150, 260, 370,
480, 590, y = 160** (row 4). A real game would not have these lines (`render-text`'s first task removes them). Then:
they fall at (0, 150) px/s; at **1.5 s all six are at y = 385**; in **frame 161** the paddle (the ball was reset onto
it in frame 151) catches **pad-size-increase** (the paddle grows to 150 px) and, in the same loop, **confuse**: **the
screen is confused** (15 s); the other four fall out of the window (destroyed in frame 177, erased). **At 3.0 s**: the
confused picture (upside down, inverted), the 150 px paddle at the top, the ball stuck on it.

learnopengl "2D Game / Powerups": `power_up.h`, the power-up parts of `game.h/.cpp` (`progress/8.game.cpp`) and
`ball_object.h` (Sticky, PassThrough). Files: `main.cpp` (= `postprocessing`'s solution with TODOs), the shaders,
`textures/` (+ **`powerup_speed.png`, `powerup_sticky.png`, `powerup_pass.png`, `powerup_increase.png`,
`powerup_confuse.png`, `powerup_chaos.png`**, 512×128 RGBA, tinted by the power-up's colour), `levels/`.

**The same as OpenGL** (structs, functions, sections, numbers, task ids, points – the code is OpenGL's with
DirectXMath types):
- `const XMFLOAT2 POWERUP_SIZE(60.0f, 20.0f); const XMFLOAT2 VELOCITY(0.0f, 150.0f);`, `struct PowerUp : GameObject {
  std::string Type; float Duration = 0.0f; bool Activated = false; };`, `PowerUp MakePowerUp(std::string type, XMFLOAT3
  color, float duration, XMFLOAT2 position, unsigned int sprite)` in a section `// PowerUp (learnopengl: power_up.h)`
  after BallObject; `std::vector<PowerUp> PowerUps;` in Game; the ball's `bool Sticky = false, PassThrough = false;`
  (cleared in Reset).
- The six kinds with learnopengl's colours, durations and chances (1 in 75; confuse and chaos 1 in 15), textures
  `powerup_speed` … `powerup_pass` loaded with alpha after the particle texture (heap slots 7 … 12; the postprocessor's texture moves to slot 13).
- learnopengl's Game member functions as free functions in `// PowerUps (learnopengl: game.cpp)` after the globals:
  `IsOtherPowerUpActive`, `UpdatePowerUps` (with `game.PowerUps.erase(std::remove_if(…, [](const PowerUp& powerUp) {
  return powerUp.Destroyed && !powerUp.Activated; }), game.PowerUps.end());`, `#include <algorithm>`), `ShouldSpawn`,
  `SpawnPowerUps`, `ActivatePowerUp`; DoCollisions' power-up loop (the **AABB** `CheckCollision(Player, powerUp)`),
  `Ball.Stuck = Ball.Sticky;`, the pass-through condition, ResetPlayer switching every effect off; Update calls
  `UpdatePowerUps(game, dt);` after the particles; Render draws the power-ups that are not destroyed after the paddle.
- DirectXMath: the vector steps load, compute and store – `XMStoreFloat2(&powerUp.Position,
  XMLoadFloat2(&powerUp.Position) + XMLoadFloat2(&powerUp.Velocity) * dt);` and the speed power-up's
  `XMStoreFloat2(&Ball.Velocity, XMLoadFloat2(&Ball.Velocity) * 1.2f);` (learnopengl's `Ball->Velocity *= 1.2`); white is
  `XMFLOAT3(1.0f, 1.0f, 1.0f)` (glm's `vec3(1.0f)`).
- **rand()**: SpawnPowerUps uses rand() – with the fixed input it never runs. On Windows a Direct3D 12 program gets
  MSVC's rand() (another sequence, RAND_MAX 32767): in a real game other power-ups would spawn than with glibc's; the
  course's pictures do not depend on it.

Named points (OpenGL's, from the top-left, 800×600). At 1.5 s: **speed** (55,395), **sticky** (165,395), **pass**
(275,395), **increase** (385,395), **confuse** (495,395), **chaos** (605,395); **speed4** (55,170), **increase4**
(385,170), **chaos4** (605,170). At 3.0 s: **row4** (400,170), **paddle** (358,588), **paddle-wide** (480,590),
**top-paddle** (442,12), **top-paddle-wide** (320,10), **sky** (200,250), **orange** (396,29), **ball** (400,567). Pixel
values are OpenGL's (Mesa); the simulator's Direct3D 12 pictures equal them.

**Start picture** (= `postprocessing`'s end): at 1.5 s the pill points show the background: speed … chaos = 86,62,90,
speed4 = 38,37,69, increase4 = 38,37,69, chaos4 = 51,49,82, paddle = 214,170,72. At 3.0 s: row4 = 38,37,69, paddle =
214,170,72, paddle-wide = 30,40,46, top-paddle = 242,121,0, top-paddle-wide = 170,85,0, sky = 53,44,75, orange =
196,98,0, ball = 192,230,180.

## powerup-object
- **Task:** Add the power-ups: `POWERUP_SIZE` (60, 20), `VELOCITY` (0, 150), `struct PowerUp` derived from GameObject
  (Type, Duration, Activated) and `MakePowerUp`; give the ball `Sticky` and `PassThrough` (cleared in Reset), the game a
  vector `PowerUps`; load the six power-up textures; draw every power-up that is not destroyed after the paddle.
- **Hint:** `struct PowerUp : GameObject { std::string Type; float Duration = 0.0f; bool Activated = false; };` –
  MakePowerUp sets Position, Size = POWERUP_SIZE, Velocity = VELOCITY, Color, Sprite, Type, Duration.
  `LoadTexture("textures/powerup_speed.png", true, "powerup_speed");` … (`powerup_pass.png` as `"powerup_pass"`).
- **Observable:** the constants, `struct PowerUp`, `PowerUp MakePowerUp(std::string type, XMFLOAT3 color, float
  duration, XMFLOAT2 position, unsigned int sprite)`; `bool  Sticky = false, PassThrough = false;` in BallObject and
  `ball.Sticky = false; ball.PassThrough = false;` in Reset; `std::vector<PowerUp>    PowerUps;` in Game; six LoadTexture
  calls; the draw loop in Render after the paddle. The vector is empty: **no visible change** (start picture).

## try-powerups
- **Task:** Try the power-ups out (no brick breaks with the course's fixed input): in Init, after the ball, push one
  power-up of each kind into `game.PowerUps` at y = 160 and x = 40, 150, 260, 370, 480, 590, with learnopengl's colours
  and durations.
- **Hint:** `game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, XMFLOAT2(40.0f, 160.0f),
  GetTexture("powerup_speed").ID));` and the same for sticky (20 s), pass-through (10 s), pad-size-increase (0 s),
  confuse and chaos (15 s each).
- **Observable:** the six push_back lines (with a comment saying they are a try-out) at the end of Init. **Six tinted
  pills appear in row 4** – they do not move yet (6 more draws): speed4 = 118,118,235, increase4 = 235,141,94, chaos4 =
  212,59,59 at both times; row4 (400,170) at 3.0 s = 40,24,16; at 1.5 s speed … chaos (y 395) = 86,62,90 – everything
  else as the start picture.

## update-powerups
- **Task:** Write `IsOtherPowerUpActive` and `UpdatePowerUps` (move every power-up by its velocity; count an active
  one's Duration down and, when it is over, deactivate it and switch its effect off unless another of the same type is
  active; then erase the power-ups that are destroyed and not active); call it in `Update` after the particles.
- **Hint:** `XMStoreFloat2(&powerUp.Position, XMLoadFloat2(&powerUp.Position) + XMLoadFloat2(&powerUp.Velocity) * dt);`,
  `if (powerUp.Activated) { powerUp.Duration -= dt; if (powerUp.Duration <= 0.0f) { powerUp.Activated = false; … } }`.
  The removal: `game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(), [](const PowerUp&
  powerUp) { return powerUp.Destroyed && !powerUp.Activated; }), game.PowerUps.end());` (`#include <algorithm>`).
- **Observable:** `#include <algorithm>`; the two functions (sticky → `Ball.Sticky = false` + paddle colour white;
  pass-through → `Ball.PassThrough = false` + ball colour white; confuse → `Effects.Confuse = false`; chaos →
  `Effects.Chaos = false`), `UpdatePowerUps(game, dt);` in Update. **The pills fall**: at 1.5 s all six at y = 385:
  speed = 118,118,235, sticky = 235,118,235, pass = 118,235,118, increase = 235,141,94, confuse = 235,71,71, chaos =
  212,59,59; speed4 = 38,37,69, increase4 = 38,37,69, chaos4 = 51,49,82. At 3.0 s they are below the window (nothing
  destroys them yet): the 3.0 s picture equals the start picture.

## activate
- **Task:** Write `ActivatePowerUp` (switch the power-up's effect on) and, in `DoCollisions` after the bricks, check
  every power-up that is not destroyed: below the window → destroyed; caught by the paddle (AABB) → activated and
  destroyed.
- **Hint:** `if (powerUp.Position.y >= game.Height) powerUp.Destroyed = true; if (CheckCollision(Player, powerUp)) {
  ActivatePowerUp(powerUp); powerUp.Destroyed = true; powerUp.Activated = true; }` – the AABB version (two
  GameObjects). Speed: `XMStoreFloat2(&Ball.Velocity, XMLoadFloat2(&Ball.Velocity) * 1.2f);`. Confuse only if chaos is
  not active, and the other way round.
- **Observable:** `void ActivatePowerUp(PowerUp& powerUp)` and the power-up loop before the paddle bounce in
  DoCollisions (its comment now `// and finally check collisions for player pad`). 1.5 s: unchanged. **3.0 s: the paddle
  caught pad-size-increase and then confuse in frame 161 – the confused picture with a 150 px paddle**: top-paddle =
  41,85,183, top-paddle-wide = 41,85,183, paddle = 23,139,255, paddle-wide = 120,187,255, row4 = 209,203,181, sky =
  180,199,170, orange = 95,39,102, ball = 62,158,255.

## spawn-powerups
- **Task:** Write `ShouldSpawn` (true with a chance of 1 in `chance`) and `SpawnPowerUps` (each kind with its own chance –
  1 in 75, the negative confuse and chaos 1 in 15 – at the block's position); call it in DoCollisions when a brick is
  destroyed.
- **Hint:** `unsigned int random = rand() % chance; return random == 0;` – `if (ShouldSpawn(75))
  game.PowerUps.push_back(MakePowerUp("speed", …, block.Position, GetTexture("powerup_speed").ID));` … In DoCollisions:
  `if (!box.IsSolid) { box.Destroyed = true; SpawnPowerUps(game, box); } else { …shake… }`.
- **Observable:** the two functions and the call (braces around the two statements). With the fixed input no brick is
  destroyed, so nothing spawns: **no visible change** at either time. Checked in the code.

## sticky-pass
- **Task:** Make the sticky and pass-through power-ups work: a sticky paddle keeps the ball (`Ball.Stuck =
  Ball.Sticky;` after the paddle bounce), pass-through skips the bounce on non-solid bricks; and ResetPlayer switches
  every power-up effect off.
- **Hint:** Wrap the resolution in `if (!(Ball.PassThrough && !box.IsSolid)) { … }`. ResetPlayer: `Effects.Chaos =
  Effects.Confuse = false; Ball.PassThrough = Ball.Sticky = false; Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f); Ball.Color
  = XMFLOAT3(1.0f, 1.0f, 1.0f);`
- **Observable:** learnopengl's three changes. **No visible change** at either time (the 3.0 s picture stays confused).
  Checked in the code.
