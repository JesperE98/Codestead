# Project: Opening night

The Codestead Theatre's new production opens tonight, and the reviews are already written in everyone's head: a
daring ensemble piece with a cast of ten wooden crates. The crates have learnt their lines. The costumes fit. There is
just one small detail left – the lighting designer has run off with a touring circus, and the show goes on in two
hours.

"You know about lights, don't you?" says the stage manager, pressing a clipboard into your hands. "Work light off,
some colour on the stage, a follow spot on our star. Make it look like art."

The stage is the scene you built in *Multiple lights*: the ten containers, a directional light, four point lights
with their lamps, and the flashlight. Nothing here is new – colours, Phong, materials, lighting maps and light casters
are all you need. The challenge is to turn them into a show on your own.

:::opengl
Start from a copy of your finished program from *Multiple lights* – the same files: `main.cpp`, `shader_m.h`,
`multiple_lights.vs`, `multiple_lights.fs`, `light_cube.vs`, `light_cube.fs` and the two maps. The render loop sets
every light's uniforms by hand and then draws the containers and the lamps.
:::
:::vulkan
Start from a copy of your finished program from *Multiple lights* – the same files: `main.cpp`, the four shaders in
`shaders/` and the two maps. `updateUniformBuffer()` fills in every light in the uniform buffer, and
`recordCommandBuffer()` draws the containers and then, with the lamp's pipeline, the lamps.
:::
:::d3d12
Start from a copy of your finished program from *Multiple lights* – the same files: `main.cpp`,
`multiple_lights.hlsl`, `light_cube.hlsl` and the two maps. `OnUpdate` fills in every light in the constant buffer,
and `PopulateCommandList` draws the containers and then, with the lamp's pipeline state, the lamps.
:::

## The assignment

1. **House lights down.** The theatre goes dark: a clear colour that is practically black, and the directional light –
   the hall's work light – switched off (or so dim that it hardly counts).
2. **Gels.** Put coloured gels on the point lights: at least two of them in clearly different colours – say blue,
   green, pink and red. The ambient, diffuse and specular parts of a light all take its colour.
3. **Lamps in colour.** A blue light shining out of a white lamp looks like a mistake. Make every lamp show the colour
   of its own light.
4. **The follow spot.** The flashlight is no longer the audience's: hang the spotlight above the stage – a couple of
   units above the camera, in front of the cast – and aim it down at the star of the show, container 0. A warm white
   suits it.
5. **The sweep.** A follow spot that stands still is just a lamp. Let the spot sweep over the star from side to side
   as the time passes.
6. **Polish.** The crates have been polished for the premiere: give the material a much higher shininess, so the
   highlights become small and sharp.

The milestones in the list next to this text are checked automatically when you click **Check my code**. The checks
read the values your program hands its shaders and look at the picture: other colours, positions and speeds are fine.

## Tips along the way

- Switching a light off needs no new code: a light whose colours are all zero adds nothing.
- One colour per point light is easiest to keep in an array next to `pointLightPositions`. The ambient part is usually
  a small fraction of it.
:::opengl
- The lamps' fragment shader, `light_cube.fs`, outputs pure white. Give it a colour uniform and set it in the loop
  that draws the lamps – `lightCubeShader` is a shader of its own.
:::
:::vulkan
- The lamps' fragment shader, `shaders/light_cube.frag`, outputs pure white. A colour per lamp fits in the push
  constants after the model matrix; the fragment stage then needs to be in the push constant range and in every
  `vkCmdPushConstants`.
:::
:::d3d12
- The lamps' pixel shader in `light_cube.hlsl` returns pure white. A colour per lamp fits in the root constants after
  the two matrices; declare the whole `ModelConstants` layout in the lamp's shader so the colour is where `main.cpp`
  puts it, and let every shader stage see the root parameter.
:::
- A spotlight's direction is "where it should shine minus where it is", made one unit long. Keep the target point in a
  variable: the sweep only has to move it.
- The sweep needs the time and a function that swings back and forth – you have used `sin` of the time before.
- Shininess is the exponent of the specular term: the bigger it is, the smaller the highlight.

## Want to do more?

The show is yours once the milestones are done. Give the follow spot a narrower, harder edge for a dramatic entrance,
or let its colour change during the performance. Make the gels pulse to the rhythm of an imaginary orchestra, move a
point light in a circle around the star, or dim the whole stage slowly at the end – a fade to black is the oldest trick
in the theatre.
