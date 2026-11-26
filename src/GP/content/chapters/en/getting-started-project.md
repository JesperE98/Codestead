# Project: The planetarium sign

The Codestead planetarium opens tomorrow. The seats are bolted down, the star projector hums, the coffee machine
works (mostly). Only one thing is missing: the screen above the entrance, where the sign should be, is showing a
small, square crate on a teal background.

"That's what people will see first," the director says, looking up at it. "A crate. With a smiley face on it." She
sighs. "Well, the face can stay – it's grown on me. But make it look like a *planetarium*. Something that glows in the
dark. You have until the doors open."

Everything you need is in *Getting started*: the clear colour, the vertex data, the shaders with their ins, outs and
uniforms, and the textures with their coordinates and wrap modes. No matrices needed – the sign stays flat on the
screen, just as your rectangle has been all along.

:::opengl
Start from a copy of your finished program from *Textures* – the same files: `main.cpp`, `shader_s.h`, `shader.vs`,
`shader.fs` and the two pictures. A rectangle with texture coordinates from 0 to 2, the crate (with
`GL_CLAMP_TO_EDGE`) mixed with the face (with `GL_REPEAT`) by the uniform `mixValue`, and a colour per corner that the
vertex shader passes on as `ourColor` – which nobody uses yet.
:::
:::vulkan
Start from a copy of your finished program from *Textures* – the same files: `main.cpp`, `shaders/shader.vert`,
`shaders/shader.frag` and the two textures. A rectangle with texture coordinates from 0 to 2, the crate (read through
`clampSampler`) mixed with the face (read through `textureSampler`) by the push constant `mixValue`, and a colour per
corner that the vertex shader passes on as `fragColor` – which nobody uses yet.
:::
:::d3d12
Start from a copy of your finished program from *Textures* – the same files: `main.cpp`, `shaders.hlsl` and the two
textures. A rectangle with texture coordinates from 0 to 2, the crate (sampled with `clampSampler`) mixed with the
face (sampled with `wrapSampler`) by the root constant `mixValue`, and a colour per corner that the vertex shader
passes on as `input.color` – which nobody uses yet.
:::

## The assignment

1. **Lights down.** Clear the window to a deep night blue: dark, but clearly blue.
2. **A wide sign.** Change the rectangle's corners so it becomes a sign above a door: clearly wider than it is tall –
   for example from -0.9 to 0.9 across and from -0.6 to 0.6 up and down.
3. **Wood all the way.** The crate is only on one part of the sign; the rest is its edge, stretched. Make the wood
   repeat across the whole sign instead – four crates across and two up (texture coordinates up to 4 and 2) make
   neat squares.
4. **Colour.** Use the corners' colours: tint the sign with them so it runs from yellow to red along the top and from
   blue to green along the bottom.
5. **The glow.** Let the whole sign glow slowly brighter and darker, over and over, with the time from the CPU.
6. **The light runs.** Make the glow travel across the sign from left to right, so the bright part moves along it
   instead of the whole sign pulsing at once.

The milestones in the list next to this text are checked automatically when you click **Check my code**. The checks
look at the picture: how wide the sign is, that it repeats, its colours in the corners and how its brightness changes
over time – so your own sizes, coordinates, speeds and brightnesses are fine. Only for the wood do they also look at
the code, to see that the crate no longer clamps.

## Tips along the way

- The night blue is the clear colour: one line, and you know where it is. Something like (0.03, 0.04, 0.15).
- The sign is the four vertices' positions. They are in normalized device coordinates, so x and y both go from -1 to 1
  across the window – and since the window is 800 × 600, a sign from -0.9 to 0.9 and -0.6 to 0.6 is 720 × 360 pixels.
:::opengl
- Two things make the wood repeat: texture coordinates above 1 *and* a wrap mode that repeats. The crate's
  `GL_TEXTURE_WRAP_S` and `GL_TEXTURE_WRAP_T` are still `GL_CLAMP_TO_EDGE` from the textures exercise.
- `ourColor` already arrives in `shader.fs`. Colours multiply channel by channel, so `* vec4(ourColor, 1.0)` tints.
- The time is a new uniform: `glfwGetTime()` in the render loop, `ourShader.setFloat` like `mixValue`, and
  `uniform float time;` in `shader.fs`. Something like `0.7 + 0.3 * sin(time * 2.0)` goes between 0.4 and 1.0;
  multiply the colour's `rgb` by it.
:::
:::vulkan
- Two things make the wood repeat: texture coordinates above 1 *and* a sampler that repeats. The crate's descriptor
  (`imageInfo.sampler`) still points to `clampSampler` from the textures exercise; `textureSampler` already repeats.
- `fragColor` already arrives in `shader.frag`. Colours multiply channel by channel, so `* vec4(fragColor, 1.0)`
  tints. Remember to compile the shaders again with `glslc` after every change.
- The time fits in the push constants, after `mixValue`: a `float time` in the C++ struct and in the shader's block,
  filled in `recordCommandBuffer()` with the same `std::chrono` lines as in *Shaders*. Something like
  `0.7 + 0.3 * sin(pc.time * 2.0)` goes between 0.4 and 1.0; multiply the colour's `rgb` by it.
:::
:::d3d12
- Two things make the wood repeat: texture coordinates above 1 *and* a sampler that repeats. The pixel shader still
  samples the crate with `clampSampler` from the textures exercise; `wrapSampler` already repeats.
- `input.color` already arrives in the pixel shader. Colours multiply channel by channel, so `* input.color` tints.
- The time fits in the root constants, after `mixValue`: a `float time` in the `MixConstants` struct in both files,
  filled in `PopulateCommandList` with the same `std::chrono` lines as in *Shaders*. Something like
  `0.7f + 0.3f * sin(time * 2.0f)` goes between 0.4 and 1.0; multiply the colour's `rgb` by it.
:::
- For the running light, each fragment needs to glow a little later than its neighbour on the left. The fragment
  shader already has a value that grows from left to right: the x of the texture coordinates. Subtract it inside the
  `sin`.

## Want to do more?

When the milestones are done, the sign is yours. Make the face shy with the Up and Down keys so only a hint of a smile
is left, or let `mixValue` breathe with the time too. Give the corners other colours – a sunset, perhaps, or a
nebula. Let the light run the other way, or faster, or in waves from the middle out.
Or try `GL_MIRRORED_REPEAT` (or its Vulkan and Direct3D cousins) and see the crates meet each other halfway.
