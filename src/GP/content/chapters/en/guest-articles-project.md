# Project: The museum's orrery

The town museum has a treasure: a brass orrery, two hundred years old – a clockwork model of a little solar system in
which a crank turns the sun's gears, the sun's gears turn the planets, and one planet's gears turn its moon. Last week
it seized up. The clockmaker says it will take him until spring, and the museum reopens on Friday.

"Could you build it in the computer?" asks the curator, polishing his glasses. "Just for the screen next to the empty
display case. The visitors only want to see it go round." Then, a little embarrassed: "The museum's computer is rather
old. Please don't make it draw anything nobody can see."

An orrery is a scene graph made of brass: every part moves with the part it hangs on. You have everything you need from
the *Scene Graph* and *Frustum Culling* chapters – nothing here is new; the challenge is to put it together yourself.
You start from the Frustum Culling chapter's finished program: its grid of ringed planets, its culling and its counter
in the window title. (In this orrery every body wears rings – the workshop's trademark.)

## The assignment

1. **The sun.** Replace the grid with the orrery's sun: the root entity alone, at the origin, one and a half times the
   model's size. The sun is fixed to its stand: it no longer turns.
2. **The planets.** Hang three planets on the sun – children of the root entity, lined up on its x axis: *Pip* at 2.4
   with the scale 0.2, *Bramble* at 4 with the scale 0.35 and *Old Gourd* at 6 with the scale 0.4. These are local
   values, in the sun's units: a child inherits its parent's scale, so in the world they lie one and a half times as
   far out and are one and a half times as large.
3. **The orbits.** Let every planet circle the sun at its own speed, counter-clockwise seen from above and starting
   from where it hangs now: Pip 80 degrees per second, Bramble 40, Old Gourd 20.
4. **The moon.** Give Bramble a moon, *Burr*: a child of Bramble, 2.5 Bramble units from it with the scale 0.35. Bramble
   turns about its own axis at 120 degrees per second – and carries Burr round with it, just like the gears do.
5. **The counter.** Show in the window title how many of the orrery's bodies are drawn and how many the frustum culled.
   At five seconds Bramble has swung far out to the left, and the title should show a body culled.

The milestones in the list next to this text are checked automatically when you click *Check my code*: the course's
simulator runs your program and looks for the bodies where the orbits must have taken them.

## Tips along the way

- Remember the dirty flag: `setLocalPosition`, `setLocalRotation` and `setLocalScale` only mark an entity dirty, and
  `updateSelfAndChild` recomputes what changed – and everything below it. Set the new positions every frame *before*
  the graph is updated and drawn.
- The children are stored by value in a `std::vector`. Adding a child to the sun can move the other children in
  memory, so a pointer or reference to a planet is only safe once all the planets are added. Add the moon afterwards.
- Counter-clockwise seen from above, starting on the x axis: with `angle = speed × time`, the position on a circle of
  radius `r` is `(r · cos(angle), 0, −r · sin(angle))` – the same direction a positive rotation about the y axis takes.
  Remember that `cos` and `sin` want radians.
- A planet's own turning (its local rotation) does not move the planet, but it turns everything that hangs on it.
- `drawSelfAndChild` already counts: `display` is what was drawn and `total` what was visited, so the culled bodies
  are the difference.
:::opengl
- The render loop already reads the time: `currentFrame`.
:::
:::vulkan
- The scene graph is updated in `recordCommandBuffer`, where `currentFrame` holds the time.
:::
:::d3d12
- The scene graph is updated in `OnUpdate`, where `time` holds the seconds since the start.
:::

## Want to do more?

When the milestones are done, the orrery is yours. Tilt Old Gourd's axis a little, give Pip an oval orbit, add a comet
that swoops in close to the sun, or a second moon for Old Gourd. Let the camera circle the orrery slowly and watch the
counter: the frustum follows the camera. Try bounding spheres instead of boxes and compare the counts. And think about
this one before you try it: why must culling the sun *not* cull its planets?
