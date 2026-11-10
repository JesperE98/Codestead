# Collision detection (Hedgerow) – tasks (OpenGL)

**Screenshot time: t = 3.0 s (frame 180).** Every picture below is frame 180 of the render loop (glfwGetTime() =
180/60), the frame verify.sh holds with `VERIFY_T=3.0` and the simulator shows by running the loop 181 times. All APIs
use this time and these points. At 3.0 s the ball has cut its channel through the bricks and is back in the open sky.

learnopengl "2D Game / Collisions / Collision detection": `CheckCollision` (AABB – AABB, then AABB – circle) and
`Game::DoCollisions` of `game.cpp` – in the chapter's first form: a collision only destroys the brick, nothing bounces
yet (that is `collision-resolution`). Files: `main.cpp` (= `ball`'s solution with TODOs), `sprite.vs`, `sprite.fs`,
`textures/`, `levels/` (unchanged). See `../game-setup/tasks.md` for the fixed choices of the whole game.

**Fixed choices (all APIs):**
- A new section `// Collision detection (learnopengl: game.cpp)` after the game's globals (`Hedgerow`, `Renderer`,
  `Player`, `Ball`), before `Init`: `bool CheckCollision(GameObject& one, GameObject& two)` (AABB – AABB), `bool
  CheckCollision(BallObject& one, GameObject& two)` (AABB – circle, an **overload**: C++ picks it for the ball because
  `BallObject&` matches a BallObject exactly – before it exists, the ball is passed as its GameObject part to the AABB
  version), and learnopengl's member function `Game::DoCollisions` as `void DoCollisions(Game& game)` (a range-for over
  `game.Levels[game.Level].Bricks` by reference, `if (!box.Destroyed)`, `if (CheckCollision(Ball, box))`, `if
  (!box.IsSolid) box.Destroyed = true;`). The circle version is defined **above** DoCollisions (a function call only
  sees the overloads declared before it).
- `Update`: `Move(Ball, dt, game.Width);` then `DoCollisions(game);` (learnopengl's order).
- AABB – circle as learnopengl: `center = one.Position + one.Radius`, the box's half extents and centre,
  `difference = center - aabb_center`, `clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents)`,
  `closest = aabb_center + clamped`, `difference = closest - center`, `return glm::length(difference) < one.Radius;`.

**The ball's path** (the same as in `ball`: nothing bounces off bricks; measured by printing `Ball.Position` every
frame, Mesa): released in frame 30, through the solid stones of row 5 (solid bricks are never destroyed – and do not
stop the ball yet), up through columns 9–10 of rows 3…0, off the top edge in frame 125 at (547.5, 0), down again
through columns 10–11. Bricks destroyed (row, column; row 0 = the top orange row, column 0 = left): (3, 9) in frame 99,
(3, 10) 102, (2, 9) and (2, 10) 105–106, (1, 9) and (1, 10) 112, (0, 10) 118 (going up); (1, 11), (2, 11) 134–135,
(3, 11) 140–141 (coming down) – **10 bricks: orange (0, 10); yellow, green and blue of columns 9, 10 and 11**. **Frame
180 (3.0 s): Position = (639.17, 320.83)**, centre (651.7, 333.3), moving down to the right (the ball leaves the window
at the bottom in frame 229 and is not reset in this chapter). The gap shows the background's moon.

Named points (from the top-left, 800×600, frame 180, Mesa/llvmpipe): **ball** (651,333) – the ball's centre at
3.0 s; **orange-gone** (560,18) – the orange brick (0, 10); **orange-kept** (506,29) – (0, 9), never hit;
**yellow-gone** (506,66) – (1, 9); **green-gone** (560,104) – (2, 10); **blue-gone** (506,141) – (3, 9);
**blue-gone2** (613,141) – (3, 11); **moon** (615,110) – (2, 11), the moon behind it; **blue** (396,141) – (3, 7),
never hit; **yellow-right** (666,66) – (1, 12), never hit; **stone** (506,206) – the solid stone (5, 9) the ball
flew through; **solid** (13,209) – the stone (5, 0); **paddle** (358,588); **sky** (200,250).

**Start picture** (= `ball`'s end at 3.0 s): all bricks there, the ball flying through the sky at (639.17, 320.83):
ball = 194,230,181, orange-gone = 209,105,0, orange-kept = 201,101,0, yellow-gone = 161,161,80, green-gone =
0,146,0, blue-gone = 40,121,201, blue-gone2 = 41,124,207, moon = 0,111,0, blue = 39,118,196, yellow-right =
161,161,80, stone = 132,132,116, solid = 126,126,110, paddle = 214,170,72, sky = 53,44,75. 71 draws.

## `aabb`
- **Task:** Write `CheckCollision` for two GameObjects as axis-aligned bounding boxes (AABB – AABB): they collide when they overlap on the x axis and on the y axis.
- **Hint:** On x: `one.Position.x + one.Size.x >= two.Position.x && two.Position.x + two.Size.x >= one.Position.x`; the same with y and the heights; return both.
- **When done:** `bool CheckCollision(GameObject& one, GameObject& two)` with learnopengl's `collisionX` /
  `collisionY` and `return collisionX && collisionY;`. Nothing calls it yet: no visible change (start picture).

## `do-collisions`
- **Task:** Write `DoCollisions`: for every brick that is not destroyed yet, if the ball collides with it, destroy it – unless it is solid. Call it in `Update` after moving the ball.
- **Hint:** `for (GameObject& box : game.Levels[game.Level].Bricks)` (a reference, so `box.Destroyed = true` changes the level's brick), `if (!box.Destroyed)`, `if (CheckCollision(Ball, box))`, `if (!box.IsSolid) box.Destroyed = true;`. `DoCollisions(game);` after `Move`.
- **When done:** `void DoCollisions(Game& game)` as described, `DoCollisions(game);` after `Move(Ball, dt,
  game.Width);` in `Update`. With only the AABB version, the ball is tested as its 25×25 box. **A channel of 10 bricks
  is gone** (listed above; 61 draws: 1 + 58 bricks + paddle + ball): orange-gone = 24,30,64, yellow-gone = 26,30,64,
  green-gone = 39,42,75, blue-gone = 35,35,68 (the night sky behind them), moon = 255,255,233 and blue-gone2 =
  255,252,227 (the moon); orange-kept = 201,101,0, blue = 39,118,196, yellow-right = 161,161,80, stone = 132,132,116
  (solid: still there), solid = 126,126,110, ball = 194,230,181 (same path), paddle = 214,170,72, sky = 53,44,75.

## `circle`
- **Task:** Write `CheckCollision` for the ball and a GameObject (AABB – circle): find the point of the box closest to the ball's centre (clamp the centres' difference to the box's half extents) and test whether it is less than `Radius` away.
- **Hint:** Overload it: `bool CheckCollision(BallObject& one, GameObject& two)` above `DoCollisions` – the call `CheckCollision(Ball, box)` then picks it, because a BallObject matches `BallObject&` better than `GameObject&`. `glm::clamp(difference, -aabb_half_extents, aabb_half_extents)`, `glm::length(closest - center) < one.Radius`.
- **When done:** `bool CheckCollision(BallObject& one, GameObject& two)` with learnopengl's body (above), between the
  AABB version and `DoCollisions`. **No visible change at 3.0 s**: the round ball destroys the same 10 bricks (the
  picture equals `do-collisions`' pixel for pixel), only some of them a frame later – the box's corners reach a brick
  before the circle does. Visible in between: at 1.75 s (frame 105) the AABB version has destroyed 4 bricks ((3, 9),
  (3, 10), (2, 9), (2, 10)), the circle version 3 ((2, 10) follows in frame 106).
