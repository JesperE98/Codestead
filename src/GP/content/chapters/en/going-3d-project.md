# Project: A tiny solar system

The Codestead planetarium has a problem. The school classes arrive tomorrow morning, the star projector has just
given up with a sad little pop, and the only 3D model in the storeroom is… a wooden crate. A whole box of them,
actually.

"Can't you make a solar system out of those?" the director asks, looking at you over her glasses. "A sun, a planet,
a moon. Moving. The children will never know."

They will know. But with what you learnt in *Getting started* and *Going 3D* it can still be a rather fine solar system. Nothing
here is new: the challenge is combining the window, the shaders, the textures, the transformations and the camera
on your own.

:::opengl
Start from a copy of your finished program from *Camera* – the same files: `main.cpp`,
`shader_m.h`, `shader.vs`, `shader.fs` and the two pictures. Ten crates, a free camera at (0, 0, 3), and a render
loop that draws every crate with its own `model` matrix.
:::
:::vulkan
Start from a copy of your finished program from *Camera* – the same files: `main.cpp`,
`shaders/shader.vert`, `shaders/shader.frag` and the two textures. Ten crates, a free camera at (0, 0, 3),
`updateUniformBuffer()` for the view and projection, and `recordCommandBuffer()`, which pushes each crate's `model`
matrix as a push constant before its draw.
:::
:::d3d12
Start from a copy of your finished program from *Camera* – the same files: `main.cpp`,
`shaders.hlsl` and the two textures. Ten crates, a free camera at (0, 0, 3), `OnUpdate` for the view and projection,
and `PopulateCommandList`, which sets each crate's `model` matrix as root constants before its draw.
:::

## The assignment

1. **Night falls.** Clear the window to a night sky: almost black, perhaps with a hint of blue.
2. **A seat in the gallery.** Move the camera up and back so that it looks *down* at the middle of the world from
   an angle – somewhere around 6 units up and 8 back works well. It should still be a camera you can fly with the
   keys and the mouse.
3. **Let there be a sun.** The ten crates go home. Instead, one crate in the middle of the world, clearly bigger than
   the others were (twice the size is good), slowly turning around its own vertical axis.
4. **A planet.** A second, smaller crate that circles the sun – always at the same distance, a few units out.
5. **A moon.** A third, even smaller crate that circles the *planet* while the planet circles the sun. This is the
   heart of the project: the moon's matrix has to start from the planet's.
6. **Colour.** Give every body its own colour – a yellow sun, a blue planet, a grey moon, or whatever your solar
   system prefers – mixed with the crate's texture so the wood still shows.

The milestones in the list next to this text are checked automatically when you click **Check my code**. The checks
look at where your matrices put the bodies, not at your numbers: other sizes, distances and speeds are fine as long as
the sun stays in the middle, the planet keeps its distance to the sun and the moon its distance to the planet.

## Tips along the way

- The night sky is the clear colour: one line, and you know where it is.
- The camera starts from `cameraPos` and `cameraFront`. A position of (0, 6, 8) and a direction pointing back at the
  origin, (0, -6, -8) made one unit long, does the job. The mouse code turns `yaw` and `pitch` into a direction the
  first time you move the mouse: start `pitch` at the angle you are already looking down at (its sine is the
  direction's y) and the view will not jump.
:::opengl vulkan
- Matrices are applied from right to left – or, in the code, from the bottom up: the line nearest the draw call
  happens to the crate first. "Move it out, then turn it around the sun" is `rotate` *before* `translate` in the code.
:::
:::d3d12
- DirectXMath multiplies from left to right: `XMMatrixScaling(…) * XMMatrixTranslation(…) * XMMatrixRotationY(…)`
  scales the crate first, then moves it out, then turns it around the sun. Don't forget `XMMatrixTranspose` when you
  store the matrix.
:::
- Keep the planet's matrix *before* you scale it, in a variable of its own. The moon can then start from it: its
  orbit is "the planet's place, then turned again and moved out a little".
- The time you need for the turning is the same time the old crates used.
:::opengl
- A colour per body is a uniform in `shader.fs`, set with `ourShader.setVec3` before each draw. `mix` blends the
  texture with it – the same function that already blends the crate with the face.
:::
:::vulkan
- A colour per body fits in the push constants, after the matrix. The fragment shader has to see them too: declare the
  same block there and add `VK_SHADER_STAGE_FRAGMENT_BIT` to the push constant range *and* to every
  `vkCmdPushConstants`. `mix` blends the texture with the colour.
:::
:::d3d12
- A colour per body fits in the root constants, after the matrix: add it to the `ModelConstants` struct in both files,
  and let all shader stages see the root parameter (`D3D12_SHADER_VISIBILITY_ALL`). `lerp` blends the texture with the
  colour.
:::

## Want to do more?

When the milestones are done, the solar system is yours. Let the planet turn around its own axis while it travels
(where in the chain of matrices does that go, so the moon does not start spinning along?). Add a second planet with a
different speed, a ring of tiny crates around it, or a comet on a long, flattened orbit. Make the sun pulse in size
with `sin` of the time. Or tilt the moon's orbit a little, like the real one – the children will be thrilled.
