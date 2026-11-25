# Project: The museum's orrery – milestones (Vulkan)

As the OpenGL project (`../../opengl/guest-articles-project/tasks.md`): the same start (`frustum-culling`'s
solution), the same milestones, times (2.0 s; the counter also at 5.0 s), places and checks
(`ts/packages/gp-course/src/Checks/TaskChecks.Project.GuestArticles.ts`).

**Vulkan's spelling of the solution:**
- The entities are built in the member `loadEntities()` (the root is the member `ourEntity`); the scene graph is
  updated in `recordCommandBuffer`, where `currentFrame` (glfwGetTime) is kept for the orbits and Bramble's turning.
- The title: `"Orrery - drawn: " + std::to_string(display) + ", culled: " + std::to_string(total - display)` with
  `glfwSetWindowTitle`.
- verify.sh runs the solution on lavapipe with the validation layer: the same picture as OpenGL at 2.0 s.
