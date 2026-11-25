# Project: Hedgerow goes to the fair – milestones (OpenGL)

The optional project after In Practice (`chapters/<lang>/in-practice-project.md`). Its milestones are tasks like a
lesson's; the checks are `ts/packages/gp-course/src/Checks/TaskChecks.Project.InPractice.ts`.

**Screenshot time: t = 3.0 s (frame 180)** (verify.sh `VERIFY_T=3.0`; the simulator runs the loop 181 times); the fade
is also looked at at 1.0 s. All APIs use these times and points.

**Start:** the finished Hedgerow (= `render-text`'s and `final-thoughts`' solution: `main.cpp`, the shaders,
`textures/`, `levels/`, `fonts/`) plus **`levels/five.lvl`**: 8 rows of 15 zeros, an empty level for the learner to
design (not loaded yet). With the course's fixed input (only SPACE, frames 30–32) the game **stays in the menu**: level
one, "Lives:3", the menu's two lines, the ball stuck on the paddle (Update still runs in the menu: the particles spawn
at the stuck ball – hidden under it, they drift down – and power-ups fall and can be caught).

**The solution's choices** (the checks accept other levels, places, colours and names):
- `own-level`: a pumpkin – orange (5) body, yellow (4) eyes, nose and mouth, a green (3) stalk, a stone (1) pair at each
  side of the bottom row; `GameLevel five; LoadLevel(five, "levels/five.lvl", …)`, `game.Levels.push_back(five);`,
  `game.Level = 4;` in Init.
- `level-menu`: `% 5`, S on level 0 → `game.Level = 4;`, ResetLevel's `else if (game.Level == 4)` with `five.lvl`.
- `score`: `unsigned int Score = 0;` in Game, `game.Score += 10;` where DoCollisions destroys a brick, `game.Score = 0;`
  in ResetLevel, `RenderText(Text, "Score:" + std::to_string(game.Score), game.Width - 120.0f, 5.0f, 1.0f);` after the
  lives. With the fixed input no brick breaks: "Score:0" at the top right.
- `sparks`: respawnParticle's colour `glm::vec4(rColor, rColor * 0.7f, rColor * 0.1f, 1.0f)` (gold); a global
  `GameObject Sparkler;` (never drawn) with Position (120, 500) and Velocity (0, 1200) set in Init after InitParticles;
  `Update(Particles, dt, Sparkler, 2);` after the ball's particles – the sparks move against the velocity (× 0.1):
  120 px/s upwards, a golden column of about 50 px over the dark hills on the left.
- `extra-life`: in SpawnPowerUps `ShouldSpawn(100)` → `MakePowerUp("extra-life", glm::vec3(1.0f, 0.4f, 0.6f), 0.0f,
  block.Position, GetTexture("powerup_increase").ID)`; in ActivatePowerUp `++Hedgerow.Lives;`; at the end of Init the
  welcome gift at (370, 300). It falls at 150 px/s and is caught by the paddle at about 1.73 s: **"Lives:4"** at 3.0 s.
- `fade-in`: `post_processing.fs` declares `uniform float time;` (the same uniform as the vertex shader's) and ends with
  `color.rgb *= clamp(time / 2.0, 0.0, 1.0);` – the picture at half brightness at 1.0 s, full from 2.0 s; the text
  (drawn after the post-processing quad) is never faded.

**Points** (800×600 window, Mesa/llvmpipe; the simulator gives the same): the level's tiles at their centres (the
level fills 800 × 300; `own-level` reads the learner's `five.lvl` and tests every tile: stone, blue, green, yellow,
orange or no brick); **digit** (80,17) – inside a "4" of "Lives:4", not in a "3"; **lives-L** (8,12); the score's
strip x 120…795, y 0…35 (white text); the sparkler's region: the lower half (y ≥ 340) outside the ball and paddle;
**hills** (200,450) = 101,71,97 and **brass** (358,588) = 214,170,72 at 3.0 s – at 1.0 s after `fade-in` 50,36,48
and 107,85,36.

## `own-level`
- **Task:** Design a level of your own in `levels/five.lvl`, load it as the fifth level and let the game start on it.
- **When done:** the pumpkin instead of level one; the menu, "Lives:3" and the ball as before.

## `level-menu`
- **Task:** W and S cycle through all five levels; ResetLevel can reload the fifth.
- **When done:** **no visible change** (the menu never gets W or S, no game over): checked in the code (`% 5` or
  `% …Levels.size()`, `"levels/five.lvl"` twice, `Level = 4;` (or `size() - 1`) twice).

## `score`
- **Task:** Points for every destroyed brick, `Score:` and the points at the top right, zero for a new game.
- **When done:** "Score:0" in white at the top right (the check counts white pixels in the top strip right of the
  lives, and looks for the points being added in the code).

## `sparks`
- **Task:** Sparks in a colour of the fair, and a sparkler in the lower half from which sparks keep rising.
- **When done:** the golden column over the hills on the left (the check: at least two bright, clearly coloured pixels
  in the lower half outside the ball and paddle; grey sparks do not count).

## `extra-life`
- **Task:** A power-up that gives a life, spawned from bricks; the welcome gift dropped from y = 300 above the paddle.
- **When done:** the pink pill falls through the menu and is caught at about 1.73 s: **"Lives:4"** at 3.0 s (digit
  white). Code: one more `MakePowerUp(` (8 or more) and a life added.

## `fade-in`
- **Task:** A new post-processing effect: the picture fades in from black over the first two seconds.
- **When done:** at 1.0 s hills and brass at less than three quarters of their 3.0 s brightness (half, here), the
  text white; at 3.0 s the picture as before. This is the solution.
