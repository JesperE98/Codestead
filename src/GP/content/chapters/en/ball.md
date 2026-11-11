# Ball

At this point we have a level full of bricks and a movable player paddle. The only thing missing is the ball. The
objective is to let the ball collide with all the bricks until each of the destroyable bricks are destroyed, but this
all within the condition that the ball is not allowed to reach the bottom edge of the screen.

In addition to the general game object components, a ball has a radius, and an extra boolean value indicating
whether the ball is *stuck* on the player paddle or it's allowed free movement. When the game starts, the ball is
initially stuck on the player paddle until the player starts the game by pressing some arbitrary key – in Hedgerow,
as in learnopengl's game, the space bar.

## The ball object

Because the ball is effectively a `GameObject` with a few extra properties, it makes sense to create a ball object as
a subclass of `GameObject`. learnopengl writes a class `BallObject` derived from `GameObject`; the course keeps the
derivation – a struct can derive from a struct just as well – and writes its member functions as free functions, as
everywhere in the game:

:::opengl
```cpp
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, unsigned int sprite)
{
    BallObject ball;
    ball.Position = pos;
    ball.Size = glm::vec2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```
:::
:::vulkan
```cpp
struct BallObject : GameObject {
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, VkDescriptorSet sprite) {
    BallObject ball;
    ball.Position = pos;
    ball.Size = glm::vec2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```

The sprite is the `ball` texture's descriptor set, like every game object's since the Levels chapter.
:::
:::d3d12
```cpp
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(XMFLOAT2 pos, float radius, XMFLOAT2 velocity, unsigned int sprite)
{
    BallObject ball;
    ball.Position = pos;
    ball.Size = XMFLOAT2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```

The sprite is the `ball` texture's ID – the slot of its view in the heap –, like every game object's since the Levels
chapter.
:::

`struct BallObject : GameObject` means: a `BallObject` *is* a `GameObject` – it has every field of one (Position, Size,
Velocity, Color, Rotation, IsSolid, Destroyed, Sprite, with their default values), followed by its own two, `Radius`
and `Stuck`. That is what makes the ball usable wherever a game object is expected: a `BallObject` can be passed to a
function that takes a `GameObject&`, which then sees the ball's `GameObject` part. The ball is drawn exactly like the
paddle, with `DrawObject(Ball, Renderer)`.

`MakeBallObject` is learnopengl's constructor. Its size is a square of twice the radius – the ball's sprite is drawn
into that square – and it starts stuck.

The ball has two functions of its own. `Move` moves the ball based on its velocity, checks if it reaches any of the
scene's edges and if so, reverses the ball's velocity:

:::opengl
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```
:::
:::vulkan
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width) {
    // if not stuck to player board
    if (!ball.Stuck) {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        } else if (ball.Position.x + ball.Size.x >= window_width) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f) {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```
:::
:::d3d12
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s, compute, store)
        XMStoreFloat2(&ball.Position, XMLoadFloat2(&ball.Position) + XMLoadFloat2(&ball.Velocity) * dt);
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```

The one vector step is written with DirectXMath, as Microsoft's guide to it recommends: `XMFLOAT2` *stores* a vector
(in structs, globals, parameters), `XMVECTOR` *computes* with it. `XMLoadFloat2` loads the stored values into a
register, DirectXMath's `+` and `*` operators compute, and `XMStoreFloat2` writes the result back – learnopengl's
`this->Position += this->Velocity * dt;`. Single components stay plain floats (`ball.Position.x`), as in learnopengl.
:::

In addition to reversing the ball's velocity, we also want to relocate the ball back along the edge; the ball is only
able to move if it isn't stuck. The ball's position is its top-left corner, so its right edge is `Position.x + Size.x`
and that is what is compared with the window's width. learnopengl's `Move` also returns the new position, which nobody
uses; the course's returns nothing.

Note how there is no check for the bottom edge. The player loses when the ball touches the bottom edge – it has to be
caught with the paddle. Detecting that, and starting a new try, is part of the Collision resolution chapter.

The second function, `Reset`, puts the ball back to a given position and velocity, stuck again:

:::opengl
```cpp
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::
:::vulkan
```cpp
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity) {
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::
:::d3d12
```cpp
void Reset(BallObject& ball, XMFLOAT2 position, XMFLOAT2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::

The `// TODO:` comments in the project mark where your code goes, and you build and run it in your IDE. Now do the first
two tasks: **ball-object** – the struct and `MakeBallObject` – and **move-reset** – the two functions. Nothing uses them
yet, so the picture does not change.

```quiz
When the ball crosses the left edge, `Move` reverses `Velocity.x` *and* sets `Position.x = 0.0f`. What would go wrong without the second part?
- [ ] Nothing: reversing the velocity is enough
- [ ] The ball would leave the window at the right edge instead
- [x] The ball could still be past the edge in the next frame and reverse again – it would jitter along the edge or get stuck in it
- [ ] The ball would stop moving
---
In one frame the ball moves a few pixels at once, so it usually ends up a little beyond the edge. Putting it back on the edge makes sure the reversed velocity carries it away from the edge in the next frame.
```

## Within the game

The ball's numbers are learnopengl's: an initial velocity of (100, −350) – up (y points down in the game's coordinates)
and slightly to the right – and a radius of 12.5 pixels:

:::opengl vulkan
```cpp
// Initial velocity of the Ball
const glm::vec2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;
```
:::
:::d3d12
```cpp
// Initial velocity of the Ball
const XMFLOAT2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;
```
:::

and a global `BallObject Ball;` next to the paddle. In `Init` it is made after the paddle, on top of it, in its
middle:

:::opengl
```cpp
    glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
```
:::
:::vulkan
```cpp
        glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
        Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").DescriptorSet);
```
:::
:::d3d12
```cpp
    XMFLOAT2 ballPos = XMFLOAT2(playerPos.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, playerPos.y - BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
```

(per component: an `XMFLOAT2` has no `+` operator; the vector maths of DirectXMath works on `XMVECTOR`s).
:::

The paddle is at (350, 580) and 100 pixels wide, so the ball's top-left corner goes to (350 + 50 − 12.5, 580 − 25) =
**(387.5, 555)**: centred on the paddle and resting on its top. In `Render` the ball is drawn last, after the paddle:

```cpp
        // draw ball
        DrawObject(Ball, Renderer);
```

Now do the task **draw-ball**. Build and run: **the pale green ball sits on the paddle.**

Every frame, the game's `Update` moves the ball:

```cpp
    // update objects
    Move(Ball, dt, game.Width);
```

Now do the task **update**. Nothing changes in the picture: the ball is stuck, and `Move` leaves a stuck ball where it
is. What is missing is the input. While the ball is stuck it should move with the paddle, and the space bar releases
it – in `ProcessInput`:

:::opengl
```cpp
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}
```
:::
:::vulkan
```cpp
void ProcessInput(Game& game, float dt) {
    if (game.State == GAME_ACTIVE) {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A]) {
            if (Player.Position.x >= 0.0f) {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D]) {
            if (Player.Position.x <= game.Width - Player.Size.x) {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}
```
:::
:::d3d12
```cpp
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys['A'])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys['D'])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[VK_SPACE])
            Ball.Stuck = false;
    }
}
```

`VK_SPACE` is the space bar's virtual-key code, 0x20 – the same number as `GLFW_KEY_SPACE`.
:::

Here, if the user presses the space bar, the ball's `Stuck` variable is set to false. Note that we also move the
position of the ball alongside the paddle's position whenever the ball is stuck.

Now do the task **launch**. Remember the course's fixed input (Setting up): nobody presses A or D, and the space bar is
pressed once, at 0.5 s – frame 30 – and released at 0.55 s. So for half a second the ball sits on the paddle; in frame
30 `ProcessInput` sets `Stuck = false`, and the same frame's `Update` moves it for the first time, by (100, −350) ×
1/60. Build and run: the picture is at **1.0 s** – frame 60 –, and **the ball is flying up to the right**, at (439.17,
374.17), the paddle empty below it.

```quiz
The ball is released in frame 30 and moves by `INITIAL_BALL_VELOCITY / 60` in every frame from then on, frame 30 included. Where is its top-left corner in frame 60 (the picture at 1.0 s)?
- [ ] At (387.5, 555): the ball is still stuck
- [ ] At (437.5, 380): 30 frames of movement
- [x] At about (439.17, 374.17): 31 frames of movement (frames 30 to 60), 31 × (100, −350) / 60 from (387.5, 555)
- [ ] At (487.5, 205): one second of movement
---
31 × 100 / 60 ≈ 51.67 and 31 × 350 / 60 ≈ 180.83. Because the course's time is fixed at 1/60 per frame, the position is the same in every API and on every driver – and in learnopengl's program on a real clock it would be about the same.
```

The ball flies straight through the bricks: nothing checks for collisions yet. Run the project in your head a bit
further and it reaches the top edge (frame 125), bounces off it – `Move`'s top-edge check – comes down and leaves the
window at the bottom, and nothing brings it back. The next two chapters change that.

```quiz
Why can `DrawObject(Ball, Renderer)` draw the ball, although `DrawObject` takes a `GameObject&`?
- [ ] Because `DrawObject` is overloaded for `BallObject`
- [x] Because `BallObject` derives from `GameObject`: a reference to the base binds to the ball's `GameObject` part, which has the position, size, colour and sprite
- [ ] Because the compiler converts the ball into a new `GameObject` that is drawn instead
- [ ] Because `Radius` is ignored by C++ when it is not used
---
That is the reason to derive the ball from the game object: every function written for game objects works on it. Only what is specific to the ball – Radius, Stuck – needs functions of its own.
```

```quiz
`Move` checks the left, right and top edges of the window. Why not the bottom edge?
- [ ] Because the paddle covers the bottom edge completely
- [ ] Because the y axis points down, so the bottom edge is at y = 0
- [ ] Because the ball can never move down
- [x] Because the bottom edge is where the player loses: the ball must be caught with the paddle, and a ball that gets past it is lost
---
A bounce off the bottom would make the game impossible to lose. The game checks the loss itself – the ball's y reaching the window's height – in the Collision resolution chapter.
```

## Additional resources

- [Ball](https://learnopengl.com/In-Practice/2D-Game/Ball): learnopengl's chapter this chapter follows.

:::opengl
- [LearnOpenGL source code: the 2D game](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengl's game, with `ball_object.h` / `.cpp`.
:::
:::vulkan
- [LearnOpenGL source code: the 2D game](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengl's game, with `ball_object.h` / `.cpp`.
:::
:::d3d12
- [Code optimization with the DirectXMath library](https://learn.microsoft.com/en-us/windows/win32/dxmath/pg-xnamath-optimizing):
  why XMFLOAT2 stores and XMVECTOR computes.
:::
