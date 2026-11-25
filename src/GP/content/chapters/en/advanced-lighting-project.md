# Project: Lantern night on the boardwalk

Every autumn the little harbour town holds *Lantern Night*: the shops close early, the boardwalk is lined with
lanterns and the whole town strolls along the water. This year the tourist office wants a moving picture of it for
its website – and the job has landed on your desk, because "you're the one who does the lighting stuff".

The harbour master has already sent you a scene: the wooden boardwalk with a few cargo crates on it. Unfortunately
it is still lit by the lighting lab's four test lights – white, red, blue and green – and looks more like a disco
than a quiet autumn night. Your task is to turn it into Lantern Night with what you learnt in *Advanced Lighting*:
lights far brighter than 1.0, a floating point target with tone mapping, bloom, gamma correction and Blinn-Phong.
Nothing here is new; the challenge is putting the pieces together yourself.

![The finished boardwalk](images/results/advanced-lighting-project.webp "One way the finished boardwalk can look (drawn by the course's own simulator).")

## The scene you start with

Your project is the program from *Bloom* with the crates moved onto the boards: the floor (the 2 × 2 × 2 cube
scaled to a thin 25 × 1 × 25 slab, its top at y = -0.5) and six crates standing on it, the camera at (0, 0, 5)
looking down -z. The four lights are drawn as small bright cubes in their own colours; the scene goes into a floating
point target together with its bright parts, the bright parts are blurred, and the final pass adds the blur, tone-maps
with the exposure curve and gamma-corrects.

:::opengl
The lights are the vectors `lightPositions` and `lightColors` in `main.cpp`; the scene's lighting is in `bloom.fs`,
the final pass in `bloom_final.fs`, and the exposure is the global `exposure`.
:::
:::vulkan
The lights are the vectors `lightPositions` and `lightColors` at the top of `main.cpp`; they reach the shaders through
the uniform buffer (`updateUniformBuffer()`) and – for the light cubes – the push constants. The scene's lighting is
in `shaders/bloom.frag`, the final pass in `shaders/bloom_final.frag`, and the exposure is the global `exposure`.
:::
:::d3d12
The lights are the arrays `lightPositions` and `lightColors` at the top of `main.cpp`; `OnUpdate()` copies them into
the constant buffer, and `RenderScene()` draws the light cubes in their colours. The scene's lighting is in
`bloom.hlsl`, the final pass in `bloom_final.hlsl`, and the exposure is the global `exposure`.
:::

## The assignment

1. **Lanterns instead of test lights.** Replace the four coloured lights with four lanterns with a warm, yellow-orange
   light (more red than green, more green than blue) – each much brighter than 1.0, so that they glow. Hang them in two
   rows along the boardwalk, 1.5 above the boards: at (-2.5, 1, -1), (2.5, 1, -1), (-2.5, 1, -5) and (2.5, 1, -5).
2. **Moonlight.** Where no lantern reaches, the night is pitch black. Give the scene a faint, cold light from the moon,
   so that the sides of the crates turned away from the lanterns show dark blue instead of black.
3. **Wet boards.** It has just rained: let the boards and crates reflect the lanterns with a specular highlight –
   Blinn-Phong, with the halfway vector.
4. **Mist over the water.** Make the lanterns' glow stronger, as if the light were caught in mist.
5. **Night exposure.** With so much light, the boardwalk looks more like an evening match at the stadium. Turn the
   exposure down until it is night again – the boards between the lanterns dark, the lanterns still burning bright.
6. **A flickering lantern.** One of the lanterns – the one at the back on the left – has a loose wire: let its light
   dip and come back over time.

The milestones in the list next to this text are checked automatically when you press **Check my code**.

## Tips along the way

- A lantern is only a light position and a colour: the cubes that show the lights follow them by themselves.
- The lighting shader already has an ambient term – it is just zero. A colour with more blue than red, times the
  texture's colour, is enough for moonlight; keep it faint, a few hundredths.
- Blinn-Phong needs the direction to the camera; the scene's constants already have the camera's position. Remember
  that the specular term gets the same attenuation as the diffuse term.
- The glow is the blurred bright image added to the scene in the final pass. There are two ways to make it stronger:
  add it with a factor, or blur more often.
- Try a few exposures between 0.1 and 0.8 and look at the result: tone mapping is a matter of taste.
- For the flicker you need the time since the program started.
:::opengl
  `glfwGetTime()` gives it; change the lantern's colour in the render loop, before the light uniforms are set.
:::
:::vulkan
  `glfwGetTime()` gives it; `updateUniformBuffer()` runs every frame, before the frame's commands are recorded. A
  `const` vector cannot change, though.
:::
:::d3d12
  `OnUpdate()` already measures time with `std::chrono` for the camera; a `static` start time gives the time since the
  first frame. Change the lantern's colour before it is copied into the constant buffer.
:::

## Want to do more?

Once Lantern Night shines, there is plenty left to try on your own:

- **Shadows.** The crates should cast shadows from the lanterns – an omnidirectional shadow map for one lantern, as in
  *Point Shadows*.
- **A brick wall.** Put up a warehouse wall behind the boardwalk with the bricks from *Normal Mapping*, so that the
  lanterns' light catches every joint.
- **Lantern posts.** Give each lantern a dark post down to the boards.
- **More lanterns.** A whole row of lanterns calls for deferred shading – try twenty of them.
- **Water.** Let the boardwalk end at dark water that reflects the lanterns.
