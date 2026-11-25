# Project: The hall of worlds – milestones (OpenGL)

The optional project after *Model Loading* (`chapters/<lang>/model-loading-project.md`). The start is the *Model*
chapter's solution unchanged (`main.cpp`, `shader_m.h`, `mesh.h`, `model.h`, `model_loading.vs`, `model_loading.fs`
and `models/` with `planet.obj`): the lit planet with its ring, camera at (0, 0, 3). The milestones draw the same model
several times with model matrices of their own; the checks (`Checks/TaskChecks.Project.ModelLoading.ts`) look at the
picture only, by where something is drawn, so other sizes, positions and angles near the described ones pass.

The finished picture (simulator and Mesa agree): dark grey background; the turning planet in the middle
(x ≈ 280..520, y ≈ 240..360), the bronze exhibit on the left (x ≈ 35..230), the leaning one on the right
(x ≈ 575..765), all around y ≈ 300, and the shelf of five small planets at y ≈ 150..210 across the top.

## `make-room`
- **Task:** Step back so that the planet in the middle looks about half as large – the camera six units in front of it.
- **Hint:** Only where the camera starts: the global `cameraPos`.
- **When done:** `glm::vec3 cameraPos = glm::vec3(0.0f, 0.0f, 6.0f);`. The planet is half as large (about 130 px from
  pole to ring instead of 270). Check: drawn at (400, 300), and the drawn run through it along the column is under
  200 px.

## `exhibits`
- **Task:** Draw the model twice more, 2.2 units to the left and to the right, smaller (0.4), each with its own tilt.
- **Hint:** After `ourModel.Draw(ourShader)`: a new model matrix, `setMat4("model", …)` and `Draw` again – twice.
- **When done:** after the first draw, `model = glm::mat4(1.0f)` with `translate(-2.2, 0, 0)`, `rotate(50°, x)`,
  `scale(0.4)` and a draw; then `translate(2.2, 0, 0)`, `rotate(-20°, z)`, `rotate(15°, x)`, `scale(0.4)` and a draw.
  Check: `make-room`'s condition, and more than 8 % drawn in the boxes (30..250, 230..375) and (550..770, 230..375).

## `turntable`
- **Task:** The middle exhibit turns about the vertical axis, half a radian per second.
- **Hint:** `glm::rotate(model, (float)glfwGetTime() * 0.5f, glm::vec3(0.0f, 1.0f, 0.0f))` right after the translation.
- **When done:** the line after the middle exhibit's `translate`. Check: the picture changes over time, and more than
  15 pixels of the check frame in the box (270..530, 215..385) differ between 1 s and 2.3 s.

## `shelf`
- **Task:** Five small planets (0.2) two units apart at y = 1.5, z = -3, drawn in a loop, each tilted more.
- **Hint:** `for (unsigned int i = 0; i < 5; i++)`: `translate(-4 + 2i, 1.5, -3)`, `rotate(15° · i, x)`, `scale(0.2)`.
- **When done:** the loop before the buffer swap. Check: some row between y = 0 and 215 crosses at least four separate
  drawn pieces.

## `bronze`
- **Task:** The left exhibit's lit colour multiplied by a bronze tint (1.0, 0.6, 0.25); the others white.
- **Hint:** `uniform vec3 tint;`, `FragColor = vec4(result * tint, 1.0);`, `ourShader.setVec3("tint", …)` per draw.
- **When done:** `model_loading.fs` has `uniform vec3 tint;` and `FragColor = vec4(result * tint, 1.0);`; `main.cpp`
  sets the tint white before the middle exhibit's draw, bronze before the left one's and white again after it. Check:
  `exhibits`' condition; in the left box no ocean-blue pixel (blue over red by 0.08 and over green by 0.04) and at least
  15 bronze ones (green under 0.75 of red, blue under 0.5 of red – the untinted beige ring has green at 0.86 of red);
  in the middle box still some ocean.
