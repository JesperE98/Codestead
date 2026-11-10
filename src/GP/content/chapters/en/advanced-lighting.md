# Advanced Lighting

This chapter starts a new part of the course: *Advanced Lighting*. In the *Lighting* part we built the Phong lighting
model step by step – ambient, diffuse and specular light, materials, lighting maps, light casters and several lights at
once. This part takes that lighting further: a better specular model (this chapter), gamma correction, shadows, and
later normal and parallax mapping, HDR, bloom, deferred shading and SSAO. None of these techniques is specific to one
API: they are all maths in the shaders plus a few extra buffers and passes, and they work the same way in OpenGL,
Vulkan and DirectX 12. Each chapter shows where {{api}} puts them.

In the lighting chapters we briefly introduced the Phong lighting model to bring a basic amount of realism into our
scenes. The Phong model looks nice, but has a few nuances we'll focus on in this chapter.

:::opengl
The project is learnopengl's scene: a wooden floor – the plane `planeVertices`, 20 × 20 units at y = -0.5 with its
normal pointing up and texture coordinates up to 10, so `wood.png` repeats ten times (`GL_REPEAT`) – and one light at
`lightPos` (0, 0, 0), half a unit above the floor. The camera is at (0, 0, 3) looking down -z; WASD, the mouse and the
scroll wheel still move it. `advanced_lighting.vs` passes the position, normal and texture coordinates in an interface
block `VS_OUT` (the floor has no model matrix: its positions are world positions already), and `advanced_lighting.fs`
does the lighting: ambient `0.05 * color`, diffuse, and a specular term `vec3(0.3) * spec` for a white light.
:::
:::vulkan
The project is learnopengl's scene in the program of the earlier chapters: a wooden floor – `vertices` holds
learnopengl's `planeVertices`, 20 × 20 units at y = -0.5 with the normal pointing up and texture coordinates up to 10,
so `textures/wood.png` repeats ten times (`VK_SAMPLER_ADDRESS_MODE_REPEAT`; v is flipped, as in the earlier chapters) –
and one light at the global `lightPos` (0, 0, 0), half a unit above the floor. The camera is at (0, 0, 3) looking down
-z; WASD, the mouse and the scroll wheel still move it. `shaders/advanced_lighting.vert` passes the position, normal and
texture coordinates in an interface block `VS_OUT` (the floor has no model matrix), and `shaders/advanced_lighting.frag`
does the lighting: ambient `0.05 * color`, diffuse, and a specular term `vec3(0.3) * spec` for a white light. The
uniform buffer holds `view`, `proj`, `viewPos` and `lightPos`.
:::
:::d3d12
The project is learnopengl's scene: a wooden floor – one vertex buffer with the plane, 20 × 20 units at y = -0.5 with the
normal pointing up and texture coordinates up to 10 (v flipped), so `wood.png` repeats ten times through the static
sampler's `D3D12_TEXTURE_ADDRESS_MODE_WRAP` – and one light at the global `lightPos` (0, 0, 0), half a unit above the
floor. The camera is at (0, 0, 3) looking down -z; WASD, the mouse and the wheel still move it. `advanced_lighting.hlsl`
holds `VSMain` (position, normal and texture coordinates; the floor has no model matrix) and `PSMain` with the lighting:
ambient `0.05f * color`, diffuse, and a specular term `float3(0.3f, 0.3f, 0.3f) * spec` for a white light. The constant
buffer (b1) holds `view`, `projection`, `viewPos` and `lightPos`.
:::

The `// TODO:` comments in the project mark where your code goes. After each task, press **Build & run** (Ctrl+Enter)
to compile the program and run it in the built-in simulator. Right now it shows the lit wooden floor stretching away to
the horizon, the dark background above it, and a soft white highlight in the middle of the lower half – the reflection
of the light, computed with Phong's specular term and a shininess exponent of 8.

## Blinn-Phong

Phong lighting is a great and very efficient approximation of lighting, but its specular reflections break down in
certain conditions, specifically when the shininess property is low, resulting in a large (rough) specular area. If
you looked closely at such a highlight you'd see that its edge is suddenly cut off instead of fading out smoothly.

The reason this happens is because the angle between the view and reflection vector doesn't go over 90 degrees. If the
angle is larger than 90 degrees, the resulting dot product becomes negative and this results in a specular exponent of
0.0. You're probably thinking this won't be a problem since we shouldn't get any light with angles higher than 90
degrees anyways, right?

Wrong, this only applies to the diffuse component where an angle higher than 90 degrees between the normal and light
source means the light source is below the lighted surface and thus the light's diffuse contribution should equal 0.0.
However, with specular lighting we're not measuring the angle between the light source and the normal, but between the
view and reflection vector. Picture the light and the camera close above a flat floor, both looking at a point between
them at a grazing angle: the reflection vector points away from the viewer, more than 90 degrees from the view
direction – and so the specular term is clamped to exactly 0.0, even though the fragment is lit and a rough surface
would still show some reflected light there.

This becomes an issue when the specular exponent is low: the highlight then spreads over a large area, wide enough to
reach the places where the angle passes 90 degrees, and there it stops abruptly. With a high exponent the highlight is
already zero long before that angle, so the cut-off can't be seen. With the exponent 8 of our project the edge is soft
and hard to spot; learnopengl's comparison picture uses an exponent of 1.0 to make it obvious.

```quiz
Why does Phong's specular highlight get a hard edge on a rough (low-exponent) surface?
- [ ] Because the diffuse term becomes negative there
- [x] Where the angle between the view direction and the reflection vector passes 90°, their dot product is negative, so `max(…, 0.0)` makes the specular term exactly 0 – while a wide highlight would still be visible there
- [ ] Because `pow` cannot raise negative numbers to a power
- [ ] Because the light is below the surface at those fragments
---
The diffuse term measures the angle between the normal and the light, so a cut-off at 90° is right for it. The specular term measures the angle between the view and the reflection vector, which passes 90° on surfaces that are still lit – a low exponent makes the highlight wide enough to reach that line.
```

In 1977 the Blinn-Phong shading model was introduced by James F. Blinn as an extension to the Phong shading we've used
so far. The Blinn-Phong model is largely similar, but approaches the specular model slightly differently which as a
result overcomes our problem. Instead of relying on a reflection vector we're using a so called *halfway vector* that
is a unit vector exactly halfway between the view direction and the light direction. The closer this halfway vector
aligns with the surface's normal vector, the higher the specular contribution.

When the view direction is perfectly aligned with the (now imaginary) reflection vector, the halfway vector aligns
perfectly with the normal vector. The closer the view direction is to the original reflection direction, the stronger
the specular highlight.

Here you can see that whatever direction the viewer looks from, the angle between the halfway vector and the surface
normal never exceeds 90 degrees (unless the light is far below the surface of course). The results are slightly
different from Phong reflections, but generally more visually plausible, especially with low specular exponents. The
Blinn-Phong shading model is also the exact shading model used in the earlier fixed function pipeline of OpenGL.

Getting the halfway vector is easy: we add the light's direction vector and view vector together and normalize the
result:

```text
H = (L + V) / ||L + V||
```

This translates to {{shaderLanguage}} code as follows:

:::opengl
```glsl
vec3 lightDir   = normalize(lightPos - FragPos);
vec3 viewDir    = normalize(viewPos - FragPos);
vec3 halfwayDir = normalize(lightDir + viewDir);
```
:::
:::vulkan
```glsl
vec3 lightDir   = normalize(ubo.lightPos - fs_in.fragPos);
vec3 viewDir    = normalize(ubo.viewPos - fs_in.fragPos);
vec3 halfwayDir = normalize(lightDir + viewDir);
```
:::
:::d3d12
```hlsl
float3 lightDir   = normalize(lightPos - input.fragPos);
float3 viewDir    = normalize(viewPos - input.fragPos);
float3 halfwayDir = normalize(lightDir + viewDir);
```
:::

Then, the actual calculation of the specular term becomes a clamped dot product between the surface normal and the
halfway vector to get the cosine angle between them that we again raise to a specular shininess exponent. As the
halfway vector and the normal are both unit vectors, the dot product is the cosine of the angle between them: 1.0 when
they align, less the further they part.

```quiz
What is Blinn-Phong's halfway vector?
- [ ] The reflection of the light direction about the normal
- [ ] The vector halfway between the normal and the view direction
- [ ] The light direction minus the view direction, normalized
- [x] The normalized sum of the direction to the light and the direction to the viewer: the unit vector exactly between the two
---
`normalize(lightDir + viewDir)`. When the viewer looks along the mirror direction, the halfway vector equals the normal; the further the viewer is from that direction, the further the halfway vector tilts away from the normal.
```

## Phong or Blinn-Phong in {{api}}

The fragment shader of the project keeps both models side by side, and a flag picks one – learnopengl toggles it with
the B key to compare them. Its Phong branch is complete; the Blinn-Phong branch is the TODO. How the flag gets from the
C++ program into the shader is different in every API.

:::opengl
In OpenGL the flag is a uniform:

```glsl
uniform bool blinn;
```

GLSL has a `bool` uniform type, but no `glUniform1b`: a boolean uniform is set with `glUniform1i` (or
`glUniform1f`), where 0 means false and anything else true. The program has a global `bool blinn` and sends it every
frame with the shader class's `setInt`:

```cpp
        shader.setInt("blinn", blinn);
```
:::
:::vulkan
A small value that changes from draw to draw, and that we set from the command buffer, is what push constants are for.
learnopengl's `uniform bool blinn;` becomes a push constant block in `advanced_lighting.frag`:

```glsl
layout(push_constant) uniform PushConstants {
    bool blinn;
} pc;
```

The C++ side must have exactly the same layout. A GLSL `bool` in a block takes 4 bytes – 32 bits, like an `int` – so
the C++ struct uses `VkBool32` (a 32-bit integer holding `VK_TRUE` or `VK_FALSE`), not C++'s 1-byte `bool`:

```cpp
// The same layout as the push constant block in the fragment shader. A GLSL bool is 4 bytes: VkBool32 (VK_TRUE/VK_FALSE).
struct PushConstants {
    VkBool32 blinn;
};
```

The pipeline layout announces the range, for the fragment stage:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT; // the blinn flag
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

and `recordCommandBuffer()` pushes the value of the global `bool blinn` before the floor's draw:

```cpp
        PushConstants constants{};
        constants.blinn = blinn;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 6, 1, 0, 0);
```

The uniform buffer, read by both shaders (stage flags `VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`),
holds the positions. std140 starts every `vec3` at a multiple of 16 bytes, so the C++ struct pads each one with a float:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 viewPos;
    float pad1;
    glm::vec3 lightPos;
    float pad2;
};
```
:::
:::d3d12
In Direct3D 12 the cheapest way to hand a shader one small value is a **root constant**: 32 bits that live in the root
signature itself, set directly on the command list – no buffer, no descriptor. Root parameter 0 is one 32-bit constant
for register b0, visible to the pixel shader:

```cpp
        rootParameters[0].InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL);
```

The shader sees it as a constant buffer with one member. An HLSL `bool` in a constant buffer takes 32 bits, so it
fills the constant exactly:

```hlsl
cbuffer BlinnConstant : register(b0)
{
    bool blinn;
};
```

`PopulateCommandList` sets it every frame from the global `bool blinn` (learnopengl: `shader.setInt("blinn", blinn)`):

```cpp
    m_commandList->SetGraphicsRoot32BitConstant(0, blinn, 0);
```

The parameters are the root parameter index, the 32-bit value (the C++ `bool` becomes 0 or 1) and the offset within
the root parameter's constants. The constant buffer at b1 holds the positions; HLSL never lets a `float3` cross a
16-byte row, so the C++ struct pads each one with a float:

```cpp
    struct SceneConstantBuffer
    {
        XMFLOAT4X4 view;
        XMFLOAT4X4 projection;
        XMFLOAT3 viewPos;
        float padding0;
        XMFLOAT3 lightPos;
        float padding1;
    };
```
:::

:::opengl
```quiz
How does the OpenGL project send the `blinn` flag to the shader?
- [ ] With `glUniform1b(glGetUniformLocation(shader.ID, "blinn"), blinn)`
- [x] As a `uniform bool`, set with `shader.setInt("blinn", blinn)` – boolean uniforms are set with the integer (or float) functions, 0 meaning false
- [ ] As a vertex attribute of the floor
- [ ] Through a `#define` in the shader source
---
OpenGL has no `glUniform1b`. A `bool` uniform is set with `glUniform1i` (what `setInt` calls) or `glUniform1f`; 0 is false, any other value true.
```
:::
:::vulkan
```quiz
Why is the C++ side of the push constant `VkBool32 blinn` and not `bool blinn`?
- [ ] Push constants can only hold integers
- [ ] `bool` cannot be converted to a push constant by `vkCmdPushConstants`
- [x] A GLSL `bool` in a block takes 4 bytes; C++'s `bool` usually takes 1, so the layouts would not match – `VkBool32` is a 32-bit integer
- [ ] `VkBool32` makes the shader branch faster
---
The bytes pushed with `vkCmdPushConstants` must have the layout the shader declares. GLSL stores a `bool` in a block as 32 bits, so the C++ struct uses the 32-bit `VkBool32` (`VK_TRUE` / `VK_FALSE`).
```
:::
:::d3d12
```quiz
What is root parameter 0, `InitAsConstants(1, 0, 0, D3D12_SHADER_VISIBILITY_PIXEL)`?
- [ ] A descriptor table with one constant buffer view
- [x] One 32-bit value stored in the root signature itself, which the pixel shader reads as `cbuffer BlinnConstant : register(b0)`, set with `SetGraphicsRoot32BitConstant`
- [ ] A static sampler at s0
- [ ] A constant buffer of 256 bytes in an upload heap
---
Root constants need no buffer and no descriptor: their values are recorded into the command list. An HLSL `bool` in a constant buffer takes 32 bits, exactly one root constant.
```
:::

## Implementing Blinn-Phong

:::opengl
Now do the first task, **halfway**. In `advanced_lighting.fs`, the `if (blinn)` branch computes the halfway vector and
the specular term with it (keep the exponent at 8.0 for now, to compare with Phong):

```glsl
    // specular
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    float spec = 0.0;
    if (blinn)
    {
        vec3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);
    }
    else
    {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);
    }
```

and in `main.cpp` switch the program to it:

```cpp
bool blinn = true; // Phong (false) or Blinn-Phong (true) specular lighting
```
:::
:::vulkan
Now do the first task, **halfway**. In `shaders/advanced_lighting.frag`, the `if (pc.blinn)` branch computes the
halfway vector and the specular term with it (keep the exponent at 8.0 for now, to compare with Phong):

```glsl
    // specular
    vec3 viewDir = normalize(ubo.viewPos - fs_in.fragPos);
    float spec = 0.0;
    if (pc.blinn) {
        vec3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0), 8.0);
    } else {
        vec3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0), 8.0);
    }
```

and in `main.cpp` switch the program to it – the push constant then carries `VK_TRUE`:

```cpp
bool blinn = true; // Phong (false) or Blinn-Phong (true) specular lighting
```
:::
:::d3d12
Now do the first task, **halfway**. In `PSMain` of `advanced_lighting.hlsl`, the `if (blinn)` branch computes the
halfway vector and the specular term with it (keep the exponent at 8.0 for now, to compare with Phong):

```hlsl
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float spec = 0.0f;
    if (blinn)
    {
        float3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0f), 8.0f);
    }
    else
    {
        float3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0f), 8.0f);
    }
```

and in `main.cpp` switch the program to it – `SetGraphicsRoot32BitConstant(0, blinn, 0)` then sends 1:

```cpp
bool blinn = true;
```
:::

There's nothing more to it than calculating a halfway vector and changing the specular component's cosine term. Press
**Build & run**: the highlight becomes **wider** and reaches further back towards the horizon, brighter in its middle
and dimmer at the near sides – the light now spreads over the floor and fades out smoothly instead of being clamped.

Another subtle difference between Phong and Blinn-Phong shading is that the angle between the halfway vector and the
surface normal is often shorter than the angle between the view and reflection vector. As a result, to get visuals
similar to Phong shading the specular shininess exponent has to be set a bit higher. A general rule of thumb is to set
it between 2 and 4 times the Phong shininess exponent.

```quiz
Why does Blinn-Phong need a 2–4 times higher shininess exponent than Phong for a highlight of about the same size?
- [x] The angle between the normal and the halfway vector is usually smaller than the angle between the view and the reflection vector, so its cosine is closer to 1 and a low exponent leaves a wider highlight
- [ ] Because the halfway vector is not normalized
- [ ] Because Blinn-Phong has no ambient term
- [ ] Because `pow` is computed with less precision in the fragment shader
---
For a flat surface the angle between N and H is about half the angle between R and V. The same exponent therefore gives a wider, brighter highlight; raising it (learnopengl: 8 for Phong, 32 for Blinn-Phong) brings the size back.
```

:::opengl
Now do the task **shininess**. Give Blinn-Phong learnopengl's exponent, four times Phong's:

```glsl
        spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0); // 2-4 times Phong's exponent: about the same highlight size
```
:::
:::vulkan
Now do the task **shininess**. Give Blinn-Phong learnopengl's exponent, four times Phong's:

```glsl
        spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0); // 2-4 times Phong's exponent: about the same highlight size
```
:::
:::d3d12
Now do the task **shininess**. Give Blinn-Phong learnopengl's exponent, four times Phong's:

```hlsl
        spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);    // 2-4 times Phong's exponent: about the same highlight size
```
:::

Press **Build & run**: the highlight shrinks again to about the size of the start's Phong highlight, but it is centred a
little further back and fades out evenly in every direction. That's learnopengl's comparison – Phong with an exponent
of 8.0, Blinn-Phong with 32.0. If you want to see both again, set `blinn` back to false: the Phong branch is still in
the shader.

```quiz
Phong and Blinn-Phong are both used with a light and a viewer above a flat floor. When can the angle between the normal and the halfway vector exceed 90°?
- [ ] Whenever the viewer looks at the floor at a grazing angle
- [ ] Whenever the exponent is lower than 8
- [ ] Never, not even when the light is below the floor
- [x] Only when the light (or the viewer) is below the surface – for a surface both see, the halfway vector stays within 90° of the normal, so there is no cut-off
---
With L and V both on the normal's side, their sum also points to that side, so dot(N, H) is never negative. That's why Blinn-Phong fades out smoothly where Phong is clamped.
```

The difference may look small on a wooden floor, but Blinn-Phong is the more plausible model, especially for rough
surfaces with low exponents, and it's what the rest of this part uses – the next chapter's four lights are already
Blinn-Phong lights.

## Additional resources

:::opengl
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengl's chapter this chapter
  follows, with the pictures comparing Phong and Blinn-Phong.
- [advanced_lighting.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/5.advanced_lighting/1.advanced_lighting/advanced_lighting.cpp):
  learnopengl's program, including the B key that toggles the model.
- [glUniform](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniform.xhtml): the reference page, with how
  boolean uniforms are set.
:::
:::vulkan
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengl's chapter this chapter
  follows, with the pictures comparing Phong and Blinn-Phong.
- [Resource descriptors](https://docs.vulkan.org/spec/latest/chapters/descriptorsets.html): the chapter of the Vulkan
  specification on pipeline layouts, including push constant ranges and their updates.
- [vkCmdPushConstants](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdPushConstants.html): the reference
  page.
:::
:::d3d12
- [Advanced Lighting](https://learnopengl.com/Advanced-Lighting/Advanced-Lighting): learnopengl's chapter this chapter
  follows, with the pictures comparing Phong and Blinn-Phong.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  root constants and `SetGraphicsRoot32BitConstants`.
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  how HLSL lays out a constant buffer (why each `float3` gets a float of padding here).
:::
