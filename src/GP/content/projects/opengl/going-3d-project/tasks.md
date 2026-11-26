# Project: A tiny solar system – milestones (OpenGL)

The optional project after *Going 3D* (brief: `chapters/<lang>/going-3d-project.md`; checks:
`ts/packages/gp-course/src/Checks/TaskChecks.Project.Going3D.ts`). Nothing new is taught: the learner combines
the clear colour, the camera globals, model matrices (rotate, translate, scale and a matrix kept for the next body)
and a colour uniform mixed with the texture.

Start = `camera/solution` unchanged (files `main.cpp`, `shader_m.h`, `shader.vs`, `shader.fs`, `container.png`,
`awesomeface.png`): ten crates, cubes 0, 3, 6 and 9 turning, the free camera at (0, 0, 3) looking down -z.

The checks read the scene, not the code where they can: the clear colour, the `view` matrix (the camera's position
and where the origin lands in its view), and every draw's `model` matrix at 1, 2.3 and 3.7 s – where the body is, how
big (cube root of the determinant) and whether it turns. Sizes, distances and speeds are the learner's: the sun must be
at the origin, bigger than 1.3 and turning; the planet 1.2–10 units from the sun at a constant distance and somewhere
else later; the moon 0.25–2.5 units from the planet at a constant distance, its direction from the planet changing and
its distance to the sun not constant. Without input the camera stays at its starting place, so the pictures below are
the starting view at 1 s (measured with the course's simulator; the runs under Mesa with `verify.sh` agree).

## `night-sky`
- **Task:** Clear the window to a night sky: almost black, perhaps with a hint of blue.
- **Hint:** `glClearColor` in the render loop, e.g. (0.02, 0.02, 0.08).
- **When done:** `glClearColor(0.02f, 0.02f, 0.08f, 1.0f);`. The ten crates on a dark blue-black background. Check:
  every channel of the clear colour ≤ 0.12 (blue ≤ 0.2).

## `observatory`
- **Task:** Start the camera above and behind the middle of the world, looking down at it, keeping the free camera.
- **Hint:** `cameraPos` (0, 6, 8), `cameraFront` (0, -0.6, -0.8), `pitch` -36.87° so the mouse continues from there.
- **When done:** the globals `cameraPos = glm::vec3(0.0f, 6.0f, 8.0f)`, `cameraFront = glm::vec3(0.0f, -0.6f, -0.8f)`
  (with a comment: (0, -6, -8) is 10 long) and `pitch = -36.87f`. The crates seen from above, in the upper part of the
  window. Check: the camera (from the view matrix) at least 1 above y = 0 and 5 from the origin, the origin in front of
  it and within the middle of the view.

## `sun`
- **Task:** Replace the ten crates with one crate at the origin, about twice as big, turning around the y axis.
- **Hint:** One draw with `rotate(time · 20°, y)` and `scale(2)`; `cubePositions` goes.
- **When done:** `cubePositions` removed; the loop replaced by `float time = static_cast<float>(glfwGetTime());` and
  the sun's `model` (`glm::rotate(model, glm::radians(time * 20.0f), glm::vec3(0.0f, 1.0f, 0.0f))`,
  `glm::scale(model, glm::vec3(2.0f))`) with one `glDrawArrays`. One big crate in the middle of the window, its top
  visible, turning slowly.

## `planet`
- **Task:** A second, smaller crate circling the sun at a fixed distance.
- **Hint:** An orbit matrix `planet`: `rotate(time · 30°, y)` then `translate(3, 0, 0)`; the draw scales it by 0.6.
- **When done:** `glm::mat4 planet` (rotate, translate) and `model = glm::scale(planet, glm::vec3(0.6f))`, drawn. At
  1 s the planet is to the right of the sun and a little behind it (30° along its orbit); one turn takes 12 s.

## `moon`
- **Task:** A third, smaller crate circling the planet while the planet circles the sun.
- **Hint:** Start from `planet`: `rotate(planet, time · 120°, y)`, `translate(1, 0, 0)`, `scale(0.3)`.
- **When done:** the moon drawn with that matrix. A small crate next to the planet that goes wherever the planet
  goes; its direction from the planet turns 150° per second (120° on top of the planet's own 30°).

## `colours`
- **Task:** Give every body its own colour, mixed with the texture so the wood still shows.
- **Hint:** `uniform vec3 bodyColor;` in `shader.fs`, `mix(texColor, vec4(bodyColor, 1.0), 0.6)`, `setVec3` per draw.
- **When done:** `shader.fs` mixes the old texture colour 40/60 with `bodyColor`; `main.cpp` sets (1.0, 0.8, 0.2) for
  the sun, (0.2, 0.4, 1.0) for the planet, (0.7, 0.7, 0.7) for the moon. A golden sun with the face still smiling
  through, a blue planet and a grey moon. Check: the sun's and another body's colour uniforms differ by more than 0.25
  in a channel, and the uniform's name is used in the shaders besides its declaration.
