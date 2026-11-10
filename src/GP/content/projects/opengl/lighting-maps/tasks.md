# Lighting Maps – tasks (OpenGL)

learnopengl "Lighting maps": `lighting_maps_diffuse.cpp` (4.1), `lighting_maps_specular.cpp` (4.2) and exercise 4
(`lighting_maps_exercise4`, the emission map). Files: `main.cpp`, `shader_m.h`, `lighting_maps.vs`, `lighting_maps.fs`,
`light_cube.vs`, `light_cube.fs`, and the course's own images `container2.png` (wooden planks in a steel frame – the
diffuse map), `container2_specular.png` (steel bright, wood dark – the specular map), `matrix.png` (green glyphs on
black – the emission map). learnopengl's `container2.png`/`matrix.jpg` are not used.

Start (prepared from the Materials solution): shader files renamed to `lighting_maps.vs/.fs` (the Materials shaders),
the light back to learnopengl's fixed values (`light.ambient` 0.2, `light.diffuse` 0.5, `light.specular` 1.0 – no
changing colour), material still coral (ambient/diffuse (1, 0.5, 0.31), specular 0.5, shininess 32). New in the start:
`#define STB_IMAGE_IMPLEMENTATION` + `#include <stb_image.h>`; learnopengl's 36 vertices with **position + normal +
texture coordinates** (8 floats, all position/normal attribute strides `8 * sizeof(float)`); learnopengl's utility
`unsigned int loadTexture(const char *path)` at the end of the file (declared at the top): it loads the image with
`stbi_load`, picks `GL_RED`/`GL_RGB`/`GL_RGBA` from the channel count, uploads it, generates mipmaps and sets REPEAT +
LINEAR_MIPMAP_LINEAR/LINEAR. Unlike learnopengl it calls `stbi_set_flip_vertically_on_load(true)` (as the course's
Textures chapter did), so the images appear upright. TODOs: the texture coordinate attribute, loading the textures, and
binding them in the loop. Same front-left camera as Colors.

Pixels measured with Mesa (llvmpipe) on copies with `glfwGetTime()` replaced by `1.0` (nothing depends on time),
coordinates from the top left of the 800×600 window. Named points: **front** (302,370) = centre of the front face (wood
once textured), **front-lower-right** (331,415) (wood), **frame** (243,278) = steel frame at the upper-left corner of
the front face, where the specular highlight is, **plank** (253,291) = wood right next to it, **left** (163,370) =
centre of the left face (wood, only ambient), **lamp** (641,195) = 255,255,255 in every step, **background** (400,300)
and (100,100) = 26,26,26.

Start picture (= Materials after `light`): a coral cube – front ≈ 141,71,45, frame/highlight ≈ 232,165,139, plank ≈
216,148,122, left ≈ 51,26,16.

## `texcoords`
- **Task:** Pass the texture coordinates on: vertex attribute 2 (2 floats after the normal), `aTexCoords` in → `TexCoords` out in `lighting_maps.vs`, `in vec2 TexCoords;` in `lighting_maps.fs`.
- **Hint:** `glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));` + `glEnableVertexAttribArray(2);`, and `TexCoords = aTexCoords;` in the vertex shader.
- **When done:** `main.cpp` (cube VAO): `// texture coord attribute` with the two calls of the hint.
  `lighting_maps.vs`: `layout (location = 2) in vec2 aTexCoords;`, `out vec2 TexCoords;`, `TexCoords = aTexCoords;`.
  `lighting_maps.fs`: `in vec2 TexCoords;`. **No visible change** (coral cube).

## `diffuse-map`
- **Task:** Make the material's diffuse colour a texture: in `Material` replace `vec3 ambient; vec3 diffuse;` by `sampler2D diffuse;` and take the ambient and diffuse colour from `texture(material.diffuse, TexCoords)`; load `container2.png` with `loadTexture`, tell the shader that `material.diffuse` is texture unit 0, and bind the texture on unit 0 before drawing the cube. Use shininess 64.
- **Hint:** `vec3 ambient = light.ambient * texture(material.diffuse, TexCoords).rgb;` and `vec3 diffuse = light.diffuse * diff * texture(material.diffuse, TexCoords).rgb;`. After loading: `lightingShader.use(); lightingShader.setInt("material.diffuse", 0);`. In the loop: `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, diffuseMap);`. Delete the texture at the end.
- **When done:** `lighting_maps.fs`: `struct Material { sampler2D diffuse; vec3 specular; float shininess; };`, ambient
  and diffuse use `texture(material.diffuse, TexCoords).rgb`. `main.cpp`: `unsigned int diffuseMap = loadTexture("container2.png");`,
  `// shader configuration` `lightingShader.use(); lightingShader.setInt("material.diffuse", 0);` (once, before the
  loop); no `material.ambient`/`material.diffuse` setVec3 any more; `material.specular` (0.5, 0.5, 0.5) stays,
  `material.shininess` 64.0; `// bind diffuse map` `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, diffuseMap);`
  before the cube's draw; `glDeleteTextures(1, &diffuseMap);` at the end. The cube is a **wooden crate in a steel
  frame**, lit like before: front (wood) ≈ 82,54,28, front-lower-right ≈ 73,48,25, left (wood, ambient only) ≈
  30,20,10; the highlight is grey-white on steel and wood alike: frame ≈ 179,180,183, plank ≈ 117,101,88.

## `specular-map`
- **Task:** Make the specular strength a texture too: `sampler2D specular;` in `Material`, `specular = light.specular * spec * texture(material.specular, TexCoords).rgb`; load `container2_specular.png` as `specularMap`, `material.specular` = unit 1, bind it on unit 1.
- **Hint:** Remove the `material.specular` setVec3 – it is a sampler now: `lightingShader.setInt("material.specular", 1);`. In the loop: `glActiveTexture(GL_TEXTURE1); glBindTexture(GL_TEXTURE_2D, specularMap);`
- **When done:** `lighting_maps.fs`: `sampler2D specular;` and the specular term of the task. `main.cpp`:
  `unsigned int specularMap = loadTexture("container2_specular.png");`, `lightingShader.setInt("material.specular", 1);`,
  no `setVec3("material.specular", …)`, `// bind specular map` on `GL_TEXTURE1`, `glDeleteTextures(1, &specularMap);`.
  **Only the steel shines**: frame 179,180,183 → **253,254,255** (bright white), plank 117,101,88 → **73,58,45** (the wood
  lost its highlight); front ≈ 82,53,28, left ≈ 30,20,10 unchanged. (= learnopengl's `lighting_maps_specular.cpp`.)

## `emission`
- **Task:** Exercise: add an emission map – `sampler2D emission;` in `Material`, `emission = texture(material.emission, TexCoords).rgb` added to the result; load `matrix.png` as `emissionMap` on texture unit 2.
- **Hint:** Emitted light does not depend on any light source: `vec3 result = ambient + diffuse + specular + emission;`. `lightingShader.setInt("material.emission", 2);`, and bind it with `glActiveTexture(GL_TEXTURE2)`.
- **When done:** `lighting_maps.fs`: `sampler2D emission;`, `// emission` `vec3 emission = texture(material.emission, TexCoords).rgb;`,
  `vec3 result = ambient + diffuse + specular + emission;`. `main.cpp`: `unsigned int emissionMap = loadTexture("matrix.png");`,
  `lightingShader.setInt("material.emission", 2);`, `// bind emission map` on `GL_TEXTURE2`,
  `glDeleteTextures(1, &emissionMap);`. **Green glyphs glow** on both visible faces, even on the unlit left face: front
  (302,370) ≈ 82,208,74, left (163,370) ≈ 30,190,61, plank (253,291) ≈ 73,255,117; between the glyphs the crate is
  unchanged, e.g. (271,320) ≈ 73,49,26 and frame (243,278) 253,254,255. Final state.

Optional exercises of the chapter (not tasks): set the light's ambient/diffuse/specular to other values; invert the
specular map in the shader (`1.0 - texture(material.specular, TexCoords).rgb`: the wood shines, the steel not);
a coloured specular map. The next chapter starts without the emission map.
