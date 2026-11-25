# Project: The material showroom – milestones (OpenGL)

The optional project after *PBR*. Files: `main.cpp`, `shader_m.h`, the IBL shaders, `pbr.vs/.fs`, `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png`, `environment.hdr` – the specular IBL chapter's solution unchanged: the environment cube map, irradiance map, pre-filtered map and BRDF LUT; four lights of 300 at (±10, ±10, 10); 3 × 3 spheres (scale 2.4, spacing 6) with the riveted steel's five maps; camera (0, 0, 22) looking down -z.

Checks (`TaskChecks.Project.Pbr.ts`) look at the sky at a few points and at the share of pixels of a kind in a 100 × 100 box round each sample (800×600 window coordinates), so other values of the same kind of material pass too. Counts measured with the simulator in the 160 × 120 check frame (OpenGL; the other APIs within a few pixels).

## `showroom`
- **Task:** Replace the 3 × 3 grid with the showroom: the hero (still with the maps) at (0, 2, 0), scaled 3.6, and three samples scaled 2.4 at (-6, -6, 0), (0, -6, 0) and (6, -6, 0).
- **Hint:** Four draws instead of the two loops: each a model matrix (translate, the rotation that turns the textures' middle to the camera, scale), the normal matrix and `renderSphere()`.
- **When done:** The two loops (and `nrRows`, `nrColumns`) replaced by four draws: the hero translate (0, 2, 0) · rotate 90° about y · scale 3.6, the samples translate (-6 | 0 | 6, -6, 0) · rotate 90° · scale 2.4 – all still with the maps. On the screen: the hero round (400, 234), radius ≈ 118; the samples round (202 | 400 | 597, 497), radius ≈ 79. **Check:** the sky (b > 0.6, b > r + 0.03) where the grid's top spheres were, (202, 102) and (597, 102), and above the hero at (400, 60); no sky at (500, 234) inside the large hero.

## `gold`
- **Task:** Make the left sample gold: a sample takes its albedo, metallic and roughness from values of its own instead of the maps (the hero keeps its maps). Gold: metallic, albedo about (1.0, 0.71, 0.29), fairly smooth.
- **Hint:** In `pbr.fs`: uniforms `albedoValue`, `metallicValue`, `roughnessValue` and a `bool useMaps`; without the maps `N = normalize(Normal)` and `ao = 1.0`. In `main.cpp`, before each `renderSphere()`: `pbrShader.setBool("useMaps", …)` and the values with `setVec3` / `setFloat`. Roughness 0.2–0.4.
- **When done:** `pbr.fs`: uniforms `bool useMaps`, `vec3 albedoValue`, `float metallicValue`, `float roughnessValue`; `main.cpp` sets them with `setBool` / `setVec3` / `setFloat` before each draw; the shader takes the values unless `useMaps`, and then `N` = the interpolated normal, `ao` = 1. The hero `useMaps` true, the left sample false with (1.0, 0.71, 0.29), metallic 1, roughness 0.25; the other two samples still with the maps. The left sample gold, a little greyed by the blue-grey environment it reflects (its centre 0.70, 0.66, 0.55). **Check:** the showroom's check and more than half of the pixels in the box (152..252, 447..547) gold (r > b + 0.1, g > b + 0.05, g > r - 0.12 – the maps' rust fails the last); 346 of 441 (4 with the maps).

## `plastic`
- **Task:** Make the middle sample rough plastic in a strong colour of your choice: not a metal, rough enough for a soft, wide highlight.
- **Hint:** Metallic 0.0, roughness 0.6–1.0, and an albedo with one strong channel – for example (0.1, 0.35, 0.8).
- **When done:** The middle sample (0.1, 0.35, 0.8), metallic 0, roughness 0.8: a matt light blue (centre 0.48, 0.68, 0.82). **Check:** the showroom's check and more than 60 % of the box (350..450, 447..547) strongly coloured (max - min channel > 0.2): 441 of 441 (19 with the maps).

## `polished-metal`
- **Task:** Make the right sample polished silver: a metal with a light grey albedo and almost no roughness, mirroring the room.
- **Hint:** Metallic 1.0, an albedo such as (0.95, 0.93, 0.88) and roughness 0.1 or less: the pre-filtered map's sharpest mip level.
- **When done:** The right sample (0.95, 0.93, 0.88), metallic 1, roughness 0.05: a mirror – the sky above, the dark ground below its middle. **Check:** the showroom's check and in the box (547..647, 447..547) under 1 % rust (r > b + 0.15, r > g + 0.1), under 8 % colour and over 10 % dark pixels (r + g + b < 1.05): 0, 0 and 70 of 441 (the maps: 9 rust, 21 dark).

## `turntable`
- **Task:** Let the hero turn slowly about its vertical axis over time.
- **Hint:** One more `glm::rotate` about (0, 1, 0) in the hero's model matrix, with an angle that grows with `currentFrame` – for example half a radian per second.
- **When done:** One more rotation about y in the hero's model matrix, half a radian per second of the program's time. **Check:** the showroom's check and the frame at 2.3 s differs from the one at 1 s (the samples have no texture: turning them would show nothing).
