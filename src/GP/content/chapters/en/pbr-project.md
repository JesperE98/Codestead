# Project: The material showroom

A small design studio has made a name for itself with handmade spheres – lamps, door knobs, garden ornaments, nobody
quite knows. What everyone agrees on is that they look wonderful in real life and dreadful in the online shop, where
the photos make gold look like mustard. The studio's founder has heard that you know your way around physically based
rendering, and asks you for a 3D showroom: three material samples on a shelf, and above them the studio's pride, the
riveted steel sphere, slowly turning on a turntable.

Everything you need comes from *PBR*: the metallic-roughness workflow, the Cook-Torrance BRDF, and image-based lighting
with an irradiance map, a pre-filtered environment map and the BRDF look-up table. Nothing here is new; the challenge
is putting the pieces together yourself.

![The finished showroom](images/results/pbr-project.webp "One way the finished showroom can look (drawn by the course's own simulator).")

## The scene you start with

Your project is the program from *Specular IBL*: the environment map behind everything, four white lights of 300 at
(±10, ±10, 10), and a grid of 3 × 3 large spheres (scaled 2.4, 6 apart) that all get their material from the five
maps of the riveted steel – albedo, normal, metallic, roughness and ambient occlusion. The camera is at (0, 0, 22)
looking down -z.

:::opengl
The spheres are drawn in the render loop of `main.cpp`, the material and the lighting are in `pbr.fs`.
:::
:::vulkan
The spheres are drawn in `recordCommandBuffer()`, each with its model matrix in the push constants (`struct
PushConstants`, read by `shaders/pbr.vert`); the material and the lighting are in `shaders/pbr.frag`.
:::
:::d3d12
The spheres are drawn in `RenderScene()`, each with its matrices in the root constants (`struct ModelConstants`,
`cbuffer ModelConstants` in `pbr.hlsl`, root parameter 0); the material and the lighting are in `pbr.hlsl`.
:::

## The assignment

1. **Make room.** Replace the grid with the showroom: the hero – still with the steel's maps – large in the middle at
   (0, 2, 0), scaled 3.6, and below it a shelf of three samples, scaled 2.4, at (-6, -6, 0), (0, -6, 0) and (6, -6, 0).
2. **Gold.** The left sample is real gold. Let a sample get its material from values of its own – an albedo, a
   metallic and a roughness – instead of the maps, while the hero keeps its maps. Gold is a metal; its albedo is the
   colour of its reflections, about (1.0, 0.71, 0.29), and it is fairly smooth.
3. **Rough plastic.** The middle sample is plastic in a strong colour of your choice: not a metal, and rough, so that
   its highlight is soft and wide and it reflects nothing sharply.
4. **Polished metal.** The right sample is polished silver: a metal with a light grey albedo and almost no roughness,
   so that it mirrors the room around it.
5. **The turntable.** The hero turns slowly about its vertical axis, so that the customers see it from every side.

The milestones in the list next to this text are checked automatically when you press **Check my code**.

## Tips along the way

- A sample's material values belong to one draw, like its model matrix.
:::opengl
  Uniforms set before each `renderSphere()` do the job – a `bool` uniform can choose between the values and the maps.
:::
:::vulkan
  The push constants can hold more than the model matrix: give `PushConstants` the material after the matrix, and
  declare the same block in `pbr.frag` (the vertex shader may keep reading only the matrix). Push constants are laid
  out like std430: a `vec3` right after the `mat4`, and a GLSL `bool` is 4 bytes (`VkBool32`).
:::
:::d3d12
  The root constants can hold more than the two matrices: give `ModelConstants` the material after them, in both
  `main.cpp` and `pbr.hlsl`, with the same names (HLSL packs a `float3` and a `float` into one 16-byte row). Root
  parameter 0 must then hold as many values as the larger struct has.
:::
- Without the maps there is no normal map either: a sample uses the sphere's own normal, and its ambient occlusion is
  simply 1.0.
- Remember the rule of the metallic workflow: a metal has no diffuse colour, and its albedo becomes F0; a non-metal
  has F0 = 0.04 and shows its albedo as diffuse colour.
- The environment is in the reflections. Compare your polished metal with a rougher one – the pre-filtered map's
  mip levels do the blurring.
- The turntable needs the time since the program started and one more rotation in the hero's model matrix.

## Want to do more?

Once the showroom is open, there is plenty to try on your own:

- **More samples.** Copper (0.95, 0.64, 0.54), brushed aluminium, rubber, ceramic – a whole shelf.
- **A roughness ramp.** A row of the same material from mirror-smooth to completely rough.
- **Showroom lighting.** Coloured spotlights or a warm key light from the side instead of the four white lights.
- **Exposure.** Use the exposure tone mapping from *HDR* instead of Reinhard, and find the exposure that makes the
  gold shine.
- **A plinth.** Put the hero on a pedestal – a cube with a material of its own.
