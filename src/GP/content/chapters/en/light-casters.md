# Light casters

All the lighting we've used so far came from a single source that is a single point in space. It gives good results,
but in the real world we have several types of light that each act differently. A light source that *casts* light
upon objects is called a **light caster**. In this chapter we'll discuss several different types of light casters.
Learning to simulate different light sources is yet another tool in your toolbox to further enrich your
environments.

We'll first discuss a directional light, then a point light which is an extension of what we had before, and lastly
we'll discuss spotlights. In the next chapter we'll combine several of these different light types into one scene.

:::opengl
This chapter's project starts from the result of *Lighting maps* (without the emission exercise): the same
`main.cpp` and `shader_m.h`, the container's diffuse map `container2.png` and specular map
`container2_specular.png`, and the lamp's shaders `light_cube.vs` / `light_cube.fs`. The shaders of the lit
objects are now called `light_casters.vs` and `light_casters.fs`; the fragment shader has the `Material` struct
(two samplers and a shininess) and a `Light` struct with a `position` and the three colour strengths.

Two things are new. The scene has learnopengl's **ten containers** again – the `cubePositions` of *Coordinate
Systems* and a `for` loop that draws each one with its own model matrix (rotated by 20° · i, nothing turns over time).
And the camera is **back at (0, 0, 3)** looking down -z (`cameraPos`, `cameraFront`, `yaw = -90.0f`,
`pitch = 0.0f`), so all ten containers are in view and container 0 fills the centre of the window. The light is
still the point light of *Lighting maps* at `lightPos` (1.2, 1.0, 2.0), with ambient 0.2, diffuse 0.5, specular 1.0
and shininess 64.
:::
:::vulkan
This chapter's project starts from the result of *Lighting maps* (without the emission exercise): the diffuse map at
binding 0, the specular map at binding 1 and the uniform buffer at binding 2. The shaders of the lit objects are now
called `shaders/light_casters.vert` and `shaders/light_casters.frag`; the lamp keeps `shaders/light_cube.*` and its
own pipeline, `lightCubePipeline`. The uniform block holds the matrices, `viewPos`, a `Material` (the shininess) and a
`Light` with a `position` and the three colour strengths, mirrored by C++ structs with padding floats.

Two things are new. The scene has learnopengl's **ten containers** again: a global `cubePositions` and a loop in
`recordCommandBuffer()` that pushes each container's model matrix (rotated by 20° · i, nothing turns over time) and
draws it. And the camera is **back at (0, 0, 3)** looking down -z (`cameraPos`, `cameraFront`, `yaw = -90`,
`pitch = 0`), so all ten containers are in view and container 0 fills the centre of the window. The light is still
the point light of *Lighting maps* at `lightPos` (1.2, 1.0, 2.0), set in `updateUniformBuffer()` with ambient 0.2,
diffuse 0.5, specular 1.0 and shininess 64.
:::
:::d3d12
This chapter's project starts from the result of *Lighting maps* (without the emission exercise): the diffuse map
(`t0`) and specular map (`t1`), the constant buffer `SceneConstantBuffer` (`b1`) and the root constants with the model
and normal matrices (`b0`). The shaders of the lit objects are now in `light_casters.hlsl`; the lamp keeps
`light_cube.hlsl` and its own pipeline state, `m_lightCubePipelineState`. The constant buffer holds the matrices,
`viewPos`, a `Material` (the shininess) and a `Light` with a `position` and the three colour strengths, mirrored by
C++ structs with padding floats.

Two things are new. The scene has learnopengl's **ten containers** again: `PopulateCommandList` has the
`cubePositions` array and a `for` loop that sets each container's model matrix (rotated by 20° · i, nothing turns
over time) and normal matrix as root constants and draws it. And the camera is **back at (0, 0, 3)** looking down -z
(`cameraPos`, `cameraFront`, `yaw = -90.0f`, `pitch = 0.0f`), so all ten containers are in view and container 0 fills
the centre of the window. The light is still the point light of *Lighting maps* at `lightPos` (1.2, 1.0, 2.0), set in
`OnUpdate` with ambient 0.2, diffuse 0.5, specular 1.0 and shininess 64.
:::

> The earlier lighting chapters placed the camera off to the side so you could see the lit cube *and* the lamp. In
> this chapter and the next we use learnopengl's camera instead. The price is that the lamp at (1.2, 1.0, 2.0) is
> now **outside the window**: it is just one unit in front of the camera but off to the right (and a little up),
> beyond the edge of the view. Even in the steps where the lamp is drawn, you won't see it. You can still fly around
> with the keyboard and mouse on your own computer to find it.

The project has no `// TODO:` comments this time: every task changes code that is already there, and the task text
tells you where. After each task, press **Build & run** (Ctrl+Enter) to compile the program and run it in the
built-in simulator. Build it once now: all ten containers are lit by the lamp, the far ones just as brightly as the
near ones.

## Directional Light

When a light source is far away the light rays coming from the light source are close to parallel to each other. It
looks like all the light rays are coming from the same direction, regardless of where the object and/or the viewer
is. When a light source is modeled to be *infinitely* far away it is called a **directional light** since all its
light rays have the same direction; it is independent of the location of the light source.

A fine example of a directional light source is the sun as we know it. The sun is not infinitely far away from us,
but it is so far away that we can perceive it as being infinitely far away in the lighting calculations. All the light
rays from the sun are then modeled as parallel light rays, as if a set of parallel arrows all point the same way onto
the objects.

Because all the light rays are parallel it does not matter how each object relates to the light source's position
since the light direction remains the same for each object in the scene. Because the light's direction vector stays
the same, the lighting calculations will be similar for each object in the scene.

We can model such a directional light by defining a light direction vector instead of a position vector. The shader
calculations remain mostly the same except this time we directly use the light's `direction` vector instead of
calculating the `lightDir` vector using the light's `position` vector:

:::opengl
```glsl
struct Light {
    // vec3 position; // no longer needed when using directional lights
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
void main()
{
    vec3 lightDir = normalize(-light.direction);
    [...]
}
```
:::
:::vulkan
```glsl
struct Light {
    // vec3 position; // no longer needed when using directional lights
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
void main() {
    [...]
    vec3 lightDir = normalize(-ubo.light.direction);
    [...]
}
```
:::
:::d3d12
```hlsl
// A directional light: the direction its rays go and how strong its ambient, diffuse
// and specular parts are.
struct Light
{
    // float3 position; // no longer necessary when using directional lights.
    float3 direction;
    float3 ambient;
    float3 diffuse;
    float3 specular;
};
[...]
    float3 lightDir = normalize(-light.direction);
```
:::

Note that we first negate the `light.direction` vector. The lighting calculations we used so far expect the light
direction to be a direction from the fragment *towards* the light source, but people generally prefer to specify a
directional light as a global direction pointing *from* the light source. Therefore we have to negate the global light
direction vector to switch its direction; it's now a direction vector pointing towards the light source. Also, be sure
to normalize the vector since it is unwise to assume the input vector to be a unit vector.

The resulting `lightDir` vector is then used as before in the diffuse and specular computations.

To clearly demonstrate that a directional light has the same effect on multiple objects, the project draws the
container party scene from the end of *Coordinate Systems*: we defined 10 different container positions and gave each
container a different model matrix where each model matrix contains the appropriate local-to-world transformations:

:::opengl
```cpp
        for (unsigned int i = 0; i < 10; i++)
        {
            // calculate the model matrix for each object and pass it to shader before drawing
            model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            lightingShader.setMat4("model", model);

            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
```cpp
        for (unsigned int i = 0; i < 10; i++) {
            // calculate the model matrix for each object and push it before drawing
            model = glm::mat4(1.0f);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```
:::
:::d3d12
```cpp
    for (UINT i = 0; i < 10; i++)
    {
        float angle = 20.0f * i;
        XMMATRIX model = XMMatrixRotationAxis(XMVectorSet(1.0f, 0.3f, 0.5f, 0.0f), XMConvertToRadians(angle))
            * XMMatrixTranslation(cubePositions[i].x, cubePositions[i].y, cubePositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));

        // The normal matrix: the transpose of the inverse of the model matrix.
        XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
        XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```
:::

Also don't forget to actually specify the direction of the light source (note that we define the direction as a
direction *from* the light source; you can quickly see the light's direction is pointing downwards):

:::opengl
```cpp
        lightingShader.setVec3("light.direction", -0.2f, -1.0f, -0.3f);
```

The uniform `light.position` no longer exists in the shader, so this line takes the place of
`lightingShader.setVec3("light.position", lightPos);`.
:::
:::vulkan
```cpp
        ubo.light.direction = glm::vec3(-0.2f, -1.0f, -0.3f);
```

In Vulkan the uniform buffer is plain memory that the shader reads at fixed offsets, so the C++ `Light` struct must
change along with the shader's. In a uniform block (std140 layout) a `vec3` starts at a multiple of 16 bytes, like a
`vec4`: that is why the C++ struct has a padding float after every `glm::vec3`. The direction simply takes the place of
the position – same type, same offset (0), and `pad1` stays:

```cpp
struct Light {
    glm::vec3 direction;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};
```

That's 64 bytes: four 16-byte slots, the direction and the three colours.
:::
:::d3d12
```cpp
    constantBufferData.light.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);
```

The constant buffer is plain memory that the shader reads at fixed offsets, so the C++ `Light` struct must change
along with the HLSL one. HLSL packs a cbuffer in rows of 16 bytes and never lets a `float3` cross from one row into the
next, so two `float3`s in a row each start a new row: the C++ struct needs a padding float after each `XMFLOAT3`. The
direction simply takes the place of the position – same type, same offset (0), and `padding0` stays:

```cpp
    struct Light
    {
        // XMFLOAT3 position; // no longer necessary when using directional lights.
        XMFLOAT3 direction;
        float padding0;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```
:::

learnopengl also lowers the shininess to 32 for the light casters, and since a directional light has no position, a
lamp cube somewhere in the scene makes no sense: we comment out the lamp's drawing.

> We've been passing the light's position and direction vectors as `vec3`s for a while now, but some people tend to
> prefer to keep all the vectors defined as `vec4`. When defining position vectors as a `vec4` it is important to set
> the `w` component to `1.0` so translation and projections are properly applied. However, when defining a direction
> vector as a `vec4` we don't want translations to have an effect (since they just represent directions, nothing
> more) so then we define the `w` component to be `0.0`.
>
> Direction vectors can then be represented as `vec4(-0.2f, -1.0f, -0.3f, 0.0f)`. This can also function as an easy
> check for light types: you could check if the `w` component is equal to `1.0` to see that we now have a light's
> position vector and if `w` is equal to `0.0` we have a light's direction vector; so adjust the calculations based on
> that:
>
> ```glsl
> if (lightVector.w == 0.0) // note: be careful for floating point errors
>     // do directional light calculations
> else if (lightVector.w == 1.0)
>     // do light calculations using the light's position (as in previous chapters)
> ```
>
> Fun fact: this is actually how the old OpenGL (fixed-functionality) determined if a light source was a directional
> light or a positional light source and adjusted its lighting based on that.

Now do the first task, **directional**. When you build and run it, all containers are lit from the same direction –
from above, slightly from the front left. The front faces that look at the camera get only a little light (the light
hits them at a grazing angle), while faces that are turned upwards, like those of the container at the top left, are
clearly brighter. And a far container is lit exactly as strongly as a near one: a directional light has no distance.

```quiz
The light's direction is (-0.2, -1.0, -0.3), but the shader computes `lightDir` from `-light.direction`. Why the minus?
- [ ] Because the normal vectors of the containers point inwards
- [x] Because the diffuse and specular calculations expect a vector from the fragment towards the light, while the light's direction points from the light into the scene
- [ ] Because the light shines upwards and must be flipped to shine downwards
---
`dot(norm, lightDir)` is largest when the normal points *at* the light. The direction we specify points away from the light (downwards, like sunlight), so the shader reverses it once and normalizes it.
```

## Point lights

Directional lights are great for global lights that illuminate the entire scene, but we usually also want several
**point lights** scattered throughout the scene. A point light is a light source with a given position somewhere in a
world that illuminates in all directions, where the light rays fade out over distance. Think of light bulbs and
torches as light casters that act as a point light.

In the earlier chapters we've been working with a simplistic point light. We had a light source at a given position
that scatters light in all directions from that given light position. However, the light source we defined simulated
light rays that never fade out thus making it look like the light source is extremely strong. In most 3D applications
we'd like to simulate a light source that only illuminates an area close to the light source and not the entire
scene.

If you'd add the 10 containers to the lighting scene from the previous chapters, you'd notice that the container all
the way in the back is lit with the same intensity as the container in front of the light; there is no logic yet
that diminishes light over distance. We want the container in the back to only be slightly lit in comparison to the
containers close to the light source. You saw exactly that in the start picture of this project.

## Attenuation

To reduce the intensity of light over the distance a light ray travels is generally called **attenuation**. One way to
reduce the light intensity over distance is to simply use a linear equation. Such an equation would linearly reduce
the light intensity over the distance thus making sure that objects at a distance are less bright. However, such a
linear function tends to look a bit fake. In the real world, lights are generally quite bright standing close by, but
the brightness of a light source diminishes quickly at the start and the remaining light intensity more slowly
diminishes over distance. We are thus in need of a different equation for reducing the light's intensity.

Luckily some smart people already figured this out for us. The following formula calculates an attenuation value
based on a fragment's distance to the light source which we later multiply with the light's intensity vector:

```text
                         1.0
F_att = ---------------------------------
          K_c  +  K_l * d  +  K_q * d²
```

Here `d` represents the distance from the fragment to the light source. Then to calculate the attenuation value we
define 3 (configurable) terms: a **constant** term `K_c`, a **linear** term `K_l` and a **quadratic** term `K_q`.

- The constant term is usually kept at `1.0` which is mainly there to make sure the denominator never gets smaller
  than 1 since it would otherwise boost the intensity with certain distances, which is not the effect we're looking
  for.
- The linear term is multiplied with the distance value that reduces the intensity in a linear fashion.
- The quadratic term is multiplied with the quadrant of the distance and sets a quadratic decrease of intensity for
  the light source. The quadratic term will be less significant compared to the linear term when the distance is
  small, but gets much larger as the distance grows.

Due to the quadratic term the light will diminish mostly at a linear fashion until the distance becomes large enough
for the quadratic term to surpass the linear term and then the light intensity will decrease a lot faster. The
resulting effect is that the light is quite intense when at a close range, but quickly loses its brightness over
distance until it eventually loses its brightness at a more slower pace. With the values we'll use below (constant
1.0, linear 0.09, quadratic 0.032) the attenuation is:

| Distance `d` | 0 | 1 | 5 | 10 | 20 | 50 |
|---|---|---|---|---|---|---|
| `F_att` | 1.0 | 0.89 | 0.44 | 0.20 | 0.06 | 0.01 |

You can see that the light has the highest intensity when the distance is small, but as soon as the distance grows its
intensity is significantly reduced and slowly reaches 0 intensity at around a distance of 50 or more. This is exactly
what we want.

### Choosing the right values

But at what values do we set those 3 terms? Setting the right values depends on many factors: the environment, the
distance you want a light to cover, the type of light etc. In most cases, it simply is a question of experience and a
moderate amount of tweaking. The following table shows some of the values these terms could take to simulate a
realistic (sort of) light source that covers a specific radius (distance). The first column specifies the distance a
light will cover with the given terms. These values are good starting points for most lights, courtesy of Ogre3D's
wiki:

| Distance | Constant | Linear | Quadratic |
|---|---|---|---|
| 7 | 1.0 | 0.7 | 1.8 |
| 13 | 1.0 | 0.35 | 0.44 |
| 20 | 1.0 | 0.22 | 0.20 |
| 32 | 1.0 | 0.14 | 0.07 |
| 50 | 1.0 | 0.09 | 0.032 |
| 65 | 1.0 | 0.07 | 0.017 |
| 100 | 1.0 | 0.045 | 0.0075 |
| 160 | 1.0 | 0.027 | 0.0028 |
| 200 | 1.0 | 0.022 | 0.0019 |
| 325 | 1.0 | 0.014 | 0.0007 |
| 600 | 1.0 | 0.007 | 0.0002 |
| 3250 | 1.0 | 0.0014 | 0.000007 |

As you can see, the constant term `K_c` is kept at `1.0` in all cases. The linear term `K_l` is usually quite small to
cover larger distances and the quadratic term `K_q` is even smaller. Try to experiment a bit with these values to see
their effect in your implementation. In our environment a distance of 32 to 100 is generally enough for most lights.

```quiz
With constant 1.0, linear 0.09 and quadratic 0.032, roughly how much of the light's strength reaches a fragment 10 units away from the light?
- [ ] About 90% – the quadratic term only matters beyond 50 units
- [x] About 20% – 1.0 / (1.0 + 0.9 + 3.2) ≈ 0.2
- [ ] About 50% – the linear term halves it every 10 units
---
At d = 10 the denominator is 1.0 + 0.09 · 10 + 0.032 · 100 = 5.1, so F_att ≈ 0.196. At this distance the quadratic term (3.2) already dominates the linear one (0.9).
```

### Implementing attenuation

To implement attenuation we'll be needing 3 extra values in the fragment shader: namely the constant, linear and
quadratic terms of the equation. These are best stored in the `Light` struct we defined earlier. Note that we need to
calculate `lightDir` again using `position` as this is a point light (as we did in the previous chapters) and not a
directional light.

:::opengl
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};
```

Then we set the terms in our application: we want the light to cover a distance of 50 so we'll use the appropriate
constant, linear and quadratic terms from the table:

```cpp
        lightingShader.setFloat("light.constant", 1.0f);
        lightingShader.setFloat("light.linear", 0.09f);
        lightingShader.setFloat("light.quadratic", 0.032f);
```

Each member of a uniform struct is a uniform of its own, with its own location and its own name: `light.constant`,
`light.linear` and so on. The `setFloat` and `setVec3` helpers of `shader_m.h` look up that name with
`glGetUniformLocation` and set the value with `glUniform1f` / `glUniform3fv`. The position goes back in with
`lightingShader.setVec3("light.position", lightPos);`.
:::
:::vulkan
```glsl
struct Light {
    vec3 position;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;

    float constant;
    float linear;
    float quadratic;
};
```

In C++ the struct has to give every member the same offset as std140 does. The rules we need: a `vec3` starts at a
multiple of 16 bytes, a `float` only needs a multiple of 4 – so a float can fill the 4 bytes right after a `vec3` – and
the size of a struct in a uniform block is rounded up to a multiple of 16. In the shader `specular` sits at offset 48,
so `constant` fills its last 4 bytes (60), `linear` and `quadratic` follow at 64 and 68, and the struct ends at 72,
rounded up to 80:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;

    float constant; // fills the 4 bytes after specular
    float linear;
    float quadratic;
    float pad4; // the size of a struct in a uniform block is rounded up to a multiple of 16 bytes
    float pad5;
};
```

Then we set the terms in `updateUniformBuffer()`: we want the light to cover a distance of 50 so we'll use the
appropriate constant, linear and quadratic terms from the table:

```cpp
        ubo.light.constant  = 1.0f;
        ubo.light.linear    = 0.09f;
        ubo.light.quadratic = 0.032f;
```

The position goes back in with `ubo.light.position = lightPos;`.
:::
:::d3d12
There is one snag in HLSL: `linear` is a keyword of the language (an interpolation modifier, like `nointerpolation`),
so it cannot be the name of a struct member. The project therefore calls the three terms `constantTerm`, `linearTerm`
and `quadraticTerm`. It also puts them right after `position`, where they fill the rest of the position's row:

```hlsl
// A point light: its position, how its light fades with the distance (attenuation), and
// how strong its ambient, diffuse and specular parts are. (linear is a word of HLSL:
// the three terms are called constantTerm, linearTerm and quadraticTerm.)
struct Light
{
    float3 position;
    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

Work out the packing row by row: `position` takes bytes 0–11 and `constantTerm` fills 12–15 of the first row;
`linearTerm` and `quadraticTerm` take 16–23 of the second row. `ambient` needs 12 bytes but only 8 are left in that
row, and a `float3` may not cross a row boundary, so HLSL starts it at 32. `diffuse` and `specular` follow at 48 and
64. The C++ struct copies that layout:

```cpp
    struct Light
    {
        XMFLOAT3 position;
        float constantTerm;    // fills the row of position
        float linearTerm;
        float quadraticTerm;
        float padding0[2];     // ambient would cross into the next row: HLSL starts it there
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```

Then we set the terms in `OnUpdate`: we want the light to cover a distance of 50 so we'll use the appropriate
constant, linear and quadratic terms from the table:

```cpp
    constantBufferData.light.constantTerm = 1.0f;
    constantBufferData.light.linearTerm = 0.09f;
    constantBufferData.light.quadraticTerm = 0.032f;
```

The position goes back in with `constantBufferData.light.position = lightPos;`.
:::

Implementing attenuation in the fragment shader is relatively straightforward: we simply calculate an attenuation
value based on the equation and multiply this with the ambient, diffuse and specular components.

We do need the distance to the light source for the equation to work though. Remember how we can calculate the length
of a vector? We can retrieve the distance term by calculating the difference vector between the fragment and the
light source and take that resulting vector's length. We can use {{shaderLanguage}}'s built-in `length` function for
that purpose:

:::opengl
```glsl
    // attenuation
    float distance    = length(light.position - FragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
```

Then we include this attenuation value in the lighting calculations by multiplying the attenuation value with the
ambient, diffuse and specular colors:

```glsl
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
```
:::
:::vulkan
```glsl
    // attenuation
    float distance    = length(ubo.light.position - fragPos);
    float attenuation = 1.0 / (ubo.light.constant + ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));
```

Then we include this attenuation value in the lighting calculations by multiplying the attenuation value with the
ambient, diffuse and specular colors:

```glsl
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
```
:::
:::d3d12
`distance` is also the name of an HLSL intrinsic function (the distance between two points), so the local variable is
called `dist`:

```hlsl
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - input.fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
```

Then we include this attenuation value in the lighting calculations by multiplying the attenuation value with the
ambient, diffuse and specular colors:

```hlsl
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    float3 result = ambient + diffuse + specular;
```
:::

> Note that we could leave the ambient component alone so ambient lighting is not decreased over distance, but if we
> were to use more than 1 light source all the ambient components will start to stack up. In that case we want to
> attenuate ambient lighting as well. Simply play around with what's best for your environment.

Now do the task **point-light**: the position comes back in place of the direction, the struct gets the three terms,
the shader the attenuation, and the lamp is drawn again (with this camera you won't see it, as we said). When you
build and run it, the containers near the light are lit as before – a little darker, since even container 0, about
2 units from the light, gets an attenuation of about 0.75 – while the containers further back fade out. The far container at the top of
the window, about 17 units from the light, is almost black.

:::opengl
```quiz
The fragment shader has a uniform struct `Light light;` with a member `float linear;`. How does `main.cpp` give it a value?
- [x] `lightingShader.setFloat("light.linear", 0.09f);` – every struct member is a uniform of its own, found by its full name
- [ ] One `glUniform` call that copies a C++ `Light` struct into the shader's struct
- [ ] `lightingShader.setFloat("linear", 0.09f);` – the struct name is optional
---
OpenGL has no single uniform for a struct: each member gets its own location, and `glGetUniformLocation` finds it by the name `light.linear`. A C++ struct is never copied – you set member by member.
```
:::
:::vulkan
```quiz
The point light's C++ `Light` struct ends with `float quadratic; float pad4; float pad5;`. Why the two padding floats at the end?
- [x] In std140 the size of a struct is rounded up to a multiple of 16 bytes: the members end at 72, so the struct takes 80 bytes
- [ ] glm requires every struct to end with two padding floats
- [ ] Without them `quadratic` would start at a wrong offset
---
Nothing follows the light in the uniform block, so here the two floats change no offset – but they make `sizeof(Light)` equal the shader's 80 bytes, which matters as soon as something follows the struct or the struct is an array element (as in the next chapter).
```
:::
:::d3d12
```quiz
In the HLSL point light, `position` (a `float3`) is followed by `constantTerm`, `linearTerm` and `quadraticTerm`. At which byte offset does `ambient` start?
- [x] 32 – a `float3` may not cross a 16-byte row, and only 8 bytes are left in the row that starts at 16
- [ ] 28 – HLSL aligns a `float3` to 4 bytes
- [ ] 24 – right after `quadraticTerm`
---
Rows are 16 bytes. `position` + `constantTerm` fill row 0 (0–15), `linearTerm` and `quadraticTerm` take 16–23, and the 12-byte `ambient` would reach into the next row, so it starts at 32. That's why the C++ struct has `float padding0[2];` before `ambient`.
```
:::

## Spotlight

The last type of light we're going to discuss is a **spotlight**. A spotlight is a light source that is located
somewhere in the environment that, instead of shooting light rays in all directions, only shoots them in a specific
direction. The result is that only the objects within a certain radius of the spotlight's direction are lit and
everything else stays dark. A good example of a spotlight would be a street lamp or a flashlight.

A spotlight is represented by a world-space position, a direction and
a **cutoff** angle that specifies the radius of the spotlight. For each fragment we calculate if the fragment is
between the spotlight's cutoff directions (thus in its cone) and if so, we lit the fragment accordingly. Picture a
cone with its tip at the light:

- `LightDir`: the vector pointing from the fragment to the light source.
- `SpotDir`: the direction the spotlight is aiming at.
- `Phi` ϕ: the cutoff angle that specifies the spotlight's radius. Everything outside this angle is not lit by the
  spotlight.
- `Theta` θ: the angle between the `LightDir` vector and the `SpotDir` vector. The θ value should be smaller than ϕ
  to be inside the spotlight.

So what we basically need to do, is calculate the dot product (returns the cosine of the angle between two unit
vectors) between the `LightDir` vector and the `SpotDir` vector and compare this with the cutoff angle ϕ. Now that you
(sort of) understand what a spotlight is all about we're going to create one in the form of a flashlight.

## Flashlight

A flashlight is a spotlight located at the viewer's position and usually aimed straight ahead from the player's
perspective. A flashlight is basically a normal spotlight, but with its position and direction continually updated
based on the player's position and orientation.

So, the values we're going to need for the fragment shader are the spotlight's position vector (to calculate the
fragment-to-light's direction vector), the spotlight's direction vector and the cutoff angle. We can store these
values in the `Light` struct:

:::opengl
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    [...]
};
```

Next we pass the appropriate values to the shader:

```cpp
        lightingShader.setVec3("light.position", cameraPos);
        lightingShader.setVec3("light.direction", cameraFront);
        lightingShader.setFloat("light.cutOff", glm::cos(glm::radians(12.5f)));
```
:::
:::vulkan
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    [...]
};
```

In C++, `direction` is a `vec3` and starts at offset 16; `cutOff` is a float and fills the 4 bytes right after it
(offset 28). Everything after it moves down by 16 bytes, and the struct grows to 96 bytes:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction

    glm::vec3 ambient;
    [...]
};
```

Next we pass the appropriate values to the shader in `updateUniformBuffer()`:

```cpp
        ubo.light.position = cameraPos;
        ubo.light.direction = cameraFront;
        ubo.light.cutOff = glm::cos(glm::radians(12.5f));
```
:::
:::d3d12
```hlsl
struct Light
{
    float3 position;
    float3 direction;
    float cutOff;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

`position` takes row 0; `direction` can't share it (a `float3` can't cross a row), so it starts row 1 at offset 16,
and `cutOff` fills the rest of that row (28). The three terms take row 2 (32–43), and since a `float3` doesn't fit in
the remaining 4 bytes, `ambient` starts row 3 at 48. In C++:

```cpp
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 direction;
        float cutOff;          // fills the row of direction
        float constantTerm;
        float linearTerm;
        float quadraticTerm;
        float padding1;
        XMFLOAT3 ambient;
        float padding2;
        XMFLOAT3 diffuse;
        float padding3;
        XMFLOAT3 specular;
        float padding4;
    };
```

Next we pass the appropriate values to the shader in `OnUpdate`. The camera's vectors are `XMVECTOR`s, so we store
them into the `XMFLOAT3` members with `XMStoreFloat3`:

```cpp
    // The spotlight is a flashlight: at the camera, pointing where the camera looks.
    XMStoreFloat3(&constantBufferData.light.position, cameraPos);
    XMStoreFloat3(&constantBufferData.light.direction, cameraFront);
    constantBufferData.light.cutOff = std::cos(XMConvertToRadians(12.5f));
```
:::

As you can see we're not setting an angle for the cutoff value but calculate the cosine value based on an angle and
pass the cosine result to the fragment shader. The reason for this is that in the fragment shader we're calculating
the dot product between the `LightDir` and the `SpotDir` vector and the dot product returns a cosine value and not an
angle; and we can't directly compare an angle with a cosine value. To get the angle in the shader we then have to
calculate the inverse cosine of the dot product's result which is an expensive operation. So to save some performance
we calculate the cosine value of a given cutoff angle beforehand and pass this result to the fragment shader. Since
both angles are now represented as cosines, we can directly compare between them without expensive operations.

Now what's left to do is calculate the theta θ value and compare this with the cutoff ϕ value to determine if we're
in or outside the spotlight:

:::opengl
```glsl
    vec3 lightDir = normalize(light.position - FragPos);

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-light.direction));

    if (theta > light.cutOff) // remember that we're working with angles as cosines instead of degrees so a '>' is used.
    {
        // do lighting calculations
    }
    else
    {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        FragColor = vec4(light.ambient * texture(material.diffuse, TexCoords).rgb, 1.0);
    }
```
:::
:::vulkan
```glsl
    vec3 lightDir = normalize(ubo.light.position - fragPos);

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-ubo.light.direction));

    if (theta > ubo.light.cutOff) { // remember that we're working with angles as cosines instead of degrees so a '>' is used.
        // do lighting calculations
    } else {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        outColor = vec4(ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb, 1.0);
    }
```
:::
:::d3d12
```hlsl
    float3 lightDir = normalize(light.position - input.fragPos);

    // The material's colours here. Sampled before the if: Sample() picks the texture's
    // level of detail from the neighbouring pixels, which may take the other branch.
    float3 diffuseColor = diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
    float3 specularColor = specularMap.Sample(wrapSampler, input.texCoord).rgb;

    // check if lighting is inside the spotlight cone
    float theta = dot(lightDir, normalize(-light.direction));

    if (theta > light.cutOff) // remember that we're working with angles as cosines instead of degrees so a '>' is used.
    {
        // do lighting calculations
    }
    else
    {
        // else, use ambient light so scene isn't completely dark outside the spotlight.
        return float4(light.ambient * diffuseColor, 1.0f);
    }
```

Note where the two textures are sampled: *before* the `if`. `Sample` chooses the texture's level of detail from how
fast the texture coordinates change between neighbouring pixels, which the GPU works out by comparing pixels that run
together in small 2×2 groups. Inside an `if` that depends on the pixel, a neighbour may have taken the other branch,
and those differences are then undefined. Sampling once before the branch avoids that, and the branches use
`diffuseColor` and `specularColor`.
:::

We first calculate the dot product between the `lightDir` vector and the negated `direction` vector (negated, because
we want the vectors to point towards the light source, instead of from). Be sure to normalize all the relevant
vectors.

> You may be wondering why there is a `>` sign instead of a `<` sign in the `if` guard. Shouldn't theta be smaller
> than the light's cutoff value to be inside the spotlight? That is right, but don't forget angle values are
> represented as cosine values instead of angles. An angle of 0 degrees is represented as the cosine value of `1.0`,
> while an angle of 90 degrees is represented as the cosine value of `0.0`. Between 0 and 90 degrees the cosine
> becomes smaller as the angle grows. Now you can understand that the closer the cosine value is to `1.0`, the
> smaller its angle. Now it makes sense why theta needs to be larger than the cutoff value. The cutoff value is
> currently set at the cosine of `12.5` which is equal to `0.976` so a cosine theta value between `0.976` and `1.0`
> would result in the fragment being lit as if inside the spotlight.

```quiz
`light.cutOff` holds cos(12.5°) ≈ 0.976. Which fragments does `theta > light.cutOff` light?
- [x] Those less than 12.5° away from the spotlight's direction: the smaller the angle, the larger its cosine
- [ ] Only those exactly 12.5° away, where theta equals the cutoff
- [ ] Those more than 12.5° away from the spotlight's direction, because their dot product is larger
---
Between 0° and 90° the cosine shrinks as the angle grows: 0° gives 1.0, 12.5° gives 0.976. So "angle smaller than the cutoff angle" becomes "cosine larger than the cutoff cosine" – and the shader never needs the expensive inverse cosine.
```

Inside the `if` the shader does the lighting as before, with diffuse and specular attenuated – but not the ambient
term:

:::opengl
```glsl
        // ambient  *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse  *= attenuation;
        specular *= attenuation;
```
:::
:::vulkan
```glsl
        // ambient  *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse  *= attenuation;
        specular *= attenuation;
```
:::
:::d3d12
```hlsl
        // ambient *= attenuation; // remove attenuation from ambient, as otherwise at large distances the light would be darker inside than outside the spotlight due the ambient term in the else branch
        diffuse *= attenuation;
        specular *= attenuation;
```
:::

The `else` branch uses the unattenuated ambient term. If the cone's inside attenuated its ambient term, a far
fragment just inside the cone could end up darker than its neighbour just outside – the spotlight would cast a dark
ring. learnopengl also changes the light's strengths for the flashlight: ambient `0.1` and diffuse `0.8` (*we configure
the diffuse intensity slightly higher; the right lighting conditions differ with each lighting method and
environment*). And the light is at the camera now, so the lamp cube is commented out again.

Now do the task **spotlight**. Running the program results in a round spot of light in the middle of container 0,
with a hard edge: inside, wood and steel frame are brightly lit; the corners of container 0 and the other containers
(but for the edge of the one just to its right) get only the ambient light. Since the flashlight sits at the camera,
on your own computer it follows you when you move and look around.

:::opengl
```quiz
Suppose you misspell a member name: `lightingShader.setFloat("light.cutoff", …)` instead of `"light.cutOff"`. What happens?
- [ ] OpenGL creates a new uniform named `light.cutoff`
- [ ] The program fails to compile
- [x] `glGetUniformLocation` returns -1, the `glUniform1f` call with location -1 is silently ignored, and `light.cutOff` keeps its default value 0
---
Uniform names are only looked up at run time, so neither the C++ compiler nor OpenGL reports the typo. With cutOff = 0 every fragment less than 90° from the flashlight's direction counts as inside the cone – no visible spot at all. When a uniform seems to have no effect, check its name first.
```
:::
:::vulkan
```quiz
In the spotlight's C++ `Light`, `cutOff` directly follows `glm::vec3 direction` without a padding float. At which offset does std140 put the shader's `cutOff`?
- [x] 28 – a float only needs 4-byte alignment, so it fills the last 4 bytes of the 16-byte slot that `direction` starts
- [ ] 40 – after `direction`, which std140 stores as 16 bytes plus 8 bytes of padding
- [ ] 32 – every member of a uniform block starts at a multiple of 16
---
`direction` (a vec3) needs a multiple of 16 and starts at 16; it takes 12 bytes, up to 28. `cutOff` fits right there. The next vec3, `ambient`, then starts at the next multiple of 16: 32.
```
:::
:::d3d12
```quiz
Why does the spotlight's pixel shader sample `diffuseMap` and `specularMap` once before the `if` instead of inside its branches?
- [ ] To make the shader faster: a texture can only be sampled once per pixel
- [ ] Sampling is not allowed inside an `if` in HLSL at all
- [x] `Sample` picks the level of detail from the texture coordinates of neighbouring pixels; inside a per-pixel branch a neighbour may have taken the other path, so that information is undefined
---
The GPU runs pixels in 2×2 groups and compares their texture coordinates to choose the mip level. Sampling before the branch, where all pixels run the same code, keeps that well-defined; the branches use the stored colours.
```
:::

## Smooth/Soft edges

To create the effect of a smoothly-edged spotlight we want to simulate a spotlight having an **inner** and an
**outer** cone. We can set the inner cone as the cone defined in the previous section, but we also want an outer cone
that gradually dims the light from the inner to the edges of the outer cone.

To create an outer cone we simply define another cosine value that represents the angle between the spotlight's
direction vector and the outer cone's vector (equal to its radius). Then, if a fragment is between the inner and the
outer cone it should calculate an intensity value between `0.0` and `1.0`. If the fragment is inside the inner cone
its intensity is equal to `1.0` and `0.0` if the fragment is outside the outer cone.

We can calculate such a value using the following equation:

```text
       θ - γ
I  =  -------        with   ε = ϕ - γ
         ε
```

Here ε (epsilon) is the cosine difference between the inner (ϕ) and the outer cone (γ). The resulting `I` value is
then the intensity of the spotlight at the current fragment.

It is a bit hard to visualize how this formula actually works so let's try it out with a few sample values. With an
inner cone of 12.5° (ϕ = 0.9763) and an outer cone of 17.5° (γ = 0.9537), ε = 0.9763 − 0.9537 = 0.0226:

| θ in degrees | θ (cosine) | (θ − γ) / ε | clamped |
|---|---|---|---|
| 0 | 1.0000 | 2.05 | 1.0 |
| 10 | 0.9848 | 1.38 | 1.0 |
| 12.5 | 0.9763 | 1.00 | 1.0 |
| 14 | 0.9703 | 0.73 | 0.73 |
| 15 | 0.9659 | 0.54 | 0.54 |
| 16 | 0.9613 | 0.33 | 0.33 |
| 17.5 | 0.9537 | 0.00 | 0.0 |
| 20 | 0.9397 | −0.62 | 0.0 |

As you can see we're basically interpolating between the outer cosine and the inner cosine based on the θ value. If
you still don't really see what's going on, don't worry, you can simply take the formula for granted and return here
when you're much older and wiser.

We now have an intensity value that is either negative when outside the spotlight, higher than `1.0` when inside the
inner cone, and somewhere in between around the edges. If we properly clamp the values we don't need an `if-else` in
the fragment shader anymore and we can simply multiply the light components with the calculated intensity value:

:::opengl
```glsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;
```
:::
:::vulkan
```glsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-ubo.light.direction));
    float epsilon = (ubo.light.cutOff - ubo.light.outerCutOff);
    float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;
```
:::
:::d3d12
```hlsl
    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    diffuse *= intensity;
    specular *= intensity;
```

Without the branch, every pixel runs the same code again, so the maps can be sampled right where they are used, as
before the spotlight step.
:::

Note that we use the `clamp` function that *clamps* its first argument between the values `0.0` and `1.0`. This makes
sure the intensity values won't end up outside the [0, 1] range. We leave the ambient component unaffected by the
intensity so the lighting always has a little bit of light – but with the `else` branch gone, learnopengl multiplies
all three terms by the attenuation again, as for the point light.

```quiz
A fragment lies 5° away from the flashlight's direction. Its `(theta - outerCutOff) / epsilon` comes out at about 1.9. What intensity does the shader use?
- [ ] 0.0 – values above 1 mean the fragment is outside the cone
- [x] 1.0 – `clamp` limits the value to [0, 1], so everything inside the inner cone gets the full light
- [ ] 1.9 – the fragment is lit almost twice as brightly as the light's diffuse colour
---
Inside the inner cone the formula gives values above 1, outside the outer cone negative values. `clamp` turns them into exactly 1.0 and 0.0, and only the soft zone between 12.5° and 17.5° gets the values in between.
```

Make sure you add the `outerCutOff` value to the `Light` struct and set its value in the application:

:::opengl
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;
    [...]
};
```

```cpp
        lightingShader.setFloat("light.outerCutOff", glm::cos(glm::radians(17.5f)));
```
:::
:::vulkan
```glsl
struct Light {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;
    [...]
};
```

In std140, `outerCutOff` is a float and goes at 32 – the start of a new 16-byte slot, since `cutOff` filled the last
one. The next member, `ambient`, is a `vec3` and needs a multiple of 16: 48. So the C++ struct needs three padding
floats after `outerCutOff`, and the light grows to 112 bytes:

```cpp
struct Light {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction
    float outerCutOff;
    float pad6; // ambient (a vec3) starts at the next multiple of 16 bytes
    float pad7;
    float pad8;

    glm::vec3 ambient;
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;

    float constant; // fills the 4 bytes after specular
    float linear;
    float quadratic;
    float pad4; // the size of a struct in a uniform block is rounded up to a multiple of 16 bytes
    float pad5;
};
```

The padding floats keep the names they got when they were added, so they are not in order – their names don't
matter, only their positions do.

```cpp
        ubo.light.outerCutOff = glm::cos(glm::radians(17.5f));
```
:::
:::d3d12
```hlsl
struct Light
{
    float3 position;
    float3 direction;
    float cutOff;
    float outerCutOff;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

`outerCutOff` and the three terms fill row 2 exactly (32–47), so `ambient` still starts at 48 – the C++ struct only
swaps `padding1` for `outerCutOff` and stays 96 bytes. (The terms come right after the cut-offs as in learnopengl's
`SpotLight` of the next chapter; in this order every `float3` starts a row and the padding stays simple.)

```cpp
    struct Light
    {
        XMFLOAT3 position;
        float padding0;
        XMFLOAT3 direction;
        float cutOff;          // fills the row of direction
        float outerCutOff;     // outerCutOff and the three terms fill the next row
        float constantTerm;
        float linearTerm;
        float quadraticTerm;
        XMFLOAT3 ambient;
        float padding1;
        XMFLOAT3 diffuse;
        float padding2;
        XMFLOAT3 specular;
        float padding3;
    };
```

```cpp
    constantBufferData.light.outerCutOff = std::cos(XMConvertToRadians(17.5f));
```
:::

Here we set the outer cutoff angle at `17.5` degrees, 5 degrees beyond the inner cone. Now do the last task,
**soft-edges**: add `outerCutOff`, replace the `if`/`else` by the intensity, and attenuate all three terms. When you
build and run it, the spot's edge fades out softly: the corners of container 0, which were in the dark before, now lie
in the soft zone and are half lit. The containers outside the cone are almost black, because there they now only get
the *attenuated* ambient light.

Ahhh, that's much better. Play around with the inner and outer cutoff angles and try to create a spotlight that better
suits your needs. On your own computer you can walk around with the flashlight and look at the containers it hits.

The final fragment shader:

:::opengl
```glsl
void main()
{
    // ambient
    vec3 ambient = light.ambient * texture(material.diffuse, TexCoords).rgb;

    // diffuse
    vec3 norm = normalize(Normal);
    vec3 lightDir = normalize(light.position - FragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = light.diffuse * diff * texture(material.diffuse, TexCoords).rgb;

    // specular
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    vec3 specular = light.specular * spec * texture(material.specular, TexCoords).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;

    // attenuation
    float distance    = length(light.position - FragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // ambient
    vec3 ambient = ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb;

    // diffuse
    vec3 norm = normalize(fragNormal);
    vec3 lightDir = normalize(ubo.light.position - fragPos);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = ubo.light.diffuse * diff * texture(diffuseMap, fragTexCoord).rgb;

    // specular
    vec3 viewDir = normalize(ubo.viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    vec3 specular = ubo.light.specular * spec * texture(specularMap, fragTexCoord).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-ubo.light.direction));
    float epsilon = (ubo.light.cutOff - ubo.light.outerCutOff);
    float intensity = clamp((theta - ubo.light.outerCutOff) / epsilon, 0.0, 1.0);
    diffuse  *= intensity;
    specular *= intensity;

    // attenuation
    float distance    = length(ubo.light.position - fragPos);
    float attenuation = 1.0 / (ubo.light.constant + ubo.light.linear * distance + ubo.light.quadratic * (distance * distance));
    ambient  *= attenuation;
    diffuse  *= attenuation;
    specular *= attenuation;

    vec3 result = ambient + diffuse + specular;
    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // ambient
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;

    // diffuse
    float3 norm = normalize(input.normal);
    float3 lightDir = normalize(light.position - input.fragPos);
    float diff = max(dot(norm, lightDir), 0.0f);
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;

    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, input.texCoord).rgb;

    // spotlight (soft edges)
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = (light.cutOff - light.outerCutOff);
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    diffuse *= intensity;
    specular *= intensity;

    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - input.fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    float3 result = ambient + diffuse + specular;
    return float4(result, 1.0f);
}
```
:::

## Exercises

- Try experimenting with all the different light types and their fragment shaders. Try inverting some vectors and/or
  use `<` instead of `>`. Try to explain the different visual outcomes.

This is not a task in the project: try it once you have finished the tasks, and use **Build & run** to see the
result. For example, with `theta < light.cutOff` in the spotlight step the circle turns inside out – everything
*outside* the cone is lit and the centre of container 0 gets only the ambient light. And if you use
`normalize(light.direction)` without the minus, theta becomes the cosine of the angle to the *opposite* direction,
which is negative for everything in front of the camera: no fragment is ever in the cone.

In the next chapter we'll put all of these light casters together – a directional light, four point lights and the
flashlight – in one scene.
