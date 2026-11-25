# Project: The glass pavilion

An architect has built a glass pavilion on a mountain meadow, for an exhibition of two marble sculptures. The opening
is next week, the brochure goes to print on Monday, and she wants a real-time walk-through to go with it. Her intern
got as far as your *Framebuffers* program before going on holiday: the two sculptures on a metal floor, drawn into an
off-screen framebuffer and shown through a screen quad – still with the edge-detection effect, so the whole pavilion
looks like a blueprint. "Lovely for the planning permission," says the architect. "Not so lovely for the visitors."

Make it a place people want to visit. Everything you need you learned in *Advanced OpenGL*: the challenge is
combining the chapters in one program – the depth and stencil tests, blending, framebuffers, cube maps and instancing
all at once.

You continue in your program from *Framebuffers*, with the edge-detection kernel as its effect. The textures you need
are the course's: the sky's six images (`skybox/` in *Cubemaps*) and the glass `window.png` from *Blending*.

## The assignment

1. **The brochure look.** Replace the edge detection with a softer effect: a vignette. In the middle the picture stays
   as it is; towards the corners it fades to black.
2. **Open the sky.** Bring the sky of *Cubemaps* into the pavilion: the cube map, drawn into the off-screen
   framebuffer as the last thing of the scene, so that it only fills the pixels nothing else has covered.
3. **The colonnade.** Behind the sculptures stands a row of five marble columns: the cube stretched to
   0.5 × 3 × 0.5, standing on the floor (from y = −0.5 up to 2.5), at x = −4, −2, 0, 2 and 4 and z = −4. All five come
   from **one** instanced draw call: the vertex shader puts each instance in its place.
4. **The star of the show.** The left sculpture, at (−1, 0, −1), is the masterpiece: give it a golden outline, for
   example (1.0, 0.8, 0.2), with the stencil buffer – the sculpture drawn once more, about 1.1 times larger, only around
   itself.
5. **The glass wall.** Between the two sculptures stands a pane of tinted glass: the window texture on the 1 × 1 quad
   of *Blending* (x from 0 to 1, y from −0.5 to 0.5), moved to (0.3, 0, −0.2) and blended over whatever is behind it.

The milestones in the list next to this text are checked automatically when you press **Check my code**. The checks
look at the picture your program draws, and – where the picture cannot tell – at what your draw calls do: that the sky
comes last, that the columns are one instanced draw, that the outline uses the stencil test and the glass blending.

## Tips along the way

- Each milestone has a chapter it comes from: the vignette from *Framebuffers* (only the screen shader changes), the
  sky from *Cubemaps*, the columns from *Instancing*, the outline from *Stencil testing* and the glass from *Blending*.
- A vignette needs to know how far a pixel is from the middle of the picture: its texture coordinates are 0.5, 0.5
  there. `smoothstep` turns a distance into a soft step from 0 to 1.
- The sky last: its depth must be exactly 1.0 (z = w in the vertex shader), and the depth test must let 1.0 pass
  where the depth buffer still holds the 1.0 it was cleared to.
- New shader files: the sky's (as in *Cubemaps*), the columns' vertex shader and the outline's one colour.
:::opengl
  In the course's files they are `skybox.vs` and `skybox.fs`, `columns.vs` (with the scene's `framebuffers.fs`) and
  `outline.fs` (with the scene's `framebuffers.vs`). In `columns.vs`, `gl_InstanceID` is the number of the instance.
:::
:::vulkan
  In the course's files they are `shaders/skybox.vert` and `shaders/skybox.frag`, `shaders/columns.vert` (with the
  scene's `framebuffers.frag`) and `shaders/outline.frag` (with the scene's `framebuffers.vert`). In `columns.vert`,
  `gl_InstanceIndex` is the number of the instance. Compile them to SPIR-V like the others.
:::
:::d3d12
  In the course's files they are `skybox.hlsl`, `columns.hlsl` (a vertex shader only: the scene's pixel shader colours
  the columns) and `outline.hlsl`. In `columns.hlsl`, a parameter with the semantic `SV_InstanceID` is the number of the
  instance.
:::
- The order of the draws in the off-screen pass matters: first everything opaque (the sculptures, the floor, the
  columns), then the sky, then the outline, which must not be hidden by anything, and the transparent glass last of all.
:::opengl
- The framebuffer of *Framebuffers* already has a stencil buffer: its renderbuffer is `GL_DEPTH24_STENCIL8`. Clear it
  every frame, and remember that `glStencilMask` also decides what `glClear` may clear.
:::
:::vulkan
- Each pipeline carries its own fixed functions, so the sky, the outline and the glass need pipelines of their own –
  and your pipeline helper a parameter or two more (the depth compare op, the stencil test, blending). The stencil
  buffer needs a depth format with stencil, cleared at the start of the offscreen render pass. The sky's pipeline reads
  only the position: give it one vertex attribute, not two.
:::
:::d3d12
- Each pipeline state carries its own fixed functions, so the sky, the outline and the glass need pipeline states of
  their own. The stencil buffer needs a depth format with stencil (`DXGI_FORMAT_D24_UNORM_S8_UINT`), cleared with the
  depth, and the reference value comes from `OMSetStencilRef`.
:::
- The glass texture has transparent and half-transparent pixels: the alpha of each pixel decides how much of what is
  behind shows through.

## Want to do more?

The pavilion is open – but there is always more to build. Add a second and a third pane of glass and sort them from
back to front, the way *Blending* does. Turn the camera slowly around the sculptures. Make the outlined sculpture
change when the visitor presses a key. Smooth the jagged edges of the columns with anti-aliasing. Or give the
brochure a different look altogether: sepia, a soft blur, or the edge detection after all – but only on the left half
of the picture.
