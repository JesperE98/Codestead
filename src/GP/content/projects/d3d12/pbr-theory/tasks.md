# PBR Theory – no tasks (DirectX 12)

learnopengl "PBR / Theory" has no code: the chapter explains the microfacet model, energy conservation, the
reflectance equation and the Cook-Torrance BRDF (normal distribution function, geometry function, Fresnel equation).
**No tasks**; `edits.txt` is empty.

start/ = solution/ = the start of the next chapter (`pbr-lighting/start`), so the learner can build and run the project
the PBR part works in: `main.cpp` (learnopengl's `1.1.lighting` scene: the 7 × 7 spheres, four lights, the camera at
(0, 0, 22)), `pbr.hlsl` (`VSMain` complete; in `PSMain` the light loop, the BRDF functions and the tone mapping are
still TODOs) and the material's five maps `albedo.png`, `normal.png`, `metallic.png`, `roughness.png`, `ao.png` (not
used before the last task of `pbr-lighting`). See `../pbr-lighting/tasks.md` for the fixed choices of the whole PBR
part and for what is in the files.

Picture (800×600, nothing depends on time; the same as the OpenGL project's): the clear colour (0.1, 0.1, 0.1) =
26,26,26 with 49 nearly black spheres on it – only the ambient term `float3(0.03f, 0.03f, 0.03f) * albedo * ao` =
(0.015, 0, 0), written without gamma correction: every sphere pixel is 4,0,0. The spheres' centres are at x = 153, 235,
318, 400, 482, 565, 647 and y = 53, 135, 218, 300, 382, 465, 547; each is about 66 pixels wide (the centre one covers
x 367..432, y 267..332). About 174,600 pixels are not the clear colour.

*Simulator:* it follows this project and shows this picture (see `../pbr-lighting/tasks.md`).
