# Collision detection

When trying to determine if a collision occurs between two objects, we generally do not use the vertex data of the
objects themselves since these objects often have complicated shapes; this in turn makes the collision detection
complicated. For this reason, it is a common practice to use more simple shapes (that usually have a nice mathematical
definition) for collision detection that we overlay on top of the original object. We then check for collisions based
on these simple shapes; this makes the code easier and saves a lot of performance. A few examples of such collision
shapes are circles, spheres, rectangles, and boxes; these are a lot simpler to work with compared to arbitrary meshes
with hundreds of triangles.

While the simple shapes do give us easier and more efficient collision detection algorithms, they share a common
disadvantage in that these shapes usually do not fully surround the object. The effect is that a collision may be
detected that didn't really collide with the actual object; one should always keep in mind that these shapes are just
approximations of the real shapes.

Collisions are learnopengl's two chapters, and the course's too: this one *detects* them – does the ball overlap a
brick? – and destroys the brick; the next one *resolves* them – how does the ball bounce off? Until then, the ball
destroys what it touches and flies on. None of this is specific to an API: it is plain C++ on the CPU, run in every
frame before anything is drawn, the same in all three versions of the game.

## AABB – AABB collisions

AABB stands for *axis-aligned bounding box*, a rectangular collision shape aligned to the base axes of the scene, which
in 2D aligns to the x and y axis. Being axis-aligned means the rectangular box has no rotation and its edges are
parallel to the base axes of the scene (e.g. left and right edge are parallel to the y axis). The fact that these boxes
are always aligned to the axes of the scene makes calculations easier. Picture the ball: its AABB is the square of its
sprite, 25 × 25 pixels, which also covers the four transparent corners outside the round ball.

Almost all the objects in Hedgerow are rectangular based objects, so it makes perfect sense to use axis aligned
bounding boxes for detecting collisions. This is exactly what we're going to do.

Axis aligned bounding boxes can be defined in several ways. One of them is to define an AABB by a top-left and a
bottom-right position. The `GameObject` class that we defined already contains a top-left position (its `Position`
vector), and we can easily calculate its bottom-right position by adding its size to the top-left position
(`Position + Size`). Effectively, each `GameObject` contains an AABB that we can use for collisions.

So how do we check for collisions? A collision occurs when two collision shapes enter each other's regions, e.g. the
shape that determines the first object is in some way inside the shape of the second object. For AABBs this is quite
easy to determine due to the fact that they're aligned to the scene's axes: we check for each axis if the two object'
edges on that axis overlap. So we check if the horizontal edges overlap, and if the vertical edges overlap of both
objects. If both the horizontal **and** vertical edges overlap we have a collision.

Imagine two boxes next to each other: their x ranges overlap if the right edge of the first is to the right of the left
edge of the second, *and* the right edge of the second is to the right of the left edge of the first. If only one of
the two axes overlaps – two bricks of the same row far apart have the same y range – the boxes do not touch. Translating
this concept to code is relatively straightforward. We check for overlap on both axes and if so, return a collision:

:::opengl
```cpp
bool CheckCollision(GameObject& one, GameObject& two)
{
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::
:::vulkan
```cpp
bool CheckCollision(GameObject& one, GameObject& two) { // AABB - AABB collision
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::
:::d3d12
```cpp
bool CheckCollision(GameObject& one, GameObject& two)
{
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::

We check if the right side of the first object is greater than the left side of the second object and if the second
object's right side is greater than the first object's left side; similarly for the vertical axis.

The course puts the collision code in a new section after the game's globals (`Hedgerow`, `Renderer`, `Player`,
`Ball`) – it needs the ball – and before `Init` (learnopengl has it in `game.cpp`). The `// TODO:` comments in the
project mark where each piece goes. Now do the first task, **aabb**. Nothing calls it yet.

```quiz
Brick A covers x 0…53, y 0…37; brick B covers x 60…113, y 0…37. Does `CheckCollision(A, B)` report a collision?
- [x] No: their y ranges overlap, but on x A's right edge (53) is left of B's left edge (60)
- [ ] Yes: their y ranges are the same
- [ ] Yes: any two bricks of the same row collide
- [ ] No, because bricks are never tested against each other
---
Both axes must overlap. Bricks are in fact never tested against each other in the game – only the ball against each brick and against the paddle.
```

### Checking for collisions

Now we want to check for collisions between the ball and each brick in the level. If the ball collides with a brick,
we destroy the brick – unless it is solid. learnopengl's `Game::DoCollisions` becomes a free function taking the game:

:::opengl
```cpp
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            if (CheckCollision(Ball, box))
            {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::
:::vulkan
```cpp
void DoCollisions(Game& game) {
    for (GameObject& box : game.Levels[game.Level].Bricks) {
        if (!box.Destroyed) {
            if (CheckCollision(Ball, box)) {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::
:::d3d12
```cpp
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            if (CheckCollision(Ball, box))
            {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::

The loop takes each brick by reference, `GameObject& box`: setting `box.Destroyed = true` must change the brick in the
level, not a copy of it. A destroyed brick is skipped – it is no longer drawn (`DrawLevel` checks the same flag) and no
longer collides. Then we need to update the game's `Update` function: after the ball has moved, check for collisions,
as learnopengl does:

```cpp
    // check for collisions
    DoCollisions(game);
```

`CheckCollision(Ball, box)` passes the ball where a `GameObject&` is expected – its `GameObject` part, with its 25 × 25
box. Now do the task **do-collisions**. Build and run: the expected result is now at **3.0 s** (frame 180), and **the
ball has cut a channel through the wall**: ten bricks are gone – the blue, green and yellow ones of columns 9, 10 and 11
and one orange brick at the top –, and the moon shows through the gap. The ball itself is back in the open sky, on its
way down to the right. Its path is still the one of the Ball chapter: nothing bounces yet, so the ball flies through the
bricks it destroys, off the top edge and down again through the next column.

Look at the row of stones below the coloured bricks: the ball flew through the stone of column 9 on its way up, and
the stone is still there. Solid bricks are never destroyed – and since nothing bounces yet, they don't stop the ball
either.

```quiz
Why does the loop in `DoCollisions` take each brick by reference (`for (GameObject& box : …)`)?
- [ ] Because a range-for loop cannot copy structs
- [ ] Because it is faster, and the result would be the same with a copy
- [x] Because `box.Destroyed = true` has to change the brick in the level: with a copy only the copy would be destroyed, and the brick would be drawn and hit again
- [ ] Because `CheckCollision` only accepts references
---
`DrawLevel` and the next frame's `DoCollisions` both look at the bricks in `game.Levels[game.Level].Bricks`. Only a reference reaches them.
```

## AABB – Circle collision detection

Because the ball is a circle-like object, an AABB is probably not the best choice for the ball's collision shape. The
collision code thinks the ball is a rectangular box, so the ball often collides with a brick even though the ball
sprite itself isn't yet touching the brick: the corners of the box reach a brick before the round ball does.

It makes much more sense to represent the ball with a circle collision shape instead of an AABB. For this reason we
included a `Radius` variable within the ball object. To define a circle collision shape, all we need is a position
vector and a radius. This does mean we have to update the detection algorithm since it currently only works between
two AABBs. Detecting collisions between a circle and a rectangle is a bit more complicated, but the trick is as
follows: we find the point on the AABB that is closest to the circle, and if the distance from the circle to this point
is less than its radius, we have a collision.

The difficult part is getting this closest point P on the AABB. Picture the ball's centre C somewhere outside a brick,
for example down and to the right of it, and the brick's centre B. The vector from B to C, the *difference* D = C − B,
points from the middle of the brick to the ball. Now *clamp* D to the brick's half extents: limit its x to −w/2 … +w/2
and its y to −h/2 … +h/2, where w and h are the brick's width and height. The clamped vector R can no longer reach
outside the brick: B + R is a point on the brick's edge (or inside it, if C is inside), and it is the point of the
brick closest to C. If C is below the brick, only y is clamped and P lies on the bottom edge right above C; if C is down
and to the right, both are clamped and P is the brick's bottom-right corner.

A clamp operation clamps a value to a value within a given range. This is often expressed as:

```cpp
float clamp(float value, float min, float max) {
    return std::max(min, std::min(max, value));
}
```

For example, a value of 42.0f is clamped to 6.0f with a range of 3.0f to 6.0f, and a value of 4.20f would be clamped
to 4.20f. Clamping a 2D vector means we clamp both its x and its y component within the given range.

This clamped vector R is now the vector from the AABB's center to the AABB's closest point to the circle. Using this
vector we can now calculate the distance to the circle, P − C, and compare its length with the ball's radius. In code
this looks like:

:::opengl
```cpp
bool CheckCollision(BallObject& one, GameObject& two)
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
    return glm::length(difference) < one.Radius;
}
```
:::
:::vulkan
```cpp
bool CheckCollision(BallObject& one, GameObject& two) { // AABB - Circle collision
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
    // retrieve vector between center circle and closest point AABB and check if length <= radius
    difference = closest - center;
    return glm::length(difference) < one.Radius;
}
```
:::
:::d3d12
```cpp
bool CheckCollision(BallObject& one, GameObject& two)
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
    return XMVectorGetX(XMVector2Length(difference)) < one.Radius;
}
```

learnopengl's glm lines, one for one, in DirectXMath: the stored `XMFLOAT2`s are loaded into `XMVECTOR`s to compute.
`XMVectorReplicate(one.Radius)` puts the radius into all four components (glm's `one.Position + one.Radius` adds the
float to both), `XMVectorSet` builds a vector from components, `XMVectorClamp` is `glm::clamp` per component, and
`XMVector2Length` returns the length of the x and y components – in every component of the result, so `XMVectorGetX`
takes it out as a float. The z and w components (zero or the radius here) don't matter: the `2` functions read x and
y only.
:::

The ball's `Position` is its top-left corner, so its centre is `Position + Radius` in both directions. Note the `<`:
a ball that exactly touches a brick does not collide – that will matter in the next chapter, where a collision moves
the ball out until it exactly touches.

**One name, two functions.** This `CheckCollision` has the same name as the AABB one, with other parameter types – an
*overload*. C++ chooses between overloads by the arguments of each call: for `CheckCollision(Ball, box)` the version
taking a `BallObject&` is an exact match for the ball, while the `GameObject&` version would need the conversion to the
base class – so the circle version wins. Before it existed, the same call chose the AABB version. One thing to keep in
mind: a call only sees the overloads declared *before* it, which is why the circle version goes between the AABB
version and `DoCollisions`. (learnopengl has both as overloads too.)

Now do the task **circle**. Build and run: the picture at 3.0 s is the same, pixel for pixel. The round ball meets the
same ten bricks on its path – only some of them a frame later, because the corners of the box reached them before the
circle did. At 1.75 s, for instance, the box version had already destroyed four bricks, the circle version three; the
fourth follows a frame later. The difference is small at this speed, but it is the difference between a ball that hits a
brick and one that misses it by a corner – it shows when the ball grazes a brick.

```quiz
The ball's centre C is straight below a brick whose centre is B, a little to the right of B but within the brick's width. Where is the closest point P that the circle test measures the distance to?
- [ ] At the brick's bottom-right corner
- [ ] At the brick's centre B
- [x] On the brick's bottom edge, straight above C: only the y component of C − B is clamped (to h/2), the x component is already within the half width
- [ ] At the ball's centre C, because it is outside the brick
---
Clamping keeps the components that are already inside the box's half extents and cuts off the others. Down and to the right of the brick, both would be cut off and P would be the corner.
```

```quiz
After the task circle, why does `CheckCollision(Ball, box)` in `DoCollisions` use the circle test, although the call did not change?
- [ ] Because the AABB version was deleted
- [x] Because the new overload taking a `BallObject&` matches the ball exactly, while the `GameObject&` one needs a conversion to the base class – C++ picks the better match
- [ ] Because C++ always calls the function defined last
- [ ] Because `Radius` is not zero
---
Overload resolution compares the conversions each candidate needs. A reference to the exact type beats a reference to a base class. The paddle is a plain `GameObject`, so a call with it would still pick the AABB version.
```

## Additional resources

- [Collision detection](https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-detection): learnopengl's
  chapter this chapter follows, with its pictures of the AABBs and the closest point.
- [Overload resolution](https://en.cppreference.com/w/cpp/language/overload_resolution): how C++ picks a
  `CheckCollision`.

:::d3d12
- [XMVectorClamp](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmvectorclamp):
  DirectXMath's clamp.
:::
