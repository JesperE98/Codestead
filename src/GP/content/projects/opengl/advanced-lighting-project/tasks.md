# Project: Lantern night on the boardwalk – milestones (OpenGL)

The optional project after *Advanced Lighting*. Files: `main.cpp`, `shader_m.h`, `wood.png`, `container2.png`, `bloom.vs/.fs`, `light_box.fs`, `blur.vs/.fs`, `bloom_final.vs/.fs` – the bloom chapter's solution with the six crates standing on the floor (bottom at y = -0.5): (-1, 0, -1.5) scale 0.5; (1.5, 0, 1) scale 0.5; (-3.5, 0.5, -3) turned 20° about y; (-3.5, 2, -3) turned 45°, scale 0.5 (stacked on the last); (3.5, 0.5, -4) turned -35°; (-3, 0, 0) scale 0.5. Everything else as in *Bloom*: camera (0, 0, 5) looking down -z, the four test lights white, red, blue, green, exposure 1.0, 10 blur passes.

Checks (`TaskChecks.Project.AdvancedLighting.ts`) count pixels of a kind in the whole 160 × 120 check frame, so lanterns placed or coloured a little differently pass too. Counts measured with the simulator; the same in every API.

## `lamps`
- **Task:** Replace the four coloured test lights with four lanterns with a warm, yellow-orange light (red above green above blue), each much brighter than 1.0, at (-2.5, 1, -1), (2.5, 1, -1), (-2.5, 1, -5) and (2.5, 1, -5).
- **Hint:** Only the values in `lightPositions` and `lightColors` change. Something like (10, 6, 2) is a good sodium-lamp colour.
- **When done:** Four lights at (-2.5, 1, -1), (2.5, 1, -1), (-2.5, 1, -5), (2.5, 1, -5), all (10, 6, 2). The frame: no green, strong blue or pure red pixels left; 765 warm bright pixels (red > 0.9, blue < red - 0.25; start: 95). **Check:** fewer than 20 pixels each of green (g > r + 0.1 and g > b + 0.1), strong blue (b > r + 0.15 and b > 0.3) and pure red (r > 0.5, g and b < 0.05), and more than 200 warm bright ones – wherever the lanterns hang.

## `moonlight`
- **Task:** Add a faint, cold moonlight: where no lantern reaches, the crates should be dark blue instead of black.
- **Hint:** The ambient term in `bloom.fs` is `0.0 * color`. A small bluish colour instead of 0.0 – a few hundredths – is moonlight.
- **When done:** `bloom.fs`: `ambient = (0.02, 0.03, 0.08) * color`. The crates' sides away from the lanterns turn dark blue: 598 pixels with b > r + 0.02 and b > 0.04 (0 before). **Check:** the lanterns' check and more than 200 such pixels.

## `wet-boards`
- **Task:** Let the wet boards and crates reflect the lanterns: add a Blinn-Phong specular term to the scene's lighting, with the halfway vector between the directions to the light and to the camera.
- **Hint:** In the light loop of `bloom.fs`: `normalize(lightDir + viewDir)`, then `pow(max(dot(normal, halfwayDir), 0.0), …)` times the light's colour, added before the attenuation. `viewDir` is already there.
- **When done:** `bloom.fs`: in the light loop `halfwayDir = normalize(lightDir + viewDir)`, `spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0)`, `result += lightColor * spec` before the attenuation. Bright highlights on the boards towards the lanterns at the back. **Check (code, the highlight alone is hard to tell from the diffuse light):** the lanterns' check, a halfway vector (`halfway…` or `normalize(a + b)`) and `pow(max|clamp|saturate(dot(` in the shaders.

## `mist`
- **Task:** Make the lanterns' glow stronger, as if their light were caught in mist.
- **Hint:** `hdrColor += bloomColor;` in `bloom_final.fs` can add the blur with a factor above 1 – or blur more often (`amount` in `main.cpp`, keep it even).
- **When done:** `bloom_final.fs`: `hdrColor += bloomColor * 2.0`. Wider, brighter halos (1,785 pixels with a channel above 0.9; 1,338 before). **Check (code):** the lanterns' check and a factor above 1 next to `bloom…` (`bloomColor * k` or `k * bloomColor`), or `amount` above 10.

## `exposure`
- **Task:** Turn the exposure down (below 1.0) until the boardwalk looks like night again: the boards between the lanterns dark, the lanterns still bright.
- **Hint:** The global `exposure` in `main.cpp` goes to the final pass's tone mapping. Try values between 0.1 and 0.8 – the solution uses 0.25.
- **When done:** `exposure = 0.25` (global in `main.cpp`). The boards between the lanterns dark again: 846 pixels with a channel above 0.9 (1,785 at exposure 1.0 with the mist). **Check:** no test lights, an exposure between 0 and 0.9 in the code (`exposure = x` or `"exposure", x`), and between 150 and 1,300 pixels with a channel above 0.9 – the lanterns still bright, the frame no longer glaring.

## `flicker`
- **Task:** Let the lantern at the back on the left flicker: its light should dip and come back over time.
- **Hint:** In the render loop, before the light uniforms are set: `lightColors[2]` = the lantern's colour times a factor that changes with `currentFrame`, for example `0.55f + 0.45f * sin(currentFrame * 6.0f)`.
- **When done:** In the render loop, before the light uniforms are set (`currentFrame`): `lightColors[2] = (10, 6, 2) * (0.55 + 0.45 * sin(t * 6))` – the lantern at the back left (and its cube) at 42 % at 1 s, 97 % at 2.3 s. **Check:** the lanterns' check and the frame at 2.3 s differs from the one at 1 s.
