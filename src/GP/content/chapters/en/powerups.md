# Powerups

Hedgerow is close to finished, but it would be cool to add at least one more gameplay mechanic so it's not your
average standard game of its kind; what about power-ups?

The idea is that whenever a block is destroyed, the block has a small chance of spawning a power-up. Such a power-up
will slowly fall downwards, and if it collides with the paddle, an interesting effect occurs based on the type of
power-up. For example, one power-up makes the paddle larger, and another allows the ball to pass through blocks. We
also include several negative power-ups that affect the player in a negative way – the two postprocessing effects the
last chapter tried out are put to work here.

We can model a power-up as a game object with a few extra properties: a type (as a string), a duration for how long it
is active, and whether it is currently activated. Hedgerow features learnopengl's 4 positive and 2 negative power-ups:

- **Speed**: increases the velocity of the ball by 20 %.
- **Sticky**: when the ball collides with the paddle, the ball remains stuck to the paddle unless the space bar is
  pressed again. This allows the player to better position the ball before releasing it.
- **Pass-through**: collision resolution is disabled for non-solid blocks, allowing the ball to pass through multiple
  blocks.
- **Pad-size-increase**: increases the width of the paddle by 50 pixels.
- **Confuse**: activates the confuse postprocessing effect for a short period of time, confusing the player.
- **Chaos**: activates the chaos postprocessing effect for a short period of time, heavily disorienting the player.

The course's power-up textures are six light pills with a dark icon, 512 × 128 pixels, in `textures/`:
`powerup_speed.png`, `powerup_sticky.png`, `powerup_pass.png`, `powerup_increase.png`, `powerup_confuse.png` and
`powerup_chaos.png` (learnopengl has its own textures). Similar to the block textures, they are light and almost
without colour, so each power-up's colour vector tints them: the colour makes each kind recognisable.

**A test, because no block breaks.** With the course's fixed input the ball bounces off the solid stone (5, 9) in frame
86 and is lost in frame 151 (see `collision-resolution`): no block is ever destroyed, so no power-up would ever spawn,
and nothing of this chapter would show. So the second task puts one power-up of each kind into the game by hand, in
`Init`, as if six blocks had just broken in the empty row between the blue blocks and the stones. A real game would not
have these lines; they stay through the `audio` chapter, and the first task of `render-text` removes them again. The
chapter's expected results show the game at **1.5 s** (frame 90), when the power-ups are falling, and at **3.0 s**
(frame 180).

## The power-up

A power-up is a game object with extra state. learnopengl's `PowerUp` class inherits from `GameObject`; the course's
struct does the same, and learnopengl's constructor becomes `MakePowerUp`:

:::opengl
```cpp
const glm::vec2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const glm::vec2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, glm::vec3 color, float duration, glm::vec2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```
:::
:::vulkan
```cpp
const glm::vec2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const glm::vec2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject {
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, glm::vec3 color, float duration, glm::vec2 position, VkDescriptorSet sprite) {
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```

As for every game object, the sprite is the texture's descriptor set.
:::
:::d3d12
```cpp
const XMFLOAT2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const XMFLOAT2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, XMFLOAT3 color, float duration, XMFLOAT2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```
:::

Every power-up is 60 × 20 pixels and falls at 150 pixels per second. Because the sticky and pass-through effects
change the game's logic, learnopengl stores them as properties of the ball – `bool Sticky = false, PassThrough =
false;` in `BallObject`, cleared again in `Reset`. Because power-ups have state, a duration and effects, the game keeps
all of them – falling or active – in a vector, `std::vector<PowerUp> PowerUps;` in `Game`. The six textures are loaded
after the particle texture (`powerup_pass.png` as `"powerup_pass"`), and `Render` draws every power-up that is not
destroyed, after the paddle:

```cpp
// draw PowerUps
for (PowerUp& powerUp : game.PowerUps)
    if (!powerUp.Destroyed)
        DrawObject(powerUp, Renderer);
```

Now do the task **powerup-object**. The vector is empty: **no visible change**.

Then do the task **try-powerups**: at the end of `Init`, after the ball, push one power-up of each kind into
`game.PowerUps`, at y = 160 and x = 40, 150, 260, 370, 480 and 590, with learnopengl's colours and durations:

:::opengl
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, glm::vec2(40.0f, 160.0f), GetTexture("powerup_speed").ID));
game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, glm::vec2(150.0f, 160.0f), GetTexture("powerup_sticky").ID));
game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, glm::vec2(260.0f, 160.0f), GetTexture("powerup_pass").ID));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, glm::vec2(370.0f, 160.0f), GetTexture("powerup_increase").ID));
game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, glm::vec2(480.0f, 160.0f), GetTexture("powerup_confuse").ID));
game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, glm::vec2(590.0f, 160.0f), GetTexture("powerup_chaos").ID));
```
:::
:::vulkan
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, glm::vec2(40.0f, 160.0f), GetTexture("powerup_speed").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, glm::vec2(150.0f, 160.0f), GetTexture("powerup_sticky").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, glm::vec2(260.0f, 160.0f), GetTexture("powerup_pass").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, glm::vec2(370.0f, 160.0f), GetTexture("powerup_increase").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, glm::vec2(480.0f, 160.0f), GetTexture("powerup_confuse").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, glm::vec2(590.0f, 160.0f), GetTexture("powerup_chaos").DescriptorSet));
```
:::
:::d3d12
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, XMFLOAT2(40.0f, 160.0f), GetTexture("powerup_speed").ID));
game.PowerUps.push_back(MakePowerUp("sticky", XMFLOAT3(1.0f, 0.5f, 1.0f), 20.0f, XMFLOAT2(150.0f, 160.0f), GetTexture("powerup_sticky").ID));
game.PowerUps.push_back(MakePowerUp("pass-through", XMFLOAT3(0.5f, 1.0f, 0.5f), 10.0f, XMFLOAT2(260.0f, 160.0f), GetTexture("powerup_pass").ID));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", XMFLOAT3(1.0f, 0.6f, 0.4f), 0.0f, XMFLOAT2(370.0f, 160.0f), GetTexture("powerup_increase").ID));
game.PowerUps.push_back(MakePowerUp("confuse", XMFLOAT3(1.0f, 0.3f, 0.3f), 15.0f, XMFLOAT2(480.0f, 160.0f), GetTexture("powerup_confuse").ID));
game.PowerUps.push_back(MakePowerUp("chaos", XMFLOAT3(0.9f, 0.25f, 0.25f), 15.0f, XMFLOAT2(590.0f, 160.0f), GetTexture("powerup_chaos").ID));
```
:::

A duration of 0 means the effect is permanent: the speed and the paddle size, once changed, stay changed. Build and run:
**six tinted pills in the row above the stones** – blue, pink, green, orange and two reds. They don't move yet: nothing
updates them.

## Updating the power-ups

Power-ups have to move once they've spawned, and they have to be deactivated as soon as their duration runs out;
otherwise they would stay active forever. learnopengl's `UpdatePowerUps` moves each power-up by its velocity and counts
the active ones' duration down. Whenever a duration reaches 0, the power-up is deactivated and its effect switched off
– the relevant variables reset to their original state:

:::opengl
```cpp
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        powerUp.Position += powerUp.Velocity * dt;
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```
:::
:::vulkan
```cpp
void UpdatePowerUps(Game& game, float dt) {
    for (PowerUp& powerUp : game.PowerUps) {
        powerUp.Position += powerUp.Velocity * dt;
        if (powerUp.Activated) {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f) {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky")) { // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = glm::vec3(1.0f);
                    }
                } else if (powerUp.Type == "pass-through") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through")) { // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = glm::vec3(1.0f);
                    }
                } else if (powerUp.Type == "confuse") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse")) { // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                } else if (powerUp.Type == "chaos") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos")) { // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```
:::
:::d3d12
```cpp
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        XMStoreFloat2(&powerUp.Position, XMLoadFloat2(&powerUp.Position) + XMLoadFloat2(&powerUp.Velocity) * dt);
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```

The position is a DirectXMath step as everywhere in the game: load, compute, store.
:::

It may happen that while one power-up's effect is active, another power-up of the same type is caught. Then the
vector holds two active power-ups of that type, and when the first one runs out we don't want to switch the effect off
yet. That is what `IsOtherPowerUpActive` checks: only if no other power-up of the same type is still active is the
effect switched off – so the effect lasts until the last one of its type has run out.

:::opengl
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::
:::vulkan
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type) {
    for (const PowerUp& powerUp : powerUps) {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::
:::d3d12
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::

At the end of `UpdatePowerUps` every power-up that is both destroyed and not activated – it fell out of the window, or
it was caught and has run out – is erased from the vector. learnopengl does this with `std::remove_if` from
`<algorithm>` and a **lambda**, an unnamed function written where it is needed: `[](const PowerUp& powerUp) { return
powerUp.Destroyed && !powerUp.Activated; }` takes a power-up and says whether it should go. `remove_if` moves all
elements to keep to the front of the vector, in their order, and returns an iterator to the first element after them;
the vector's `erase` then removes everything from that iterator to the end. (`remove_if` alone removes nothing – it
can't change the vector's size; the pair is called the *erase-remove idiom*.)
:::vulkan
The Vulkan project includes `<algorithm>` already.
:::

Call it in `Update`, after the particles:

```cpp
UpdatePowerUps(game, dt);
```

Now do the task **update-powerups**. Build and run: at 1.5 s **all six pills have fallen to the middle of the window**
(y = 385, 2.5 pixels per frame), and the row above the stones is empty again. The ball flies past them; a power-up only
reacts to the paddle. At 3.0 s they have fallen out of the window – but nothing destroys them yet, so they are still in
the vector, drawn below the window.

```quiz
`UpdatePowerUps` ends with `game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(), […](…) { … }), game.PowerUps.end());`. What does `std::remove_if` on its own do?
- [ ] It erases the matching elements and makes the vector shorter
- [ ] It returns a new vector without the matching elements
- [x] It moves the elements to keep to the front, in their order, and returns an iterator to the first element after them; the vector's size doesn't change, which is why `erase` follows
- [ ] It sets the matching elements' `Destroyed` flag
---
An algorithm only sees iterators, not the container, so it can't change the container's size. `erase` from the returned iterator to `end()` removes the leftovers.
```

```quiz
A power-up that is caught is marked `Destroyed` and `Activated`. Why isn't it erased right away?
- [x] Because its duration is counted down in the vector: only when it has run out and `UpdatePowerUps` sets `Activated` to false is it destroyed *and* not activated – and erased
- [ ] Because a caught power-up must still be drawn for the rest of its duration
- [ ] Because `std::remove_if` can't erase the last element
- [ ] Because a destroyed power-up could still collide with the ball
---
`Render` skips destroyed power-ups, so a caught one is invisible while its effect lasts. One with a duration of 0 runs out in the same frame it was caught.
```

## Activating the power-ups

For every power-up that is not destroyed, `DoCollisions` now checks, after the blocks, whether it reached the bottom of
the window or collided with the paddle. In both cases it is destroyed, but when it collided with the paddle, it is
also activated:

:::opengl d3d12
```cpp
// also check collisions on PowerUps and if so, activate them
for (PowerUp& powerUp : game.PowerUps)
{
    if (!powerUp.Destroyed)
    {
        // first check if powerup passed bottom edge, if so: keep as inactive and destroy
        if (powerUp.Position.y >= game.Height)
            powerUp.Destroyed = true;

        if (CheckCollision(Player, powerUp))
        {   // collided with player, now activate powerup
            ActivatePowerUp(powerUp);
            powerUp.Destroyed = true;
            powerUp.Activated = true;
        }
    }
}
```
:::
:::vulkan
```cpp
// also check collisions on PowerUps and if so, activate them
for (PowerUp& powerUp : game.PowerUps) {
    if (!powerUp.Destroyed) {
        // first check if powerup passed bottom edge, if so: keep as inactive and destroy
        if (powerUp.Position.y >= game.Height)
            powerUp.Destroyed = true;

        if (CheckCollision(Player, powerUp)) { // collided with player, now activate powerup
            ActivatePowerUp(powerUp);
            powerUp.Destroyed = true;
            powerUp.Activated = true;
        }
    }
}
```
:::

`CheckCollision(Player, powerUp)` is the **AABB** overload of `collision-detection`: the paddle and the power-up are
both plain game objects (a `PowerUp` is a `GameObject`), so the overload for two boxes is chosen – the other one takes
the ball first. Activating a power-up is the job of `ActivatePowerUp`: it checks the type and changes the game's state.
For the sticky and pass-through effects it also changes the colour of the paddle and the ball, to give the player some
feedback as to which effect is currently active:

:::opengl
```cpp
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        Ball.Velocity *= 1.2f;
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = glm::vec3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = glm::vec3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```
:::
:::vulkan
```cpp
void ActivatePowerUp(PowerUp& powerUp) {
    if (powerUp.Type == "speed") {
        Ball.Velocity *= 1.2f;
    } else if (powerUp.Type == "sticky") {
        Ball.Sticky = true;
        Player.Color = glm::vec3(1.0f, 0.5f, 1.0f);
    } else if (powerUp.Type == "pass-through") {
        Ball.PassThrough = true;
        Ball.Color = glm::vec3(1.0f, 0.5f, 0.5f);
    } else if (powerUp.Type == "pad-size-increase") {
        Player.Size.x += 50;
    } else if (powerUp.Type == "confuse") {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    } else if (powerUp.Type == "chaos") {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```

Nothing new for Vulkan here: a caught confuse power-up only sets `Effects.Confuse`, which the next frame's
`Render(Effects, …)` pushes to the postprocessing shader.
:::
:::d3d12
```cpp
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        XMStoreFloat2(&Ball.Velocity, XMLoadFloat2(&Ball.Velocity) * 1.2f);
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = XMFLOAT3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = XMFLOAT3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```

The speed power-up is learnopengl's `Ball->Velocity *= 1.2` as a DirectXMath step. A caught confuse power-up only sets
`Effects.Confuse`, which the next frame's `Render(Effects, …)` hands to the postprocessing shader as a root constant.
:::

Confuse is only switched on if chaos is not active, and the other way round: the two shouldn't be on at the same time.

Now do the task **activate**. At 1.5 s nothing has changed. At 3.0 s: **the confused picture – upside down, mirrored,
inverted – with a 150-pixel paddle at the top.** Here is what happened. The ball was lost in frame 151 and put back on
the paddle in the middle of the window (x 350…450). In frame 161 the falling pills reach the paddle's top edge; the
pad-size-increase pill (x 370…430) overlaps the paddle and is caught first – the loop visits it before the confuse
pill – and the paddle grows to 150 pixels (x 350…500). In the same loop the confuse pill (x 480…540) now overlaps the
wider paddle and is caught too: **the screen is confused** for 15 seconds. The other four pills miss the paddle, fall
out of the window, are destroyed in frame 177 and erased. The pad-size one, with a duration of 0, runs out in the same
frame's `UpdatePowerUps` and is erased; the confuse one stays in the vector, active, until its 15 seconds are over.

```quiz
The confuse pill lies at x = 480…540, beyond the normal paddle (350…450). Why is it caught in frame 161 anyway?
- [ ] Because a power-up is caught when it gets within 50 pixels of the paddle
- [ ] Because the confuse effect mirrors the paddle to the other side
- [x] Because the loop checks the power-ups in their order: the pad-size-increase pill comes first, widens the paddle to 350…500, and when the loop reaches the confuse pill, the wider paddle overlaps it
- [ ] Because confuse has a chance of 1 in 15 and was lucky
---
`ActivatePowerUp` changes `Player.Size` immediately, inside the loop. Had the confuse pill come first in the vector, it would have been missed in that frame – and caught in the next one, while it still overlaps the paddle's top.
```

## Spawning power-ups

Each time a block is destroyed we would like to, given a small chance, spawn a power-up. learnopengl's `ShouldSpawn`
returns true with a chance of 1 in `chance`, and `SpawnPowerUps` gives each kind its own chance: 1 in 75 for the
positive ones, 1 in 15 for the negative ones, which should spawn more often. A new power-up starts at the destroyed
block's position:

:::opengl
```cpp
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}
```
:::
:::vulkan
```cpp
bool ShouldSpawn(unsigned int chance) {
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block) {
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").DescriptorSet));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").DescriptorSet));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").DescriptorSet));
}
```
:::
:::d3d12
```cpp
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", XMFLOAT3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", XMFLOAT3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", XMFLOAT3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", XMFLOAT3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", XMFLOAT3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}
```
:::

`DoCollisions` calls it right after a block is destroyed – the `if` now needs braces around its two statements:

:::opengl d3d12
```cpp
if (!box.IsSolid)
{
    box.Destroyed = true;
    SpawnPowerUps(game, box);
}
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::
:::vulkan
```cpp
if (!box.IsSolid) {
    box.Destroyed = true;
    SpawnPowerUps(game, box);
} else { // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::

`rand()` is the C library's: without `srand` every run gets the same sequence, as the particles do.
:::d3d12
On Windows a Direct3D 12 program gets MSVC's `rand()`, another sequence (with `RAND_MAX` 32767) than the glibc one
the course's pictures were measured with: in a real game other power-ups would spawn. The course's pictures don't
depend on it – with the fixed input `SpawnPowerUps` never runs.
:::

Now do the task **spawn-powerups**. No block is destroyed, so nothing spawns and `rand()` is not even called – the
particles' random numbers stay as they were: **no visible change**.

## Sticky and pass-through

The sticky and pass-through effects need two small changes in `DoCollisions`. The sticky effect: at the end of the
paddle bounce, the ball's `Stuck` becomes its `Sticky` – if the sticky effect is active, the ball stays on the paddle
whenever it lands there, and the player has to press the space bar again to release it:

```cpp
Ball.Stuck = Ball.Sticky;
```

The pass-through effect: when the ball's `PassThrough` is set, we do not perform any collision resolution on the
non-solid blocks – they are destroyed, but the ball flies on:

:::opengl d3d12
```cpp
if (!(Ball.PassThrough && !box.IsSolid)) // don't do collision resolution on non-solid bricks if pass-through is activated
```
:::
:::vulkan
```cpp
if (!(Ball.PassThrough && !box.IsSolid)) { // don't do collision resolution on non-solid bricks if pass-through is activated
```
:::

And `ResetPlayer` – a lost ball – switches every power-up effect off again:

:::opengl vulkan
```cpp
// also disable all active powerups
Effects.Chaos = Effects.Confuse = false;
Ball.PassThrough = Ball.Sticky = false;
Player.Color = glm::vec3(1.0f);
Ball.Color = glm::vec3(1.0f);
```
:::
:::d3d12
```cpp
// also disable all active powerups
Effects.Chaos = Effects.Confuse = false;
Ball.PassThrough = Ball.Sticky = false;
Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

Now do the task **sticky-pass**. The ball is reset in frame 151, before the pills are caught in frame 161, and it
never meets a block it could pass or a paddle it could stick to: **no visible change** – the 3.0 s picture stays
confused. Combine all this and we have a working power-up system that not only makes the game more fun, but also a lot
more challenging.

```quiz
The speed and pad-size-increase power-ups have a duration of 0. What does that mean?
- [ ] They are never activated
- [ ] Their effect lasts until the level is reset
- [ ] Their effect lasts exactly one frame
- [x] Their effect is permanent: the power-up runs out in the frame it is caught, but `UpdatePowerUps` has nothing to switch off for these two types – only `ResetPlayer` sets the paddle's size back
---
`UpdatePowerUps` only resets sticky, pass-through, confuse and chaos. `ResetPlayer` gives the paddle its `PLAYER_SIZE` and the ball its initial velocity again.
```

:::opengl
```quiz
`DoCollisions` calls `CheckCollision(Player, powerUp)`. Which overload is it, and why?
- [ ] The circle overload, because the power-up is round at its ends
- [x] The AABB overload `CheckCollision(GameObject&, GameObject&)`: the paddle is a `GameObject` and a `PowerUp` is one too, while the circle overload takes a `BallObject&` first
- [ ] Neither: a power-up uses its own collision function
- [ ] The circle overload, because `PowerUp` derives from `BallObject`
---
C++ picks the overload from the arguments' types. A `PowerUp&` converts to `GameObject&` (its base), not to `BallObject&`.
```
:::
:::vulkan
```quiz
What does the Vulkan project need for the power-ups beyond learnopengl's C++?
- [ ] A new pipeline for the power-ups
- [ ] A second render pass, because the power-ups fall in front of the blocks
- [x] Nothing in the Vulkan code: a power-up is one more sprite drawn with `DrawObject` into the off-screen pass, and a caught confuse power-up only sets `Effects.Confuse`, pushed to the post shader in the next frame – the six textures just take six more descriptor sets from the pool
- [ ] A storage buffer with all power-ups
---
That is the advantage of building the game on the sprite renderer and the postprocessor: the game logic doesn't touch the API.
```
:::
:::d3d12
```quiz
What does the Direct3D 12 project need for the power-ups beyond learnopengl's C++?
- [ ] A new pipeline state for the power-ups
- [ ] A second command list, because the power-ups fall in front of the blocks
- [x] Nothing in the Direct3D code: a power-up is one more sprite drawn with `DrawObject` into the multisampled target, and a caught confuse power-up only sets `Effects.Confuse`; the six textures take heap slots 7 to 12, and the postprocessor's texture moves to slot 13
- [ ] A structured buffer with all power-ups
---
That is the advantage of building the game on the sprite renderer and the postprocessor: the game logic doesn't touch the API.
```
:::

## Additional resources

- [Powerups](https://learnopengl.com/In-Practice/2D-Game/Powerups): learnopengl's chapter this chapter follows.
- [std::remove_if](https://en.cppreference.com/w/cpp/algorithm/remove) and
  [lambda expressions](https://en.cppreference.com/w/cpp/language/lambda): the erase-remove idiom and the predicate.
