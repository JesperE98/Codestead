# Project: Hedgerow goes to the fair – milestones (Vulkan)

As the OpenGL project (`../../opengl/in-practice-project/tasks.md`): the same start (the finished Hedgerow of
`render-text` plus an empty `levels/five.lvl`), the same milestones, times (3.0 s, and 1.0 s for the fade), points
and checks (`ts/packages/gp-course/src/Checks/TaskChecks.Project.InPractice.ts`).

**Vulkan's spelling of the solution:**
- Init is the application class's member `Init(Game& game)`; textures are descriptor sets:
  `GetTexture("powerup_increase").DescriptorSet` for the extra life.
- `sparks`: `glm::vec4(rColor, rColor * 0.7f, rColor * 0.1f, 1.0f)`; `GameObject Sparkler;` among the globals, its
  Position (120, 500) and Velocity (0, 1200) set in Init after InitParticles; `Update(Particles, dt, Sparkler, 2);`.
- `fade-in`: `shaders/post_processing.frag` already has `time` in its push constant block: `color.rgb *= clamp(pc.time
  / 2.0, 0.0, 1.0);` at the end of main (compiled to `post_processing.frag.spv` again).
- verify.sh runs the solution on lavapipe with the validation layer: the same picture as OpenGL at 3.0 s.
