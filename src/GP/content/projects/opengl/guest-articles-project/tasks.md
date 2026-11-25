# Project: The museum's orrery – milestones (OpenGL)

The optional project after the Guest Articles (`chapters/<lang>/guest-articles-project.md`): an orrery as a scene graph
with frustum culling. Its milestones are tasks like a lesson's; the checks are
`ts/packages/gp-course/src/Checks/TaskChecks.Project.GuestArticles.ts`.

**Screenshot time: 2.0 s**; the counter is also read at 5.0 s. All APIs use these times.

**Start:** `frustum-culling`'s solution unchanged (`main.cpp`, `shader_m.h`, `mesh.h`, `model.h`,
`model_loading.vs/.fs`, `models/` with the course's ringed planet): the root planet and the 10 × 10 grid turning at
20°/s, AABB culling with the camera's frustum, the title "LearnOpenGL - drawn: 38 / 101" at 2.0 s. Camera (3, 6, 12),
pitch −25, fov 45, 800/600, near 0.1, far 100; clear 13,13,13. A light scene for the simulator: at most 5 bodies
(10 model draws) instead of 101.

**The solution's choices** (local values are in the parent's units; the checks accept other code that puts the bodies
in the same places, and either direction of turning):
- `sun`: the grid's loops go; the root gets `setLocalScale(…, glm::vec3(1.5f, 1.5f, 1.5f))`; the render loop's
  `setLocalRotation` of the root goes (the sun stands still), its `updateSelfAndChild` stays.
- `planets`: a loop over `planetDistances[3] = { 2.4f, 4.0f, 6.0f }` and `planetScales[3] = { 0.2f, 0.35f, 0.4f }`:
  `addChild(ourEntity, ourModel)`, then `setLocalPosition` / `setLocalScale` on `ourEntity.children.back()` (Pip,
  Bramble, Old Gourd: in the world at x = 3.6, 6 and 9 with scales 0.3, 0.525, 0.6).
- `orbits`: in the render loop before `updateSelfAndChild`: `angle = glm::radians(orbitSpeeds[i] * currentFrame)`
  with speeds 80, 40, 20 °/s and `setLocalPosition(ourEntity.children[i].transform, glm::vec3(r * cos(angle), 0.0f,
  -r * sin(angle)))` – counter-clockwise seen from above, the direction of a positive rotation about y.
- `moon`: after the planets (the children vector must not grow any more once a reference into it is kept):
  `addChild(ourEntity.children[1], ourModel)`, local position (2.5, 0, 0), scale 0.35 (in the world 1.3125 from
  Bramble, scale 0.18); in the loop `setLocalRotation(ourEntity.children[1].transform, glm::vec3(0.0f, 120.0f *
  currentFrame, 0.0f))`.
- `counter`: the title `"Orrery - drawn: " + std::to_string(display) + ", culled: " + std::to_string(total - display)`.

**What the camera sees** (the checks project the bodies' world positions through the camera and test "drawn" = not
13,13,13 at those points): the sun's centre (238,320); its 1.5 × sphere and ring reach (232,250) and (120,390), which
the model at scale 1 does not. At 2.0 s on their orbits: Pip (82,292) (160°, left of the sun), Bramble (324,218) (80°,
behind the sun), Old Gourd (551,219) (40°), the moon (293,233) (left of Bramble). The title: "Orrery - drawn: 5,
culled: 0" at 2.0 s and "Orrery - drawn: 4, culled: 1" at 5.0 s (Bramble at 200°, far out to the left).

## `sun`
- **Task:** The orrery's sun alone at the origin, 1.5 times the model's size; it no longer turns.
- **When done:** one large ringed planet left of the centre; the grid's points (680,459), (396,76), (429,327) empty.
  Title "LearnOpenGL - drawn: 1 / 1".

## `planets`
- **Task:** Three planets as children of the sun on its x axis: 2.4 / 0.2, 4 / 0.35, 6 / 0.4.
- **When done:** three ringed planets to the right of the sun, ever larger and farther (world x 3.6, 6, 9).

## `orbits`
- **Task:** Each planet circles the sun counter-clockwise from the x axis: 80, 40 and 20 degrees per second.
- **When done:** at 2.0 s the planets where their orbits have taken them (above); the x axis's places at 6 and 9 empty.

## `moon`
- **Task:** Bramble's moon: a child of Bramble at 2.5 with scale 0.35; Bramble turns at 120 degrees per second.
- **When done:** at 2.0 s the small moon at (293,233), left of Bramble.

## `counter`
- **Task:** The title shows the drawn and the culled bodies.
- **When done:** the title at 2.0 s has 5 and 0, at 5.0 s 1 culled (and 4 drawn). This is the solution.
