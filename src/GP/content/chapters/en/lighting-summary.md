# Review: Lighting

Congratulations on reaching the end of the *Lighting* part. You started with a coral cube under a white light and
ended with a scene of ten containers lit by a sun, four point lights and a flashlight – all computed in your own
shaders. This page is a glossary of the most important terms of the part, chapter by chapter, like the review
learnopengl.com has at the end of its lighting section. Use it to look things up, and as a check: if a definition
surprises you, go back to the chapter it comes from.

The terms outside the boxes are the same in every API: lighting is maths in the shaders, and the maths doesn't
depend on the API. The boxes say how {{api}} gets the values to the shaders. When you're done, the exam at the end of
the part checks what you've learned.

## Colors

- **Colour**: a vector of red, green and blue, each from 0.0 to 1.0.
- **Reflected colour**: the colour we see is the light's colour multiplied component by component with the object's
  colour: the object absorbs the rest. A coral object (1.0, 0.5, 0.31) under white light looks coral; under a green
  light (0.0, 1.0, 0.0) it looks (0.0, 0.5, 0.0), dark green.
- **Light source** (the **lamp**): a small white cube at `lightPos` (1.2, 1.0, 2.0) that shows where the light is.
  It has shaders of its own, so it stays white whatever the lighting shaders do.
- **Lighting scene**: the course's lighting chapters clear to dark grey (0.1, 0.1, 0.1) and start with the camera
  front-left of the cube, so its lit front face and the lamp are in view.

## Basic lighting

- **Phong lighting model**: the light on a surface as the sum of three parts: **ambient**, **diffuse** and
  **specular**.
- **Ambient lighting**: a small constant amount of the light's colour (here 0.1 of it), so that even faces turned
  away from the light are not completely black – a cheap stand-in for light bounced around the scene (*global
  illumination*).
- **Normal vector**: a unit vector perpendicular to a surface. The cube has one per vertex, as a new vertex
  attribute.
- **Fragment position** (`FragPos`): the fragment's position in world space – the vertex position times the model
  matrix only – because the light's position is given in world space.
- **Diffuse lighting**: the more directly a face looks at the light, the brighter it is:
  `diff = max(dot(norm, lightDir), 0.0)` with `lightDir = normalize(lightPos - FragPos)`. Both vectors must be
  normalized; `max` keeps faces turned away from the light from getting negative light.
- **Normal matrix**: `transpose(inverse(model))`, without its translation. It turns the normals with the object and
  keeps them perpendicular to the surface even when the model matrix scales non-uniformly.
- **Specular lighting**: the bright highlight where the light is reflected towards the viewer:
  `reflectDir = reflect(-lightDir, norm)`, `viewDir = normalize(viewPos - FragPos)` and
  `spec = pow(max(dot(viewDir, reflectDir), 0.0), 32)`. It depends on where the camera is (`viewPos`).
- **Shininess**: the exponent of the specular term. The higher it is, the smaller and sharper the highlight.
- **Phong shading** and **Gouraud shading**: lighting computed per fragment (what the course does) or only per vertex
  and interpolated, which is cheaper but loses the highlight's shape.

## Materials

- **Material**: the surface's colours for each part of the lighting – `ambient`, `diffuse` and `specular` – and its
  `shininess`. They replace the single object colour and the fixed strengths 0.1, 0.5 and 32.
- **Light properties**: the light's intensities for each part – `ambient` (0.2), `diffuse` (0.5) and `specular`
  (1.0) in learnopengl's example – plus its `position`.
- **Struct**: both are structs in the shader, `Material material` and `Light light`.
- **Coloured light**: changing the light's colour over time changes the object's colour too, because the two are
  multiplied.

## Lighting maps

- **Lighting map**: a texture that gives a lighting property per fragment instead of per object.
- **Diffuse map**: a texture with the surface's diffuse colour; the ambient colour is taken from it too, since it's
  almost always the same colour.
- **Specular map**: a texture with the specular intensity: black where the surface doesn't shine (the wooden
  planks), bright where it does (the steel frame).
- **Emission map**: light the surface gives off itself. It is added after the lighting and doesn't depend on any
  light, so it glows even on faces in the dark.
- **Texture coordinates**: back as a vertex attribute, next to the position and the normal.

## Light casters

- **Light caster**: a light source that casts light on objects. There are three kinds.
- **Directional light**: a light infinitely far away, such as the sun: its rays are parallel and come from the same
  direction everywhere, so it has a direction but no position. The direction points *from* the light, so the shader
  uses `lightDir = normalize(-light.direction)`.
- **Point light**: a light at a position that shines in all directions and gets weaker with distance.
- **Attenuation**: how the light fades with the distance d: `1.0 / (constant + linear * d + quadratic * d²)`. The
  constant term 1.0 keeps the result at most 1; the values 1.0, 0.09 and 0.032 cover a distance of about 50 units.
  Ambient, diffuse and specular are all multiplied by it.
- **Spotlight**: a light at a position that shines in one direction, within a cone – here a **flashlight** at the
  camera, pointing where the camera looks.
- **Cut-off angle**: the cone's half angle. The shader compares cosines, not angles: `theta`, the dot product of
  `lightDir` and the spotlight's direction, is inside the cone when `theta > cutOff`, because the cosine gets
  *bigger* as the angle gets smaller.
- **Soft edges**: an inner and an **outer cut-off**; between them the intensity goes from 1 to 0:
  `clamp((theta - outerCutOff) / (cutOff - outerCutOff), 0.0, 1.0)`.

## Multiple lights

- **Combining lights**: each light adds its own contribution; the fragment's colour is the sum.
- **One function per light type**: `CalcDirLight`, `CalcPointLight` and `CalcSpotLight` compute one light's
  ambient, diffuse and specular, which keeps the shader readable.
- **Arrays of lights**: `#define NR_POINT_LIGHTS 4`, an array of `PointLight` structs and a loop that adds each one.
- **The scene**: a directional light, four point lights (each with a lamp) and the flashlight on ten containers.

## How the values get to the shaders

:::opengl
- **Uniform structs**: `uniform Material material;` and `uniform Light light;`. Each field is a uniform of its own,
  set by its full name: `lightingShader.setVec3("material.ambient", …)`, `setFloat("material.shininess", 32.0f)`.
- **Arrays of structs**: each element's fields are set by name too: `setVec3("pointLights[0].position", …)`.
- **Samplers in a struct**: `sampler2D diffuse;` can be a field of `Material`; `setInt("material.diffuse", 0)` sets
  it to texture unit 0, the specular map is on unit 1 and the emission map on unit 2.
- **The lamp**: a second shader program (`lightCubeShader`) and a second VAO (`lightCubeVAO`) that reads the same VBO,
  with only the position attribute.
- **Vertex attributes**: the normal is attribute 1 and the texture coordinates attribute 2, read with
  `glVertexAttribPointer` from the same VBO.
- **Normal matrix**: computed in the vertex shader, `mat3(transpose(inverse(model))) * aNormal`. Inverting a matrix
  for every vertex is expensive; in a real program you compute it once per object on the CPU and send it as a
  uniform.
:::
:::vulkan
- **One uniform buffer for the frame**: view, projection, `viewPos`, the material and the lights are members of the
  uniform block at **binding 2**, filled in `updateUniformBuffer()`. Its `stageFlags` now include the fragment stage.
- **std140 layout**: a uniform block lays out its members by the std140 rules: a `vec3` starts at a multiple of 16
  bytes, and so does a struct. The C++ struct has the same offsets thanks to a padding `float` after each
  `glm::vec3` that isn't followed by a float; an array of `PointLight`s has the same stride (80 bytes) on both sides.
- **The model matrix**: still a push constant, set before each draw.
- **The lamp**: a second `VkPipeline` (`lightCubePipeline`) with its own shaders and the same pipeline layout, made
  by the `createPipeline` helper; the descriptor set and the vertex buffer stay bound when you switch.
- **Vertex attributes**: the normal is location 1 and the texture coordinates location 2, described in
  `getAttributeDescriptions()`.
- **Normal matrix**: computed in the vertex shader, `mat3(transpose(inverse(pc.model))) * inNormal`. Inverting a
  matrix for every vertex is expensive; in a real program you compute it once per object on the CPU.
- **Lighting maps**: a uniform block cannot hold a sampler, so the maps are combined image samplers with bindings of
  their own: the diffuse map at binding 0, the specular map at binding 1 and the emission map at binding 3 (binding 2
  is the uniform buffer). They share one `VkSampler`.
:::
:::d3d12
- **One constant buffer for the frame**: view, projection, `viewPos`, the material and the lights are members of
  `cbuffer SceneConstantBuffer` at register **b1**, read through the CBV in the descriptor table of root
  parameter 1 and written in `OnUpdate`. Its size is rounded up to a multiple of 256 bytes
  (`CalculateConstantBufferByteSize`).
- **HLSL packing**: a cbuffer is packed in rows of 16 bytes, and a `float3` never crosses from one row into the
  next; a struct and each array element start a new row. The C++ structs match with padding `float`s, for example
  `XMFLOAT3 position; float padding0;`.
- **Root constants for the object**: `ModelConstants` (register b0, root parameter 0) holds the model matrix and the
  normal matrix: 32 of the root signature's 64 DWORDs.
- **Normal matrix**: computed on the CPU, `XMMatrixTranspose(XMMatrixInverse(nullptr, model))`, because HLSL has no
  `inverse()` – and inverting per vertex would be expensive anyway. It is stored transposed, like every matrix.
- **The lamp**: a second pipeline state object (`m_lightCubePipelineState`) with its own shaders and the same root
  signature; `SetPipelineState` switches to it before the lamp's draw.
- **Vertex attributes**: input elements with the semantics `NORMAL` (byte offset 12) and `TEXCOORD` (byte offset 24).
- **Lighting maps**: textures cannot be members of a cbuffer, so the maps are SRVs in the descriptor heap after the
  CBV, seen as `Texture2D` at `t0` (diffuse), `t1` (specular) and `t2` (emission) through the descriptor table of root
  parameter 2, and read with the static sampler `s0`.
- **Names**: `linear` is a word of HLSL (an interpolation modifier), so the attenuation terms are called
  `constantTerm`, `linearTerm` and `quadraticTerm`; the distance is `dist`, because `distance` is an HLSL function.
:::

## The same idea in three APIs

| Idea | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Material and light values | uniform structs, set by name | uniform buffer (std140), binding 2 | constant buffer (HLSL packing), `b1` |
| Model matrix | uniform | push constant | root constants, `b0` |
| Normal matrix | in the vertex shader | in the vertex shader | on the CPU, in the root constants |
| The lamp's own shaders | second shader program | second `VkPipeline` | second PSO |
| Lighting maps | `sampler2D` in `Material`, texture units 0–2 | combined image samplers, bindings 0, 1, 3 | SRVs `t0`–`t2`, static sampler `s0` |
| Normal attribute | location 1 | location 1 | semantic `NORMAL` |

With lighting done you have the core of every 3D renderer: geometry, a camera, textures and light computed per
fragment.
