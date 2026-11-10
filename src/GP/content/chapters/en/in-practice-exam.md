# Exam: In Practice

Show what you've learned in *In Practice*: finding mistakes with the error checks, the debug messages and the tools,
rendering text with FreeType, and the 2D game – the game loop, sprites, levels, collisions, particles,
post-processing, power-ups and text. The questions cover the whole part, some of them for {{api}} in particular.
Answer all of them and press **Submit answers**; you need 80 % right to pass, and you can take the exam again.

```quiz
A cube is drawn in one flat colour instead of with its texture. You suspect the texture coordinates. What is the quickest check in the shader?
- [ ] Add a `printf` to the fragment shader and read the console
- [ ] Set a breakpoint in the fragment shader in your C++ debugger
- [x] Write the texture coordinates as the colour – u as red, v as green – and look at the picture: a gradient means they arrive, one flat colour means they don't
- [ ] Draw the cube twice and compare the pictures
---
GPU code has no console and no breakpoints in an ordinary debugger. Writing a value as the colour is the classic trick; colours are clamped to 0..1, so signed values need `* 0.5 + 0.5`.
```

```quiz
What does the GLSL reference compiler `glslangValidator` tell you about a shader?
- [x] Whether it is valid GLSL according to the specification – independent of any driver's quirks
- [ ] Whether the pipeline or program that uses it is configured correctly
- [ ] How fast it runs on your GPU
- [ ] Which values its variables have at a given pixel
---
Code it rejects shouldn't be relied on anywhere, even if one driver accepts it. How the shader is *used* – the attributes fed to it, the bound textures – it can't know.
```

```quiz
What can a frame debugger such as RenderDoc show you about a captured frame? (Several answers are right.)
- [x] Every API call of the frame, with the pipeline state at each draw
- [x] The contents of buffers and textures, including render targets
- [ ] The line of your C++ code where each variable of the shader was declared
- [x] A pixel's history: which draws touched it and what each one wrote
---
The names you give objects (`glObjectLabel`, `vkSetDebugUtilsObjectNameEXT`, `SetName`) appear there too, so the captures are easier to read.
```

```quiz
FreeType's `face->glyph->advance.x` is 1536 for a character of a 24-pixel font. How far does `RenderText` move the pen for it at scale 1?
- [ ] 1536 pixels
- [x] 24 pixels: the advance is in 1/64 pixels, and `advance >> 6` divides by 64
- [ ] 6 pixels: the advance is shifted by 6 bits to the right, which divides by 256
- [ ] 1536 / 24 = 64 pixels
---
The shift by 6 bits divides by 2⁶ = 64. The advance includes the space to the next glyph, so the pen moves further than the glyph's bitmap is wide.
```

```quiz
What is the advantage of FreeType over a classical bitmap font?
- [ ] FreeType's glyphs need no texture at all
- [ ] A bitmap font can't be drawn with blending
- [ ] FreeType glyphs are drawn as triangles, without a shader
- [x] FreeType rasterises the font's outlines at whatever pixel size is asked for, so one font file gives sharp glyphs in any size, and any character the font contains – a bitmap font is pre-rasterised in one size with a fixed set of characters
---
A bitmap font is fast and simple, and the course's Vulkan and Direct3D 12 projects even put FreeType's glyphs back into an atlas – filled at run time, in the size the program asks for.
```

```quiz
The text shader outputs `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r)`. Why does each character show up as its shape, not as a coloured rectangle?
- [ ] Because the glyph texture is transparent outside the glyph in all four channels
- [ ] Because the quad is clipped to the glyph's outline
- [x] Because the one-channel glyph bitmap – its coverage – becomes the alpha, and with alpha blending a pixel with coverage 0 leaves the background unchanged
- [ ] Because the depth test rejects the uncovered pixels
---
Without blending, every quad would be drawn as a rectangle of `textColor` with alpha ignored. The glyph's soft edges have coverage between 0 and 1, which blending turns into smooth outlines.
```

```quiz
The ball's position is updated as `Position += Velocity * dt`. Why is the velocity multiplied by `deltaTime`?
- [x] So that the ball moves the same distance per second whatever the frame rate: a slower frame has a larger dt and moves it further
- [ ] Because the velocity is stored in pixels per frame
- [ ] To keep the ball from leaving the window
- [ ] Because the collision detection needs a small step
---
With the course's fixed time every frame is exactly 1/60 s, so the positions are the same in every API and on every machine. On a real clock, dt varies and the game still runs at the same speed.
```

```quiz
The sprite renderer's model matrix is translate(position) · translate(½ size) · rotate · translate(−½ size) · scale(size). Why the two translations by half the size?
- [ ] To centre the sprite in the window
- [ ] To keep the texture from being stretched
- [ ] Because the quad's vertices go from −1 to 1
- [x] To rotate the sprite about its centre: the quad's origin is its top-left corner, so it is moved to put the centre at the origin, rotated there and moved back
---
Read from right to left: scale the unit quad to the sprite's size, move its centre to the origin, rotate, move it back, then to its position. Without them a sprite would turn about its top-left corner.
```

```quiz
A level file has 15 numbers per row and 8 rows, and the level fills the top half of the 800 × 600 window. What size does each block get?
- [ ] 50 × 37.5 pixels
- [x] 800 / 15 ≈ 53.3 × 300 / 8 = 37.5 pixels
- [ ] 800 / 15 ≈ 53.3 × 600 / 8 = 75 pixels
- [ ] Always 64 × 32 pixels, the size of the block texture
---
`LoadLevel` gets the window's width and half its height and divides them by the number of columns and rows – the block textures are scaled to fit.
```

```quiz
How does the AABB – circle test find out whether the ball touches a block?
- [ ] It tests whether the ball's bounding box overlaps the block on both axes
- [ ] It compares the distance between the two centres with the radius plus half the block's width
- [x] It clamps the vector from the block's centre to the ball's centre to the block's half extents – that gives the point of the block closest to the ball – and checks whether that point is nearer to the ball's centre than its radius
- [ ] It tests the four corners of the block against the circle
---
The box test alone would report hits at a block's corner where the round ball doesn't touch it. The difference vector from the closest point is also what the resolution uses.
```

```quiz
The resolution finds that the ball hit a block from below with a difference vector (2, −9) and a radius of 12.5. What happens to the ball?
- [x] Its vertical velocity is reversed, and it is moved 3.5 pixels (12.5 − 9) down, out of the block
- [ ] Its horizontal velocity is reversed, and it is moved 10.5 pixels to the left
- [ ] Both velocity components are reversed, and it is not moved
- [ ] It is moved back to where it was in the last frame
---
`VectorDirection` picks the compass direction with the largest dot product – here vertical –, the penetration is the radius minus the distance on that axis, and only that component of the velocity flips.
```

```quiz
After the paddle bounce learnopengl computes `Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity)`. Why?
- [ ] To make the ball faster with every bounce
- [ ] To keep the ball from going through the paddle
- [ ] To make the ball go straight up
- [x] Because the new x velocity depends on where the ball hit the paddle; normalizing and scaling by the old length keeps the ball's speed the same while its direction changes
---
Without it, a hit near the paddle's edge would make the ball much faster. The line after it, `Velocity.y = -abs(Velocity.y)`, makes sure the ball always leaves upwards.
```

```quiz
Why does the particle generator reuse dead particles with `firstUnusedParticle` instead of creating a new particle for each spawn?
- [ ] Because a particle that has died can't be drawn again
- [x] Because the 500 particles are created once: reusing a dead one avoids allocating and freeing memory every frame, and searching from the last one used usually finds a dead one at once
- [ ] Because `rand()` would give the same numbers to new particles
- [ ] Because the GPU only accepts a fixed number of draws
---
If no particle is dead, the first one is overwritten – the oldest trail fades a little early, which nobody sees.
```

```quiz
In the postprocessing chapter the game is drawn into a multisampled target. Why is that target resolved into a texture before the post shader samples it?
- [ ] Because a multisampled target can only be drawn into once per frame
- [ ] Because the resolve applies the effects
- [x] Because the post shader samples an ordinary texture with one colour per pixel; the resolve averages each pixel's samples into it – the anti-aliased picture of the game
- [ ] Because a multisampled target has no colour channels
---
The effects then work on that picture: the shake blurs it, confuse mirrors and inverts it, chaos detects its edges.
```

```quiz
Two pass-through power-ups are caught one after the other. When the first one runs out, why does the ball keep passing through blocks?
- [x] Because `UpdatePowerUps` only switches the effect off if `IsOtherPowerUpActive` finds no other active power-up of the same type – the second one is still active
- [ ] Because a duration of 10 s is added to the ball, not to the power-up
- [ ] Because pass-through can never be switched off
- [ ] Because the second power-up resets the first one's duration
---
The effect lasts until the last power-up of its type has run out. Erased are only the power-ups that are destroyed and no longer active.
```

```quiz
Why is the lives text drawn after the postprocessing quad and not between `BeginRender` and `EndRender`?
- [ ] Because text can't be drawn into a multisampled target
- [ ] Because the post shader would make the text too small
- [ ] Because the lives are only known after the frame
- [x] So that the effects don't touch it: drawn into the window after the quad, the text stays readable while the screen shakes, is confused or shows chaos
---
learnopengl's comment says it: "don't include in postprocessing". Everything drawn before `EndRender` is part of the picture the effects change.
```

```quiz
learnopengl's game plays music and sound effects. What does {{api}} contribute to that?
- [ ] It decodes the MP3 file
- [x] Nothing: a graphics API talks only to the GPU – a separate audio library (irrKlang in learnopengl, or OpenAL Soft, miniaudio, SDL_mixer, XAudio2) plays the sounds, called from the game's logic
- [ ] It plays the sounds through the GPU's audio output
- [ ] It mixes the sounds in a compute shader
---
The calls go into `Init` (the looping music) and `DoCollisions` (the effects) – never into the rendering code.
```

:::opengl
```quiz
Two OpenGL calls in a row are used wrongly, and then `glGetError()` is called once. What does it return?
- [ ] Both errors, as a bit mask
- [ ] The second error, because it overwrites the first
- [x] The first error: once an error flag is set, no other error is recorded until the flag is read – and reading it clears it
- [ ] `GL_NO_ERROR`, because errors are only kept for one call
---
That is why learnopengl's `glCheckError()` is called after small groups of calls, with `__FILE__` and `__LINE__`. On distributed systems several flags can be set, so it reads them in a loop.
```
:::
:::vulkan
```quiz
A Vulkan program creates a pipeline whose vertex shader reads an input the pipeline doesn't describe. `vkCreateGraphicsPipelines` returns `VK_SUCCESS`. Why?
- [ ] Because Vulkan fills missing inputs with zero by specification
- [ ] Because the error is only reported when the pipeline is destroyed
- [ ] Because `VK_SUCCESS` means "succeeded with warnings"
- [x] Because the driver doesn't check valid usage – breaking it is undefined behaviour; only the validation layer, if enabled, reports it, through the debug messenger
---
Checking every call would cost time in every frame of every finished program. In a release build (`NDEBUG`) the course's code leaves the layer out.
```
:::
:::d3d12
```quiz
What is the difference between reading the info queue with `CheckDebugMessages()` and a callback registered with `RegisterMessageCallback`?
- [ ] The info queue only holds errors, the callback also warnings
- [x] The info queue gives the stored messages after the fact, at the next check (learnopengl's `glGetError` way); the callback is called with each message at the moment the guilty call is made (learnopengl's debug output)
- [ ] The callback works in release builds, the info queue only in debug builds
- [ ] There is none: both are called by the GPU after each frame
---
With `SetBreakOnSeverity` the debug layer can even break into the debugger at the guilty call – when one is attached (`IsDebuggerPresent()`).
```
:::

:::opengl
```quiz
Why does learnopengl enable `GL_DEBUG_OUTPUT_SYNCHRONOUS` together with the debug output?
- [ ] To make the debug output faster
- [x] So that the driver calls the callback inside the call that caused the message: a breakpoint in the callback then shows the guilty call on the call stack
- [ ] Because the debug output only works with synchronous rendering
- [ ] To report every message twice
---
Without it the driver may call the callback later, from another thread, when the call stack no longer shows where the error came from.
```
:::
:::vulkan
```quiz
A validation message contains `VUID-VkGraphicsPipelineCreateInfo-Input-07904`. What is that?
- [ ] The handle of the pipeline object
- [ ] An error code that `vkCreateGraphicsPipelines` returned
- [ ] The line of the shader where the error is
- [x] The valid usage ID: the name of the rule of the specification that was broken – the message ends with the rule's text
---
With `vkSetDebugUtilsObjectNameEXT` the objects in the message get names too, so it says which shader module it means.
```
:::
:::d3d12
```quiz
`SetBreakOnSeverity(D3D12_MESSAGE_SEVERITY_ERROR, TRUE)` is only called when `IsDebuggerPresent()` returns true. Why?
- [ ] Because it only works on a GPU with a debugger built in
- [ ] Because it would slow the program down otherwise
- [x] Because the break raises an exception that a debugger catches at the guilty call; without a debugger nobody handles it and the program ends
- [ ] Because the info queue doesn't exist without a debugger
---
With a debugger, the break is like a breakpoint at the call that broke a rule – the call stack shows your line.
```
:::

:::opengl
```quiz
learnopengl's `Load` calls `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` before it uploads the glyphs. Why?
- [ ] To make the textures use 1 byte per channel
- [ ] To upload only one glyph at a time
- [x] Because OpenGL by default expects every row of the image data to start at a multiple of 4 bytes, and a one-byte-per-pixel glyph's rows are as many bytes as it is wide – a 13-pixel glyph would be read with 16-byte rows and sheared
- [ ] Because `GL_RED` textures must be aligned to 1 pixel
---
Most images have 4 bytes per pixel, so their rows are always multiples of 4 – the default never shows there.
```
:::
:::vulkan
```quiz
Why does the Vulkan project put all glyphs into one atlas image instead of learnopengl's one texture per glyph?
- [ ] Because Vulkan images must be square
- [x] Because an image can't be 0 × 0 – the space's bitmap is – and 128 images with memory, views and descriptor sets, with a different set bound for every character, would be a lot of objects for some text
- [ ] Because `VK_FORMAT_R8_UNORM` is only allowed for large images
- [ ] Because the shader can sample only one image
---
The atlas is the classic bitmap font's idea, filled by FreeType at run time: each quad samples its glyph's rectangle, and one descriptor set serves all text.
```
:::
:::d3d12
```quiz
Why does the Direct3D 12 project put all glyphs into one atlas texture instead of learnopengl's one texture per glyph?
- [ ] Because Direct3D 12 textures must be square
- [ ] Because `DXGI_FORMAT_R8_UNORM` is only allowed for large textures
- [ ] Because the pixel shader can sample only one texture
- [x] Because a texture can't be 0 × 0 – the space's bitmap is – and 128 resources with upload buffers, barriers and descriptors, with a table set for every character, would be a lot of objects for some text
---
The atlas is the classic bitmap font's idea, filled by FreeType at run time: each quad samples its glyph's rectangle, one descriptor table serves all text, and a whole line is one draw.
```
:::

:::opengl
```quiz
How does the OpenGL sprite renderer give each sprite its own position, size, rotation and colour?
- [x] With the uniforms `model` and `spriteColor`, set before each sprite's draw; the projection uniform is set once, it never changes
- [ ] With one vertex buffer per sprite
- [ ] With push constants
- [ ] By rebuilding the quad's vertices on the CPU for every sprite
---
All sprites share one quad of six vertices; only the uniforms change. That is simple – and the reason learnopengl suggests instancing for many sprites.
```
:::
:::vulkan
```quiz
How does the Vulkan sprite renderer give each sprite its own position, size, rotation and colour?
- [ ] With one uniform buffer per sprite, updated before each draw
- [x] With push constants (`model` and `spriteColor`, 76 bytes, for the vertex and fragment stage) recorded before each sprite's draw; the projection is in the uniform buffer
- [ ] With one vertex buffer per sprite
- [ ] With a new pipeline per sprite
---
A uniform buffer is read when the command buffer runs, so rewriting it between draws would give every sprite the last values; push constants are recorded with each draw.
```
:::
:::d3d12
```quiz
How does the Direct3D 12 sprite renderer give each sprite its own position, size, rotation and colour?
- [ ] With one constant buffer per sprite, rewritten before each draw
- [ ] With one vertex buffer per sprite
- [x] With root constants (`model` and `spriteColor`, 19 values in root parameter 0) set before each sprite's draw with `SetGraphicsRoot32BitConstants`; the projection is in the constant buffer
- [ ] With a new pipeline state per sprite
---
A constant buffer in an upload heap is read when the command list executes, so rewriting it between draws would give every sprite the last values; root constants are recorded with each draw.
```
:::

:::opengl
```quiz
`DrawParticles` sets `glBlendFunc(GL_SRC_ALPHA, GL_ONE)` and at its end `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`. Why the second call?
- [ ] Because the particle shader needs it for its next particle
- [ ] Because `GL_ONE` only lasts one draw anyway
- [ ] To clear the particles from the screen
- [x] Because the blend function is global state: without the reset, the ball drawn next – and the next frame's sprites – would be added to the picture instead of covering it
---
In Vulkan and Direct3D 12 the blend state is part of the pipeline object, so the particles simply use a second pipeline and nothing has to be reset.
```
:::
:::vulkan
```quiz
How does the Vulkan project draw the particles additively and the sprites with alpha blending?
- [ ] With `vkCmdSetBlendConstants` before the particles
- [x] With two pipelines that differ in the destination colour blend factor – `VK_BLEND_FACTOR_ONE` for the particles, `ONE_MINUS_SRC_ALPHA` for the sprites; binding a pipeline sets all its state, so nothing has to be reset afterwards
- [ ] With a blend mode pushed as a push constant
- [ ] By drawing the particles in a separate render pass
---
learnopengl changes the global blend function and has to set it back after the particles. A Vulkan pipeline carries its blend state.
```
:::
:::d3d12
```quiz
How does the Direct3D 12 project draw the particles additively and the sprites with alpha blending?
- [ ] With `OMSetBlendFactor` before the particles
- [ ] With a blend mode set as a root constant
- [x] With two pipeline states that differ in the destination blend – `D3D12_BLEND_ONE` for the particles, `D3D12_BLEND_INV_SRC_ALPHA` for the sprites; setting a pipeline state sets all its state, so nothing has to be reset afterwards
- [ ] By drawing the particles into a separate render target
---
learnopengl changes the global blend function and has to set it back after the particles. A Direct3D 12 pipeline state carries its blend state.
```
:::

:::opengl
```quiz
How does `EndRender` turn the multisampled framebuffer into the texture the post shader samples?
- [ ] With `glCopyTexImage2D` from the renderbuffer
- [ ] The post shader reads the renderbuffer's samples itself
- [x] `glBlitFramebuffer` from `MSFBO` (read) to `FBO` (draw) with `GL_COLOR_BUFFER_BIT` – a blit from a multisampled to a single-sample framebuffer resolves; then `glBindFramebuffer(GL_FRAMEBUFFER, 0)` draws into the window again
- [ ] `glGenerateMipmap` on the renderbuffer
---
For a resolve the two rectangles must be the same size, so `GL_NEAREST` is enough. A renderbuffer can't be sampled at all – hence the second framebuffer with a texture.
```
:::
:::vulkan
```quiz
How does the Vulkan project turn the 4-sample image into the texture the post shader samples?
- [x] The texture is the off-screen subpass's resolve attachment: when the render pass ends, each pixel's samples are averaged into it, and it ends in `SHADER_READ_ONLY_OPTIMAL`
- [ ] With `vkCmdBlitImage` from the 4-sample image to the texture
- [ ] The post shader reads the 4 samples with `texelFetch` and averages them
- [ ] The swap chain image is multisampled and resolves itself when presented
---
`vkCmdBlitImage` can't take a multisampled source. And the sprite and particle pipelines must be made for that render pass with `VK_SAMPLE_COUNT_4_BIT` – a pipeline belongs to a render pass and a sample count.
```
:::
:::d3d12
```quiz
How does the Direct3D 12 project turn the 4-sample render target into the texture the post shader samples?
- [ ] The swap chain's back buffer is multisampled and resolves itself when presented
- [ ] With `CopyResource` from the multisampled target to the texture
- [ ] The post shader reads the 4 samples and averages them
- [x] With `ResolveSubresource(texture, 0, msTarget, 0, format)`, after barriers to `RESOLVE_SOURCE` and `RESOLVE_DEST` and with barriers back to `RENDER_TARGET` and `PIXEL_SHADER_RESOURCE` after it
---
A flip-model swap chain can't be multisampled at all. And the sprite and particle PSOs must have `SampleDesc.Count` 4 to draw into the multisampled target.
```
:::
