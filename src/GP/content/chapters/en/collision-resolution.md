# Collision resolution

At the end of the last chapter we had a working collision detection system. However, the ball does not react in any
way to the detected collisions; it moves straight through all the bricks. We want the ball to *bounce* off the
collided bricks. This chapter discusses how we can accomplish this so called *collision resolution* within the AABB –
circle collision detection logic.

Whenever a collision occurs we want two things to happen: we want to reposition the ball so it is no longer inside the
other object and second, we want to change the direction of the ball's velocity so it looks like it's bouncing of the
object.

Like the last chapter, this is plain C++ – the same in all three versions of the game.

## Collision repositioning

To position the ball object outside the collided AABB we have to figure out the distance the ball penetrated the
bounding box. For this we'll revisit the closest point P of the last chapter. The ball moves a few pixels per frame,
so when a collision is detected, its circle usually reaches a little way into the brick: the distance from its centre
C to P is less than the radius. The difference, R minus the length of the vector from C to P, is the *penetration* –
how far the ball went into the brick. If we move the ball back by that distance, in the direction it came from, it is
outside the brick again and exactly touches it.

To move the ball back, we also need to know *which way* the collision happened: whether the ball hit the brick on one
of its sides, or on its top or bottom. For learnopengl's simple game it is enough to move the ball along one axis only,
and to know which axis, we need the direction of the collision.

## Collision direction

Next we need to update the ball's velocity. We only want to flip the ball's velocity along the axis on which it hit:
a ball that hits a brick from below should go down again, keeping its sideways speed; a ball that hits it from the side
should go the other way, keeping its vertical speed. To find out which one it is, learnopengl compares the vector from
the ball's centre to P with four *compass* directions, up, right, down and left – and takes the one it points to the
most:

:::opengl
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(glm::vec2 target)
{
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```
:::
:::vulkan
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(glm::vec2 target) {
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++) {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max) {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```
:::
:::d3d12
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(XMFLOAT2 target)
{
    XMFLOAT2 compass[] = {
        XMFLOAT2(0.0f, 1.0f),  // up
        XMFLOAT2(1.0f, 0.0f),  // right
        XMFLOAT2(0.0f, -1.0f), // down
        XMFLOAT2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = XMVectorGetX(XMVector2Dot(XMVector2Normalize(XMLoadFloat2(&target)), XMLoadFloat2(&compass[i])));
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```

DirectXMath's version of the dot product: `XMVector2Dot` returns the dot product of the x and y components – in every
component of its result, so `XMVectorGetX` takes it out; `XMVector2Normalize` is `glm::normalize`. The compass stays
an array of `XMFLOAT2`s, loaded as needed.
:::

The function compares `target` to each of the direction vectors in the `compass` array. The compass vector `target` is
closest to in angle, is the direction returned to the function caller. The dot product of two unit vectors is the
cosine of the angle between them: the larger it is, the smaller the angle. (`best_match = -1` in an `unsigned int`
is the largest number it can hold – a "none yet" that the loop replaces, since every non-zero vector has a positive dot
product with at least one of the four directions.)

**A word on the names.** The compass's "up" is (0, 1) – but in the game's coordinates y points *down*, so (0, 1) points
down the screen. learnopengl keeps the names anyway, and they describe the *vector* from the ball's centre to the
closest point, not the side of the brick. Take the case the course's ball meets: it flies up into a brick from below.
The closest point is on the brick's bottom edge, straight above the ball's centre, so the vector from the centre to it
is (0, −something): the compass's "down", `DOWN`. learnopengl's resolution then moves the ball "back down" – down the
screen, out of the brick. The names are confusing, but the code is consistent.

Now do the first task, **direction**: the enum after `enum GameState` and `VectorDirection` between the two
`CheckCollision` functions (the circle version will call it). Nothing uses it yet.

```quiz
The ball flies upwards and its circle reaches into a brick from below. The vector from its centre to the closest point is (0, −8). What does `VectorDirection` return, and which way does the resolution then move the ball?
- [ ] `UP`, and it moves the ball up the screen, deeper into the brick
- [x] `DOWN` – the compass's (0, −1) has the largest dot product – and the resolution moves the ball down the screen (`Position.y += penetration`), out of the brick
- [ ] `LEFT`, because a negative component points left
- [ ] Nothing: the vector has no x component, so there is no best match
---
In screen coordinates y grows downwards, so (0, −8) points up the screen – from the ball to the brick above it. learnopengl calls it DOWN after the compass vector (0, −1); the resolution's "move ball back down" then moves it away from the brick.
```

## AABB – Circle collision resolution

To calculate the required values for collision resolution we need a bit more information from the collision
function(s) than just a true or false. We're now going to return a *tuple* of information that tells us if a collision
occurred, what direction it occurred, and the difference vector R. You can find the tuple container in the `<tuple>`
header:

:::opengl vulkan
```cpp
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, glm::vec2> Collision; // <collision?, what direction?, difference vector center - closest point>
```
:::
:::d3d12
```cpp
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, XMFLOAT2> Collision; // <collision?, what direction?, difference vector center - closest point>
```

The tuple keeps the difference as an `XMFLOAT2` – DirectXMath's storage type, as in every struct of the game;
the computation in `CheckCollision` is in `XMVECTOR`s and stored at the end.
:::

A `std::tuple` holds a fixed number of values of possibly different types – here a bool, a Direction and a vector –
without a struct of its own; `std::make_tuple` builds one, `std::get<i>` reads element i (counted from 0). The circle
`CheckCollision` now returns a `Collision`:

:::opengl
```cpp
Collision CheckCollision(BallObject& one, GameObject& two)
{
    // get center point circle first
    glm::vec2 center(one.Position + one.Radius);
    // calculate AABB info (center, half-extents)
    glm::vec2 aabb_half_extents(two.Size.x / 2.0f, two.Size.y / 2.0f);
    glm::vec2 aabb_center(two.Position.x + aabb_half_extents.x, two.Position.y + aabb_half_extents.y);
    // get difference vector between both centers
    glm::vec2 difference = center - aabb_center;
    glm::vec2 clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    glm::vec2 closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;
    if (glm::length(difference) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
        return std::make_tuple(true, VectorDirection(difference), difference);
    else
        return std::make_tuple(false, UP, glm::vec2(0.0f, 0.0f));
}
```
:::
:::vulkan
```cpp
Collision CheckCollision(BallObject& one, GameObject& two) { // AABB - Circle collision
    // get center point circle first
    glm::vec2 center(one.Position + one.Radius);
    // calculate AABB info (center, half-extents)
    glm::vec2 aabb_half_extents(two.Size.x / 2.0f, two.Size.y / 2.0f);
    glm::vec2 aabb_center(two.Position.x + aabb_half_extents.x, two.Position.y + aabb_half_extents.y);
    // get difference vector between both centers
    glm::vec2 difference = center - aabb_center;
    glm::vec2 clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    glm::vec2 closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;

    if (glm::length(difference) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
        return std::make_tuple(true, VectorDirection(difference), difference);
    else
        return std::make_tuple(false, UP, glm::vec2(0.0f, 0.0f));
}
```
:::
:::d3d12
```cpp
Collision CheckCollision(BallObject& one, GameObject& two)
{
    // get center point circle first (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s)
    XMVECTOR center = XMLoadFloat2(&one.Position) + XMVectorReplicate(one.Radius);
    // calculate AABB info (center, half-extents)
    XMVECTOR aabb_half_extents = XMVectorSet(two.Size.x / 2.0f, two.Size.y / 2.0f, 0.0f, 0.0f);
    XMVECTOR aabb_center = XMVectorSet(two.Position.x + two.Size.x / 2.0f, two.Position.y + two.Size.y / 2.0f, 0.0f, 0.0f);
    // get difference vector between both centers
    XMVECTOR difference = center - aabb_center;
    XMVECTOR clamped = XMVectorClamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    XMVECTOR closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;

    if (XMVectorGetX(XMVector2Length(difference)) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
    {
        XMFLOAT2 diff;
        XMStoreFloat2(&diff, difference);
        return std::make_tuple(true, VectorDirection(diff), diff);
    }
    else
        return std::make_tuple(false, UP, XMFLOAT2(0.0f, 0.0f));
}
```
:::

and `DoCollisions` reads the first element where it tested the bool before:

```cpp
            Collision collision = CheckCollision(Ball, box);
```

followed by `if (std::get<0>(collision))`. learnopengl's comment on the `<` explains it: after a resolution the ball
*exactly* touches the brick, and that must not count as another collision in the next frame.

Now do the task **collision-tuple**. The detection is the same, so the picture is too.

```quiz
`Collision` is `std::tuple<bool, Direction, vec2>`. What does `std::get<2>(collision)` return?
- [ ] Whether there was a collision
- [ ] The direction of the collision
- [x] The difference vector from the ball's centre to the closest point – the third element, counted from 0
- [ ] The brick that was hit
---
`std::get<0>` is the bool, `std::get<1>` the Direction, `std::get<2>` the vector. The index is part of the type: it must be a constant known when the program is compiled.
```

The resolution itself, in `DoCollisions`, after the brick is destroyed (solid bricks are not destroyed, but the ball
bounces off them too):

:::opengl
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) // horizontal collision
                {
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                }
                else // vertical collision
                {
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::
:::vulkan
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) { // horizontal collision
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                } else { // vertical collision
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::
:::d3d12
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                XMFLOAT2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) // horizontal collision
                {
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                }
                else // vertical collision
                {
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::

Don't be too scared by the function's complexity since it is basically a direct translation of the concepts explained
so far. First we check for a collision and if so, we destroy the block if it is non-solid. Then we obtain the
collision direction `dir` and the vector `diff_vector` from the tuple to finally do the collision resolution.

We first check if the collision direction is either horizontal or vertical and then reverse the velocity accordingly.
If horizontal, we calculate the penetration value R from the `diff_vector`'s x component and either add or subtract
this from the ball's position based on its direction. The same applies to the vertical collisions, but this time we
operate on the y component of all the vectors.

Now do the task **resolve**. Build and run. The expected result is at **2.0 s** (frame 120) now, and it looks very
different from the last chapter: **all bricks are there**, and the ball is on its way *down*, to the right of the
paddle. What happened: on its way up, the ball's first contact is the solid stone of row 5, column 9 – the one it flew
through before. In frame 86 its circle reaches the stone from below, direction `DOWN`: its vertical velocity is
reversed, from (100, −350) to (100, 350), and it is moved out of the stone. The stone is solid, so nothing is destroyed,
and the ball comes down to the right.

```quiz
The resolution finds a horizontal collision with `diff_vector` = (−9, 2) and the ball's radius is 12.5. How far is the ball moved, and which way?
- [ ] 9 pixels to the left
- [ ] 12.5 pixels, the whole radius
- [ ] 3.5 pixels to the left: −9 is LEFT, so the ball moves left
- [x] 3.5 pixels (12.5 − |−9|) to the right: (−9, 2) points left, `VectorDirection` returns LEFT, and `Position.x += penetration`
---
The ball's centre is 9 pixels from the closest point but its radius is 12.5, so it reaches 3.5 pixels into the brick. The vector points left – from the ball to the brick on its left – so the ball is moved right, away from it, and its x velocity is reversed.
```

## Player – ball collisions

Collisions between the ball and the player are handled slightly different from what we've previously discussed, since
this time the ball's horizontal velocity should be updated based on how far it hit the paddle from its center. The
further the ball hits the paddle from its center, the stronger its horizontal velocity change should be.

:::opengl
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        glm::vec2 oldVelocity = Ball.Velocity;
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity); // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```
:::
:::vulkan
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result)) {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        glm::vec2 oldVelocity = Ball.Velocity;
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity); // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```
:::
:::d3d12
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        XMVECTOR oldVelocity = XMLoadFloat2(&Ball.Velocity);
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        XMStoreFloat2(&Ball.Velocity, XMVector2Normalize(XMLoadFloat2(&Ball.Velocity)) * XMVector2Length(oldVelocity));
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```

The speed is kept with DirectXMath: the old velocity is kept as an `XMVECTOR`, and `XMVector2Normalize(…) *
XMVector2Length(oldVelocity)` is learnopengl's `glm::normalize(Ball->Velocity) * glm::length(oldVelocity)`.
:::

After we checked collisions between the ball and each brick, we'll check if the ball collided with the player paddle
(the paddle is a plain `GameObject`, so this call uses the circle test with the paddle's box). If so (and the ball is
not stuck to the paddle) we calculate the percentage of how far the ball's center is moved from the paddle's center
compared to the half-extent of the paddle. The horizontal velocity of the ball is then updated based on the distance
it hit the paddle from its center. In addition to updating the horizontal velocity, we also have to reverse the y
velocity.

Note that the old velocity is stored as `oldVelocity`. The reason for storing the old velocity is that we update the
horizontal velocity of the ball's velocity vector while keeping its y velocity constant. This would mean that the
length of the vector constantly changes, which has the effect that the ball's velocity vector is much larger (and thus
stronger) if the ball hit the edge of the paddle compared to if the ball would hit the center of the paddle. For this
reason, the new velocity vector is normalized and multiplied by the length of the old velocity vector. This way, the
velocity of the ball is always consistent, regardless of where it hits the paddle.

**Sticky paddle.** You may or may not have noticed it when you ran the code, but there is still a large issue with
the player and ball collision resolution. learnopengl calls it the sticky paddle issue. It happens because the player
paddle moves with a high velocity towards the ball, resulting in the ball's center ending up inside the player paddle.
Since we did not account for the case where the ball's center is inside an AABB, the game tries to continuously react
to all the collisions. Once it finally breaks free, it will have reversed its y velocity so much that it's unsure
whether to go up or down after breaking free. We can easily fix this behavior by introducing a small hack made possible
by the fact that we can always assume we have a collision at the top of the paddle: instead of reversing the y
velocity, we simply always return a positive y direction so whenever it does get stuck, it will immediately break free.
"Positive" in learnopengl's words means upwards on the screen – in the game's coordinates a *negative* y: hence
`-1.0f * std::abs(Ball.Velocity.y)`.

One small change from learnopengl: it writes `abs(…)` there. On a `float`, a plain `abs` can resolve to the C function
`int abs(int)` – depending on which headers declared what – and silently truncate the speed to whole pixels per second.
`std::abs` (from `<cmath>`) has the `float` overload; learnopengl itself uses it for the penetration two lines up.

Now do the task **paddle**. Build and run: the picture does not change – and it can't. **With the course's fixed input,
the ball never meets the paddle.** Nobody moves the paddle, so it stays at x 350…450, and the ball comes down from its
bounce off the stone at x ≈ 576, well to the right of it. The ball bounces once, off the stone, and is then lost. The
paddle bounce is in the code – the task is checked there –, but not in the picture. In your own program you can steer
the paddle under the ball with A and D and see it work.

```quiz
The ball hits the paddle with its centre 40 pixels right of the paddle's centre; the paddle is 100 pixels wide. What happens to its velocity, with learnopengl's `strength` of 2?
- [ ] Its x velocity becomes 40 × 2 = 80, and the speed changes
- [ ] Only its y velocity is reversed
- [ ] It keeps its velocity: hits away from the centre are ignored
- [x] `percentage` is 40 / 50 = 0.8, so `Velocity.x` = 100 × 0.8 × 2 = 160 before the vector is normalised and scaled back to the old speed – and y is made negative: up
---
The further from the centre, the more sideways the ball leaves; hitting the left half gives a negative x. Normalising and multiplying by the old length keeps the speed, so only the direction changes. Hitting the very end, percentage 1, gives x = 200 before normalising.
```

## Losing the ball

Now the ball bounces, but what happens when it gets past the paddle? It leaves the window at the bottom – the edge
`Move` does not check – and the player has lost this try. learnopengl then resets the level and the player: every
brick comes back, the paddle returns to the bottom centre, and the ball is stuck on it again:

:::opengl
```cpp
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
}
```
:::
:::vulkan
```cpp
void ResetLevel(Game& game) {
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game) {
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
}
```

`ResetLevel` calls `LoadLevel` again, which makes the bricks anew with the textures' descriptor sets: no Vulkan object
is created or destroyed, so reloading a level in the middle of the game is cheap and safe while a frame is in flight.
:::
:::d3d12
```cpp
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, XMFLOAT2(Player.Position.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, Player.Position.y - BALL_RADIUS * 2.0f), INITIAL_BALL_VELOCITY);
}
```
:::

and in `Update`, after the collisions:

:::opengl
```cpp
void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::
:::vulkan
```cpp
void Update(Game& game, float dt) {
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) { // did ball reach bottom edge?
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::
:::d3d12
```cpp
void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::

The ball's `Position` is its top-left corner, so `Position.y >= game.Height` means the whole ball is below the window.
(Later in the part, the player gets a number of lives, and only the last lost ball ends the game.)

Now do the task **lose-ball**. At 2.0 s nothing changes: the ball is still on its way down. It leaves the window in
frame 151, and the reset puts it back on the paddle. To see that, this task is also checked at **3.0 s**: there the
ball sits on the paddle again, stuck – the space bar was pressed only once – and every brick is in place.

```quiz
The course's ball bounces off a stone at 1.4 s, misses the paddle and is reset at about 2.5 s. Why does it then stay on the paddle for the rest of the run?
- [ ] Because `ResetPlayer` sets its velocity to zero
- [ ] Because the level is complete
- [x] Because `Reset` makes it stuck again, and the course's fixed input presses the space bar only once, at 0.5 s – nothing releases it a second time
- [ ] Because `Move` stops moving balls after a reset
---
`Stuck = true` means `Move` leaves the ball alone and `ProcessInput` waits for the space bar. With a real keyboard you would launch it again.
```

## A few notes

Collision detection is a difficult topic of video game development and possibly its most challenging. Most collision
detection and resolution schemes are combined with physics engines as found in most modern-day games. The collision
scheme we used for this game is, however, a very simple scheme and one specialized specifically for this type of game.

It should be stressed that this type of collision detection and resolution is not perfect. It calculates possible
collisions only per frame and only for the positions exactly as they are at that timestep; this means that if an object
would have such a velocity that it would pass over another object within a single frame, it would look like it never
collided with this object. So if there are framedrops, or you reach high enough velocities, this collision detection
scheme will not hold. This is called *tunnelling*.

Several of the things that can still go wrong:

- Because the ball may hit several bricks in one frame, it can reverse its velocity twice and continue in its old
  direction – it seems to fly through the bricks.
- When the ball's centre gets inside a brick, `VectorDirection` gets a vector that may point the wrong way, and the
  resolution makes the ball jump.
- The sticky-paddle fix is a hack, as learnopengl says: it relies on the ball always hitting the paddle from above.

What can we do about these issues? The usual answers are *continuous* collision detection (checking the path
between two frames, not only the positions), split a frame into several smaller physics steps when objects move fast,
or a physics engine such as Box2D, which handles all of this for you – learnopengl mentions it too. For a game like this one, the simple scheme
works well enough.

## Additional resources

- [Collision resolution](https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-resolution): learnopengl's
  chapter this chapter follows, with its pictures of the penetration and the paddle bounce.
- [std::tuple](https://en.cppreference.com/w/cpp/utility/tuple): the collision's three values in one.

:::d3d12
- [XMVector2Dot](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmvector2dot):
  DirectXMath's dot product.
:::
