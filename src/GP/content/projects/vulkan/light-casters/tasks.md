# Light Casters (Vulkan) – directional light, point light with attenuation, spotlight (learnopengl "Light casters")

Start: the result of "Lighting Maps" without the emission map (diffuse map at binding 0, specular map at binding 1,
the uniform buffer at binding 2), the cube's shaders renamed `shaders/light_casters.vert` / `.frag`, and – as in
learnopengl – the **ten containers** again: `cubePositions` (learnopengl's positions) and a loop in
`recordCommandBuffer()` that pushes `model = translate(cubePositions[i]) * rotate(20° × i about (1, 0.3, 0.5))` and
draws each container (no rotation over time). The camera is back at learnopengl's default: `cameraPos (0, 0, 3)`,
`cameraFront (0, 0, -1)`, `yaw = -90`, `pitch = 0`, so all ten containers are in view and container 0 fills the centre.
The point light of "Lighting Maps" (at `lightPos (1.2, 1, 2)`, ambient 0.2, diffuse 0.5, specular 1, shininess 64)
lights them; the lamp is drawn but lies outside the view.

**std140:** the C++ `Light` mirrors the shader's `Light` in learnopengl's member order. A `vec3` starts at a multiple
of 16 bytes, a float may fill the 4 bytes after a vec3, and the size of the struct is rounded up to a multiple of 16:
the padding floats (`pad1`…) in C++ give each member the shader's offset (checked by the pictures matching the
OpenGL version). Light sizes: directional 64, point 80, spot 96, soft spot 112 bytes.

Nothing depends on time (no input: the flashlight looks straight down -z). Colours measured on lavapipe; they match
the OpenGL version of this chapter (±2), except on far containers where OpenGL's mipmaps average the texture.
Named points: container 0's wood C (400, 300), its steel frame F1 (400, 170) and F2 (530, 300), a container on the
right R (650, 250), one at the top left T (150, 150), a small container at the lower left B (215, 390), background
(40, 550) = (26, 26, 26) in every step.
- start: C = (82, 54, 28), F1 = (86, 87, 91), F2 = (88, 89, 92), R = (68, 45, 23), T = (30, 30, 32),
  B = (78, 51, 27).

## directional
- **Task:** Make the light directional (like the sun): in the shader's `Light` replace `position` by `vec3 direction;`
  (learnopengl keeps `// vec3 position;` as a comment) and use `vec3 lightDir = normalize(-ubo.light.direction);`; in
  C++ `glm::vec3 direction; float pad1;` and `ubo.light.direction = glm::vec3(-0.2f, -1.0f, -0.3f);`,
  `ubo.material.shininess = 32.0f;`, and comment out the lamp's draw in `recordCommandBuffer()` (bind, model, push,
  draw).
- **Hint:** A directional light has no position, only a direction: its rays are parallel, so every container is lit
  from the same side.
- **When done:** all containers lit from above (their top faces bright, the faces towards the camera dim):
  C = (51, 33, 18), F1 = (51, 52, 54), F2 = (51, 52, 54), R = (32, 21, 11), T = (30, 30, 32), B = (72, 48, 25);
  only the containers are drawn (no lamp draw).

## point-light
- **Task:** A point light that fades with distance: `Light` gets `position` back (instead of `direction`) and
  `float constant; float linear; float quadratic;` after `specular`; `lightDir = normalize(ubo.light.position -
  fragPos)`; `float distance = length(ubo.light.position - fragPos); float attenuation = 1.0 / (ubo.light.constant +
  ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));` multiplies ambient, diffuse and
  specular. C++: `glm::vec3 position; float pad1; …; glm::vec3 specular; float constant; float linear; float
  quadratic; float pad4; float pad5;`, `ubo.light.position = lightPos;`, `ubo.light.constant = 1.0f;
  ubo.light.linear = 0.09f; ubo.light.quadratic = 0.032f;`, and the lamp's draw back.
- **Hint:** With constant 1, linear 0.09 and quadratic 0.032 the light reaches about 50 units: near containers are
  bright, far ones fade to black.
- **When done:** the containers near the light (front right) lit, far ones much darker: C = (61, 40, 21),
  F1 = (66, 67, 70), F2 = (68, 69, 71), R = (44, 29, 15), T = (17, 17, 18), B = (8, 5, 3); the lamp is drawn again
  (outside the view).

## spotlight
- **Task:** A flashlight at the camera: `Light` gets `vec3 direction; float cutOff;` after `position` (C++:
  `glm::vec3 direction; float cutOff;` after `pad1`); `ubo.light.position = cameraPos; ubo.light.direction =
  cameraFront; ubo.light.cutOff = glm::cos(glm::radians(12.5f));`, ambient `0.1`, diffuse `0.8`; the fragment shader
  lights only inside the cone: `float theta = dot(lightDir, normalize(-ubo.light.direction)); if (theta >
  ubo.light.cutOff) { …ambient + attenuated diffuse and specular… } else { outColor = vec4(ubo.light.ambient *
  texture(diffuseMap, fragTexCoord).rgb, 1.0); }` (learnopengl's code); the lamp's draw commented out again.
- **Hint:** `cutOff` is the cosine of the cone's half angle; a fragment is inside when the cosine of its angle is
  larger.
- **When done:** a bright disc with a hard edge (radius about 160 px) centred on container 0: its front face is lit
  but for the corners, everything else only ambient: C = (112, 77, 47), F1 = (115, 117, 121), F2 = (115, 116, 120),
  corners (265, 165) = (535, 435) = (15, 15, 16); R = (13, 9, 5), T = (15, 15, 16), B = (13, 9, 5).

## soft-edges
- **Task:** Smooth the spotlight's edge: `float outerCutOff;` after `cutOff` (C++: `float outerCutOff; float pad6;
  float pad7; float pad8;` – `ambient` starts at the next multiple of 16 bytes), `ubo.light.outerCutOff =
  glm::cos(glm::radians(17.5f));`, and learnopengl's shader without the `if`: `float epsilon = ubo.light.cutOff -
  ubo.light.outerCutOff; float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);` multiplies
  diffuse and specular (and the attenuation multiplies all three).
- **Hint:** Between the inner (12.5°) and the outer cone (17.5°) the intensity goes from 1 to 0.
- **When done:** the disc fades out softly towards its edge: C = (107, 75, 45), F1 = (111, 112, 116),
  F2 = (110, 111, 115), the corners of container 0 half lit (265, 165) = (59, 60, 62), (535, 435) = (57, 58, 61);
  outside the cone only the (now attenuated) ambient light: R = (7, 5, 2), T = (8, 8, 8), B = (4, 3, 2).
