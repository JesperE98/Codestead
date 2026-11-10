# Collision resolution (Hedgerow) – tasks (DirectX 12)

**Screenshot time: t = 2.0 s (frame 120)** – OpenGL's (projects/opengl/collision-resolution/tasks.md): frame 120 is
the 121st `OnUpdate` + `OnRender` (frame n's clock reads n / 60 s; SPACE as `OnKeyDown(VK_SPACE)` before frame 30's
`OnUpdate`, `OnKeyUp` before frame 33's – see `../game-setup/tasks.md`). At 2.0 s the ball is on its way down after
bouncing off a stone. **Second check time for `lose-ball` only: t = 3.0 s (frame 180)** – the ball has been lost
(frame 151) and is back on the paddle; the 3.0 s values are given for every state.

learnopengl "2D Game / Collisions / Collision resolution": `game.h` (`enum Direction`, `typedef std::tuple<bool,
Direction, glm::vec2> Collision`), `VectorDirection`, the tuple-returning `CheckCollision(BallObject&, GameObject&)`,
`Game::DoCollisions` with the resolution and the paddle, `Game::ResetLevel` / `ResetPlayer` and the loss condition in
`Game::Update` (`progress/5.game.cpp`). Files: `main.cpp` (= `collision-detection`'s solution with TODOs),
`sprite.hlsl`, `textures/`, `levels/` (unchanged).

**The same as OpenGL** (functions, order, task ids, points):
- `enum Direction { UP, RIGHT, DOWN, LEFT };` and `typedef std::tuple<bool, Direction, XMFLOAT2> Collision;` after
  `enum GameState` (learnopengl's game.h), `#include <tuple>`. `Collision CheckCollision(BallObject& one, GameObject&
  two)` returns `std::make_tuple(true, VectorDirection(diff), diff)` or `std::make_tuple(false, UP, XMFLOAT2(0.0f,
  0.0f))`; DoCollisions reads it with `std::get<0>`, `std::get<1>`, `std::get<2>`.
- `Direction VectorDirection(XMFLOAT2 target)` as learnopengl: the local array `XMFLOAT2 compass[] = { (0, 1) up,
  (1, 0) right, (0, -1) down, (-1, 0) left }`, `unsigned int best_match = -1;`, the loop keeping the largest dot
  product of the normalised target with `compass[i]`, `return (Direction)best_match;` – defined between the AABB
  CheckCollision and the circle one (which calls it). learnopengl's naming is in screen coordinates (y down):
  `difference = closest - center`, so a ball hitting a brick from **below** gets (0, −r) → `DOWN`, and the resolution
  then moves the ball down ("move ball back down"); the names describe the vector, not the side of the brick.
- Resolution, paddle bounce (learnopengl's, with `std::abs` – learnopengl's plain `abs(…)` on a float can resolve to
  the C function `int abs(int)`, which truncates; `#include <cmath>` declares the float overloads), `void
  ResetLevel(Game& game)` and `void ResetPlayer(Game& game)` after DoCollisions, before Init; `Update`: Move,
  DoCollisions, then `if (Ball.Position.y >= game.Height) { ResetLevel(game); ResetPlayer(game); }`.

**Direct3D 12 specifics** (DirectXMath: XMFLOAT2 stores, XMVECTOR computes):
- The tuple holds the difference vector as an `XMFLOAT2` (the storage type – an XMVECTOR member needs 16-byte alignment
  that a std::tuple does not promise on every platform): `XMFLOAT2 diff; XMStoreFloat2(&diff, difference); return
  std::make_tuple(true, VectorDirection(diff), diff);`.
- VectorDirection's dot product: `float dot_product = XMVectorGetX(XMVector2Dot(XMVector2Normalize(XMLoadFloat2(&target)),
  XMLoadFloat2(&compass[i])));` (`XMVector2Dot` returns the dot product in every component).
- The paddle keeps the speed with `XMVECTOR oldVelocity = XMLoadFloat2(&Ball.Velocity);` and
  `XMStoreFloat2(&Ball.Velocity, XMVector2Normalize(XMLoadFloat2(&Ball.Velocity)) * XMVector2Length(oldVelocity));`
  (learnopengl's `glm::normalize(Ball->Velocity) * glm::length(oldVelocity)`).
- ResetPlayer's ball position per component: `XMFLOAT2(Player.Position.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS,
  Player.Position.y - BALL_RADIUS * 2.0f)`.

**The ball's path with resolution** (OpenGL's measurements; the Direct3D 12 code computes the same – checked with the
game code compiled natively with DirectXMath and run frame by frame): released in frame 30 as before; in **frame 86**
its circle reaches the solid stone (5, 9) (row 5, column 9: x 480…533, y 187.5…225) from below – direction DOWN – so
it bounces: Position (482.50, 225.00), Velocity (100, 350). **Frame 120 (2.0 s): Position = (539.17, 423.33)**,
centre (551.7, 435.8), on its way down to the right. It misses the paddle (x 350…450 – the paddle never moves),
leaves the window: frame 150 at (589.17, 598.33), and in **frame 151** `Position.y >= 600` resets the level and the
player: the ball is stuck on the paddle again at (387.5, 555) and stays there (SPACE is pressed only once). No brick
is destroyed (the stone is solid; the ball meets no other brick). With the course's fixed input the paddle bounce
never happens: it is checked in the code.

Named points (OpenGL's, from the top-left, 800×600): **ball** (551,435) – the ball's centre at 2.0 s (with
resolution); **ball-up** (551,36) – the ball's centre at 2.0 s without resolution; **on-paddle** (400,567);
**orange-gone** (560,18) – brick (0, 10); **yellow-gone** (506,66) – (1, 9); **blue-gone** (506,141) – (3, 9);
**blue** (396,141) – (3, 7); **stone** (506,206) – the solid stone (5, 9); **below-stone** (506,240); **paddle**
(358,588); **sky** (200,250); and at 3.0 s also **ball-3s** (651,333). Pixel values are OpenGL's (Mesa).

**Start picture** (= `collision-detection`'s end, at 2.0 s): the ball has destroyed 7 bricks – (3, 9), (3, 10),
(2, 9), (2, 10), (1, 9), (1, 10), (0, 10) – and is at the top of its channel, (539.17, 24.17): ball = 46,52,74 (hills),
ball-up = 195,231,182 (the ball), on-paddle = 30,40,46, orange-gone = 24,30,64, yellow-gone = 26,30,64, blue-gone =
35,35,68, blue = 39,118,196, stone = 132,132,116, below-stone = 51,43,74, paddle = 214,170,72, sky = 53,44,75. 64 draws.
At 3.0 s: 10 bricks gone (see collision-detection), ball-3s = 194,230,181, ball = 46,52,74, ball-up = 26,31,65,
on-paddle = 30,40,46.

## direction
- **Task:** Add `enum Direction` (UP, RIGHT, DOWN, LEFT) and `VectorDirection`, which returns the direction a vector
  points to most: the one of the four compass vectors with the largest dot product with the normalised vector.
- **Hint:** `XMFLOAT2 compass[] = { XMFLOAT2(0.0f, 1.0f), XMFLOAT2(1.0f, 0.0f), XMFLOAT2(0.0f, -1.0f),
  XMFLOAT2(-1.0f, 0.0f) };` in that order (up, right, down, left – the enum's order), then loop over the four with
  `XMVectorGetX(XMVector2Dot(XMVector2Normalize(XMLoadFloat2(&target)), XMLoadFloat2(&compass[i])))`.
- **Observable:** `enum Direction { UP, RIGHT, DOWN, LEFT };` after `enum GameState`; `Direction
  VectorDirection(XMFLOAT2 target)` as described above, before the circle CheckCollision. Not used yet: **no visible
  change** (start picture, at 2.0 s and 3.0 s).

## collision-tuple
- **Task:** Make the circle `CheckCollision` return more than yes/no: a `Collision` tuple of (collision?, its
  direction, the difference vector); `DoCollisions` reads the first element.
- **Hint:** `#include <tuple>`, `typedef std::tuple<bool, Direction, XMFLOAT2> Collision;` after `enum Direction`. Store
  the difference (`XMFLOAT2 diff; XMStoreFloat2(&diff, difference);`), then `return std::make_tuple(true,
  VectorDirection(diff), diff);` or `std::make_tuple(false, UP, XMFLOAT2(0.0f, 0.0f));`. In DoCollisions: `Collision
  collision = CheckCollision(Ball, box); if (std::get<0>(collision)) …`.
- **Observable:** `#include <tuple>`; the typedef; `Collision CheckCollision(BallObject& one, GameObject& two)` ending
  in `if (XMVectorGetX(XMVector2Length(difference)) < one.Radius) { XMFLOAT2 diff; XMStoreFloat2(&diff, difference);
  return std::make_tuple(true, VectorDirection(diff), diff); } else return std::make_tuple(false, UP, XMFLOAT2(0.0f,
  0.0f));`; in DoCollisions `Collision collision = CheckCollision(Ball, box);` and `if (std::get<0>(collision)) // if
  collision is true`. Same detection: **no visible change** (start picture, pixel for pixel).

## resolve
- **Task:** Resolve each brick collision: reverse the ball's velocity component in the collision's direction (x for
  LEFT/RIGHT, y for UP/DOWN) and move the ball out of the brick by how far it went in (`Radius` minus the difference
  vector's component).
- **Hint:** `Direction dir = std::get<1>(collision); XMFLOAT2 diff_vector = std::get<2>(collision);` – `if (dir == LEFT
  || dir == RIGHT) { Ball.Velocity.x = -Ball.Velocity.x; float penetration = Ball.Radius - std::abs(diff_vector.x); if
  (dir == LEFT) Ball.Position.x += penetration; else Ball.Position.x -= penetration; } else { … y, UP: -=, DOWN: += … }`.
  `std::abs` of a float needs `#include <cmath>`.
- **Observable:** `#include <cmath>`; learnopengl's resolution block inside `if (std::get<0>(collision))`, after the
  brick is destroyed (with the comment `// destroy block if not solid`). **The ball bounces off the solid stone (5, 9)
  in frame 86** and no brick is destroyed: at 2.0 s **ball = 196,231,183** (the ball coming down at (539.17, 423.33)),
  ball-up = 158,79,0 (the orange brick (0, 10) is there again), orange-gone = 209,105,0, yellow-gone = 161,161,80,
  blue-gone = 40,121,201 (all bricks back – 71 draws), blue = 39,118,196, stone = 132,132,116, below-stone = 51,43,74,
  on-paddle = 30,40,46, paddle = 214,170,72, sky = 53,44,75. At 3.0 s the ball has left the window at the bottom
  (nothing resets it yet): ball-3s = 71,54,83 (background), on-paddle = 30,40,46 – no ball anywhere; all bricks there.

## paddle
- **Task:** After the bricks, test the ball against the paddle (unless it is stuck): bounce it up, sideways by where it
  hit – `percentage` of the half paddle from its centre, times `strength` 2 – keeping its speed.
- **Hint:** `float distance = (Ball.Position.x + Ball.Radius) - centerBoard; float percentage = distance /
  (Player.Size.x / 2.0f);` `Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;` then the old speed:
  `XMStoreFloat2(&Ball.Velocity, XMVector2Normalize(XMLoadFloat2(&Ball.Velocity)) * XMVector2Length(oldVelocity));` and
  always up: `Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);` (the ball can be inside the paddle for more than
  one frame – learnopengl's "sticky paddle").
- **Observable:** `Collision result = CheckCollision(Ball, Player); if (!Ball.Stuck && std::get<0>(result)) { … }`
  with learnopengl's lines (`XMVECTOR oldVelocity = XMLoadFloat2(&Ball.Velocity);` …) at the end of DoCollisions.
  **No visible change** (the ball never meets the paddle with the course's input: it comes down at x ≈ 576, the paddle
  is at 350…450): the same as after `resolve`, at 2.0 s and at 3.0 s. Checked in the code.

## lose-ball
- **Task:** Add `ResetLevel` (reload the current level from its file) and `ResetPlayer` (paddle back at the bottom
  centre, the ball stuck on it with the initial velocity); in `Update`, when the ball reaches the bottom edge, call both.
- **Hint:** `if (game.Level == 0) LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2); else if …`
  for the four levels; `Reset(Ball, XMFLOAT2(Player.Position.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, Player.Position.y
  - BALL_RADIUS * 2.0f), INITIAL_BALL_VELOCITY);`. In Update after DoCollisions: `if (Ball.Position.y >= game.Height) {
  ResetLevel(game); ResetPlayer(game); }`.
- **Observable:** `void ResetLevel(Game& game)`, `void ResetPlayer(Game& game)` (above) before Init, the loss check at
  the end of Update. At 2.0 s **no visible change** (the ball is still on its way down; the picture equals `resolve`'s
  pixel for pixel). **At 3.0 s (the second check time) the ball is back on the paddle** – reset in frame 151, stuck at
  (387.5, 555): on-paddle = 192,230,180, ball-3s = 71,54,83, all bricks there (the level reloaded: blue-gone =
  40,121,201), paddle = 214,170,72. 71 draws.
