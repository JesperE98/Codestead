# Exam: Lighting

Show what you've learned in *Lighting*: colours, the Phong lighting model, materials, lighting maps, the three kinds
of light casters and scenes with many lights. The questions cover the whole part, some of them for {{api}} in
particular. Answer all of them and press **Submit answers**; you need 80 % right to pass, and you can take the exam again.

```quiz
A coral object with the colour (1.0, 0.5, 0.31) is lit by a pure green light (0.0, 1.0, 0.0). Which colour do you see?
- [ ] (1.0, 1.0, 0.31): the light adds its green to the object
- [ ] (1.0, 0.5, 0.31): an object always shows its own colour
- [x] (0.0, 0.5, 0.0): a dark green
- [ ] (0.0, 0.0, 0.0): green light cannot light a coral object at all
---
The colour we see is the light's colour multiplied component by component with the object's colour. The object reflects half of the green and absorbs everything else; there is no red or blue in the light to reflect.
```

:::opengl
```quiz
The cube has been drawn with `lightingShader`. To draw the lamp next, with `lightCubeShader`, what does the render loop have to do?
- [ ] Only set the lamp's `model` uniform: `projection` and `view` are shared by all shader programs
- [x] Activate `lightCubeShader`, set its own `projection`, `view` and `model` uniforms, bind `lightCubeVAO` and draw
- [ ] Create a second VBO with a copy of the cube's vertices for the lamp
- [ ] Only call `lightCubeShader.use()`: the uniforms and the VAO of the cube are taken over
---
Uniforms belong to a shader program, so the lamp's program needs its own matrices. The lamp's VAO reads the same VBO as the cube – only the position attribute.
```
:::
:::vulkan
```quiz
The cube has been drawn with `lightingPipeline`. To draw the lamp next, with `lightCubePipeline`, what does `recordCommandBuffer()` have to record?
- [ ] Bind the pipeline, then bind the descriptor set and the vertex buffer again, because binding a pipeline unbinds them
- [ ] Nothing new except the draw: the push constants belong to the pipeline, so the lamp's model matrix is already set
- [x] Bind `lightCubePipeline`, push the lamp's model matrix and draw; the descriptor set and the vertex buffer stay bound
- [ ] End the render pass and begin a new one for the second pipeline
---
Both pipelines are created with the same pipeline layout, so the bound descriptor set stays valid, and vertex buffers don't depend on the pipeline. Only the pipeline and the model matrix change.
```
:::
:::d3d12
```quiz
The cube has been drawn with `m_pipelineState`. To draw the lamp next, with `m_lightCubePipelineState`, what does `PopulateCommandList` have to record?
- [ ] `Close` the command list and record the lamp in a second one
- [x] `SetPipelineState` with the lamp's PSO, the lamp's model matrix as root constants, and the draw; the root signature, the descriptor table and the vertex buffer stay set
- [ ] Nothing new except the draw: the root constants belong to the PSO, so the lamp's model matrix is already set
- [ ] A new root signature with `SetGraphicsRootSignature`, because every PSO needs its own root signature object
---
Both PSOs are created with the same root signature, so the root arguments stay as they are when the PSO changes. Only the pipeline state and the model matrix change.
```
:::

```quiz
The angle between a fragment's normal and the direction to the light is 60°. Both vectors are normalized. What is the diffuse factor `diff`?
- [ ] 1.0, because every face that is turned towards the light is fully lit
- [ ] 0.0, because only faces looking straight at the light are lit
- [ ] 0.87
- [x] 0.5
---
The dot product of two unit vectors is the cosine of the angle between them: cos 60° = 0.5. The face gets half the light it would get if it looked straight at the light.
```

```quiz
Why is the diffuse factor computed as `max(dot(norm, lightDir), 0.0)` and not just as the dot product?
- [ ] Because `dot` returns an angle in degrees, and `max` turns it into a factor
- [ ] Because the dot product can be greater than 1 for unnormalized vectors
- [ ] To make the lit side brighter
- [x] For faces turned away from the light the dot product is negative, which would subtract light instead of adding none
---
When the angle is over 90°, the cosine is negative. A negative diffuse term would darken the ambient and specular parts, so it is clamped to 0.
```

```quiz
The vertex shader passes the fragment's position on as `FragPos`: the vertex position multiplied by the model matrix only, not by view and projection. Why?
- [ ] Because the fragment shader can only receive vectors with three components
- [x] The light's position is given in world space, and the lighting needs all positions and directions in the same space
- [ ] To save two matrix multiplications per vertex
- [ ] Because view and projection would make the position too small for the fragment shader
---
`lightPos - FragPos` is only the direction to the light if both are world-space positions. Lighting can also be done in view space, but then the light's position must be transformed too.
```

```quiz
The normals are transformed with `transpose(inverse(model))` (without its translation). Why not simply with the upper-left 3×3 of the model matrix?
- [ ] Because normals must always be inverted to point out of the surface
- [x] When the model matrix scales non-uniformly, the transformed normals would no longer be perpendicular to the surface
- [ ] The two are always the same; the normal matrix is only faster
- [ ] Because the upper-left 3×3 still contains the translation
---
Scaling a cube non-uniformly tilts its faces differently than it tilts vectors along the normals. The transpose of the inverse fixes that. For rotations and uniform scales the two agree, apart from length – that's why the normal is normalized again.
```

:::opengl
```quiz
learnopengl computes the normal matrix in the vertex shader: `Normal = mat3(transpose(inverse(model))) * aNormal;`. What is the drawback, and what does a real program do instead?
- [ ] There is no drawback: the GPU computes it once per draw call and reuses it
- [ ] `inverse` only works in fragment shaders; move the line to the fragment shader
- [ ] `transpose` loses precision; send the model matrix twice instead
- [x] The matrix is inverted again for every vertex, which is expensive; compute it once per object on the CPU and send it as a uniform
---
The model matrix is the same for every vertex of the cube, so the result is the same too. Inverting a 4×4 matrix per vertex is wasted work that the CPU could do once.
```
:::
:::vulkan
```quiz
The vertex shader computes the normal matrix: `fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;`. What is the drawback, and what does a real program do instead?
- [ ] `inverse` only works in fragment shaders; move the line to the fragment shader
- [x] The matrix is inverted again for every vertex, which is expensive; compute it once per object on the CPU and send it with the model matrix
- [ ] Push constants can't be inverted; the model matrix must be in the uniform buffer for this
- [ ] There is no drawback: the GPU computes it once per draw and reuses it
---
The model matrix is the same for every vertex of the cube, so the result is the same too. Inverting a 4×4 matrix per vertex is wasted work that the CPU could do once.
```
:::
:::d3d12
```quiz
The project computes the normal matrix on the CPU, `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`, and sends it as root constants with the model matrix. Why not in the shader, as learnopengl does?
- [x] HLSL has no `inverse()` function, and inverting the matrix for every vertex would be expensive anyway
- [ ] Root constants can only hold matrices computed by DirectXMath
- [ ] Because DirectXMath's matrices are transposed, the shader would get the wrong inverse
- [ ] The pixel shader needs the normal matrix, and it cannot read the model matrix
---
The model matrix is the same for every vertex of the cube, so the CPU computes the result once per draw. Two matrices are 32 root constants, half of the root signature's 64 DWORDs.
```
:::

```quiz
The cube and the light stay where they are, and you walk around the cube with the camera. Which part of the Phong lighting changes on the cube's faces?
- [x] The specular part
- [ ] None of them: lighting doesn't depend on the camera
- [ ] The ambient part
- [ ] The diffuse part
---
Ambient is constant and diffuse depends only on the normal and the direction to the light. The specular highlight depends on the direction to the viewer (`viewPos`), so it moves when the camera moves.
```

:::opengl
```quiz
The fragment shader has `uniform Material material;` with a field `float shininess;`. How does `main.cpp` set it?
- [x] `lightingShader.setFloat("material.shininess", 32.0f);`
- [ ] It can't: uniform structs can only be set from the shader
- [ ] `lightingShader.setFloat("shininess", 32.0f);`
- [ ] With a single call that copies a C++ `Material` struct into `material`
---
Each field of a uniform struct is a uniform of its own, with the full name `material.shininess`. There is no single call for a whole struct.
```
:::
:::vulkan
```quiz
In the C++ `struct DirLight`, a padding float sits between `glm::vec3 direction;` and `glm::vec3 ambient;`. Why?
- [x] In the uniform block (std140) a `vec3` starts at a multiple of 16 bytes, so `ambient` is at byte 16; without the padding C++ would put it at byte 12
- [ ] Every member of a uniform buffer must be a multiple of 16 bytes long, so the padding makes `direction` a `vec4`
- [ ] The padding stores the light's w component, 0 for a direction
- [ ] Vulkan rejects buffers whose size isn't a multiple of 16 bytes
---
If the offsets differ, the shader reads every following member from the wrong bytes. The padding gives the C++ struct the same offsets as the std140 block.
```
:::
:::d3d12
```quiz
In the C++ `struct DirLight`, `float padding0;` sits between `XMFLOAT3 direction;` and `XMFLOAT3 ambient;`. Why?
- [x] HLSL packs a cbuffer in rows of 16 bytes and a `float3` never crosses into the next row, so `ambient` starts at byte 16; without the padding C++ would put it at byte 12
- [ ] Every member of a constant buffer must be a multiple of 16 bytes long, so the padding makes `direction` a `float4`
- [ ] The padding stores the light's w component, 0 for a direction
- [ ] Because a constant buffer must be a multiple of 256 bytes
---
If the offsets differ, the shader reads every following member from the wrong bytes. The padding gives the C++ struct the same offsets as HLSL. (The 256 bytes are the size of the whole buffer, which is rounded up separately.)
```
:::

```quiz
The container's specular map is black on the wooden planks and bright on the steel frame. What does that do?
- [ ] The steel frame doesn't get any diffuse light
- [ ] The highlight on the planks becomes larger and softer
- [ ] The planks are drawn black
- [x] The planks get no specular highlight, while the steel frame shines
---
The specular term is multiplied by the specular map's colour. Black gives zero specular light; the diffuse and ambient colours come from the diffuse map and are unaffected.
```

```quiz
A face of the container is turned away from the light. With an emission map added to the result, what do you see on that face?
- [ ] Nothing of the emission map: it is multiplied by the diffuse factor, which is 0 there
- [ ] The face is fully lit, as if it faced the light
- [x] The emission map's glyphs glow, because emission doesn't depend on any light
- [ ] Only the parts of the emission map that the specular map allows
---
Emission is light the surface gives off itself. It is added after ambient, diffuse and specular, so it shows on lit and unlit faces alike.
```

:::opengl
```quiz
`Material` now has `sampler2D diffuse;`, and the diffuse map is bound to texture unit 0. What does `main.cpp` have to set for the sampler?
- [ ] `lightingShader.setVec3("material.diffuse", …)` with the texture's average colour
- [x] `lightingShader.setInt("material.diffuse", 0);` – the number of the texture unit
- [ ] Nothing: samplers inside a struct are not allowed in GLSL
- [ ] `lightingShader.setInt("material.diffuse", diffuseMap);` – the texture object's id
---
A sampler uniform holds a texture unit, even inside a struct. The specular map works the same way, with unit 1.
```
:::
:::vulkan
```quiz
Why are the lighting maps declared as `layout(binding = 0) uniform sampler2D diffuseMap;` and so on, rather than as members of `Material` in the uniform block?
- [ ] Because push constants have to hold the material
- [ ] So that each map can use a different `VkSampler`
- [x] A uniform block cannot hold samplers, so each map is a combined image sampler with a binding of its own
- [ ] Members of a struct can't be textures in any shader language
---
Opaque types such as samplers can't live in a buffer; they are descriptors of their own. That's why the maps are at bindings 0, 1 and 3 – binding 2 is the uniform buffer.
```
:::
:::d3d12
```quiz
Why are the lighting maps declared as `Texture2D diffuseMap : register(t0);` and so on, rather than as members of `Material` in the cbuffer?
- [ ] Because root constants have to hold the material
- [ ] So that each map can use a different static sampler
- [x] Textures cannot be members of a cbuffer; they are SRVs, reached through a descriptor table
- [ ] Members of a struct can't be textures in any shader language
---
A constant buffer holds plain values. Textures are resources of their own, with views (SRVs) in the descriptor heap; the table of root parameter 2 maps them to `t0`, `t1`, ….
```
:::

```quiz
The directional light's direction is (-0.2, -1.0, -0.3), but the shader uses `lightDir = normalize(-light.direction)`. Why the minus?
- [ ] To turn the direction into a position infinitely far away
- [ ] Because directional lights shine upwards
- [x] The given direction points from the light into the scene, while the lighting calculations need the direction from the fragment towards the light
- [ ] Because the normals point into the surface
---
The diffuse factor is `dot(norm, lightDir)` with `lightDir` pointing towards the light, as in `lightPos - FragPos` for a point light. Negating the light's direction gives exactly that.
```

```quiz
The attenuation is `1.0 / (constant + linear * d + quadratic * d²)` with `constant = 1.0`. Why is the constant term 1.0?
- [ ] It sets the light's range to one unit
- [x] It keeps the denominator at least 1, so the attenuation never makes a light brighter than it is
- [ ] It makes the light fade linearly
- [ ] Without it the light would be too dark close to the source
---
With a constant term below 1, the attenuation would be greater than 1 close to the light and brighten it. With 1.0, 0.09 and 0.032 the light fades over a distance of about 50 units.
```

```quiz
A spotlight has `cutOff = cos(12.5°)`, and `theta` is the dot product of `lightDir` and the spotlight's (negated) direction. When is a fragment inside the cone?
- [ ] When `theta` equals 12.5
- [x] When `theta > cutOff`, because the cosine gets bigger as the angle gets smaller
- [ ] When `theta < cutOff`, because a smaller angle is inside
- [ ] When `theta` is negative
---
Both values are cosines, not angles. A fragment straight in front of the light has an angle of 0° and `theta` = 1; at the cone's edge `theta` = cos 12.5° ≈ 0.976. Comparing cosines saves the `acos`.
```

```quiz
In the last scene a fragment is lit by the directional light, four point lights and the flashlight. How does the fragment shader combine them?
- [ ] It multiplies the contributions
- [ ] It uses the brightest light only
- [ ] It takes the average of the contributions
- [x] It adds the contributions of all lights
---
Light adds up: each `Calc…Light` function returns one light's ambient, diffuse and specular, and the results are summed. Where the sum is greater than 1, the colour written to the window is clamped to 1.
```

:::opengl
```quiz
The shader declares `uniform PointLight pointLights[NR_POINT_LIGHTS];`. How does `main.cpp` set the position of the third point light?
- [ ] With one call that sets the whole array from `pointLightPositions`
- [ ] `lightingShader.setVec3("pointLights.position[2]", pointLightPositions[2]);`
- [ ] `lightingShader.setVec3("pointLights[3].position", pointLightPositions[3]);`
- [x] `lightingShader.setVec3("pointLights[2].position", pointLightPositions[2]);`
---
Each field of each element is a uniform of its own, named with the element's index (starting at 0) and the field.
```
:::
:::vulkan
```quiz
The uniform block holds `PointLight pointLights[NR_POINT_LIGHTS];`, and the C++ `UniformBufferObject` holds `PointLight pointLights[4];`. What makes the two arrays match?
- [ ] `#define NR_POINT_LIGHTS 4` in `main.cpp`, which tells Vulkan the array's length
- [ ] Vulkan copies each array element into its own descriptor
- [x] The C++ `PointLight` has the same layout as the std140 struct, padding included, so both arrays have the same stride: 80 bytes
- [ ] Nothing: arrays of structs can't be in a uniform block, so the shader reads four separate blocks
---
The uniform buffer is just bytes. If each element has the same size and the same offsets on both sides, element i lands where the shader expects it.
```
:::
:::d3d12
```quiz
The cbuffer holds `PointLight pointLights[NR_POINT_LIGHTS];`, and the C++ `SceneConstantBuffer` holds `PointLight pointLights[4];`. What makes the two arrays match?
- [ ] Nothing: arrays of structs can't be in a cbuffer, so the shader reads four separate cbuffers
- [x] The C++ `PointLight` has the same layout as HLSL packs it, padding included, so each element is 80 bytes and starts a new 16-byte row on both sides
- [ ] Direct3D copies each array element into its own constant buffer view
- [ ] `#define NR_POINT_LIGHTS 4` in `main.cpp`, which tells Direct3D the array's length
---
The constant buffer is just bytes. In a cbuffer every array element starts a new 16-byte row; because the C++ struct is a multiple of 16 bytes, element i lands where the shader expects it.
```
:::
