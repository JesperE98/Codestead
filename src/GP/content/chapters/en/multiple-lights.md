# Multiple lights

In the previous chapters we learned a lot about lighting in {{api}}. We learned about Phong shading, materials,
lighting maps and different types of light casters. In this chapter we're going to combine all the previously
obtained knowledge by creating a fully lit scene with 6 active light sources. We are going to simulate a sun-like
light as a directional light source, 4 point lights scattered throughout the scene and we'll be adding a flashlight
as well.

To use more than one light source in the scene we want to encapsulate the lighting calculations into
{{shaderLanguage}} *functions*. The reason for that is that the code quickly gets nasty when we do lighting
computations with multiple light types, each requiring different computations. If we were to do all these
calculations in the main function only, the code quickly becomes difficult to understand.

Functions in {{shaderLanguage}} are just like C-functions. We have a function name, a return type and we need to
declare a prototype at the top of the code file if the function hasn't been declared yet before the main function.
We'll create a different function for each of the light types: directional lights, point lights and spotlights.

When using multiple lights in a scene the approach is usually as follows: we have a single color vector that
represents the fragment's output color. For each light, the light's contribution to the fragment is added to this
output color vector. So each light in the scene will calculate its individual impact and contribute that to the final
output color. A general structure would look something like this:

:::opengl
```glsl
void main()
{
    // define an output color value
    vec3 result = vec3(0.0);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // define an output color value
    vec3 result = vec3(0.0);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // define an output color value
    float3 result = float3(0.0f, 0.0f, 0.0f);
    // add the directional light's contribution to the output
    result += someFunctionToCalculateDirectionalLight();
    // do the same for all point lights
    for (int i = 0; i < nr_of_point_lights; i++)
        result += someFunctionToCalculatePointLight();
    // and add others lights as well (like spotlights)
    result += someFunctionToCalculateSpotLight();

    return float4(result, 1.0f);
}
```
:::

The actual code will likely differ per implementation, but the general structure remains the same. We define several
functions that calculate the impact per light source and add its resulting color to an output color vector. If for
example two light sources are close to the fragment, their combined contribution would result in a more brightly lit
fragment compared to the fragment being lit by a single light source.

:::opengl
This chapter's project starts from the result of *Light casters*: the ten containers, the diffuse and specular maps,
shininess 32, the camera at (0, 0, 3) looking down -z, and the lamp's VAO and `lightCubeShader`. The vertex shader is
now called `multiple_lights.vs` (unchanged). `multiple_lights.fs` is a fresh skeleton: the `Material` struct, the
inputs, `uniform vec3 viewPos;` and `uniform Material material;`, and a `main()` that computes `norm` and `viewDir`,
sets `vec3 result = vec3(0.0);` and has three `// TODO:` comments, one for each phase. In `main.cpp` the render loop
sets only `viewPos` and `material.shininess`, followed by three `// TODO:` comments for the lights' values; the
`lightPos` global is gone, and a fourth `// TODO:` marks where the lamps are drawn.
:::
:::vulkan
This chapter's project starts from the result of *Light casters*: the ten containers, the diffuse map (binding 0) and
specular map (binding 1), shininess 32, the uniform buffer at binding 2, the camera at (0, 0, 3) looking down -z, and
both pipelines – `lightingPipeline` now built from `shaders/multiple_lights.vert` / `.frag`, `lightCubePipeline` from
`shaders/light_cube.*`. The vertex shader is unchanged. `multiple_lights.frag` is a fresh skeleton: the two samplers,
`struct Material { float shininess; };`, the uniform block `{ mat4 view; mat4 proj; vec3 viewPos; Material material; }`,
the inputs, and a `main()` that computes `norm` and `viewDir`, sets `vec3 result = vec3(0.0);` and has three
`// TODO:` comments, one for each phase. In C++ the `Light` struct and the `lightPos` global are gone,
`UniformBufferObject` ends with `Material material;`, `updateUniformBuffer()` sets `viewPos` and `material.shininess`
followed by three `// TODO:` comments for the lights, and a fourth `// TODO:` in `recordCommandBuffer()` marks where
the lamps are drawn.
:::
:::d3d12
This chapter's project starts from the result of *Light casters*: the ten containers, the diffuse and specular maps,
shininess 32, the camera at (0, 0, 3) looking down -z, and the lamp's pipeline state `m_lightCubePipelineState`. The
lit objects' shaders are now in `multiple_lights.hlsl`: `VSMain` is unchanged; there are the textures, `struct
Material { float shininess; }`, the cbuffer `SceneConstantBuffer` with `view`, `projection`, `viewPos` and `material`
(no light yet), and a fresh `PSMain` that computes `norm` and `viewDir`, sets `float3 result = float3(0.0f, 0.0f,
0.0f);` and has three `// TODO:` comments, one for each phase. In `main.cpp` the C++ `Light` struct and the `lightPos`
global are gone, `OnUpdate` sets only `viewPos` and `material.shininess`, followed by three `// TODO:` comments for
the lights, and a fourth `// TODO:` in `PopulateCommandList` marks where the lamps are drawn.
:::

The `// TODO:` comments mark where your code goes. After each task, press **Build & run** (Ctrl+Enter) to compile
the program and run it in the built-in simulator. Build it once now: with no light at all, all ten containers are
black against the dark grey background.

> As in *Light casters* we use learnopengl's camera at (0, 0, 3), so that all ten containers are in view. At the end
> of this chapter you'll see that this hides most of the lamps: they are outside the window or behind containers.

## Directional light

We want to define a function in the fragment shader that calculates the contribution a directional light has on the
corresponding fragment: a function that takes a few parameters and returns the calculated directional lighting color.

First we need to set the required variables that we minimally need for a directional light source. We can store the
variables in a struct called `DirLight` and define it as a uniform:

:::opengl
```glsl
struct DirLight {
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
uniform DirLight dirLight;
```

We can then pass the `dirLight` uniform to a function with the following prototype:

```glsl
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
```

> Just like C and C++, when we want to call a function (in this case inside the `main` function) the function should
> be defined somewhere before the caller's line number. In this case we'd prefer to define the functions below the
> `main` function so this requirement doesn't hold. Therefore we declare the function's prototypes somewhere above
> the `main` function, just like we would in C.

You can see that the function requires a `DirLight` struct and two other vectors required for its computation. If you
successfully completed the previous chapter then the content of this function should come as no surprise:

```glsl
// calculates the color when using a directional light.
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir)
{
    vec3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    return (ambient + diffuse + specular);
}
```

We basically copied the code from the previous chapter and used the vectors given as function arguments to calculate
the directional light's contribution vector. The resulting ambient, diffuse and specular contributions are then
returned as a single color vector. The function reads `material` and `TexCoords` directly: they are global in the
shader (a uniform and an input), so every function can use them.

In `main.cpp` we set learnopengl's values for the sun – the direction of *Light casters* and fairly weak colours,
since five more lights will join it:

```cpp
        // directional light
        lightingShader.setVec3("dirLight.direction", -0.2f, -1.0f, -0.3f);
        lightingShader.setVec3("dirLight.ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("dirLight.diffuse", 0.4f, 0.4f, 0.4f);
        lightingShader.setVec3("dirLight.specular", 0.5f, 0.5f, 0.5f);
```
:::
:::vulkan
```glsl
struct DirLight {
    vec3 direction;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

In Vulkan the light isn't a separate uniform but a member of the uniform block, added at its end:

```glsl
layout(binding = 2) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 viewPos;
    Material material;
    DirLight dirLight;
} ubo;
```

We can then pass `ubo.dirLight` to a function with the following prototype:

```glsl
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);
```

> Just like C and C++, when we want to call a function (in this case inside the `main` function) the function should
> be defined somewhere before the caller's line number. In this case we'd prefer to define the functions below the
> `main` function so this requirement doesn't hold. Therefore we declare the function's prototypes somewhere above
> the `main` function, just like we would in C.

You can see that the function requires a `DirLight` struct and two other vectors required for its computation. If you
successfully completed the previous chapter then the content of this function should come as no surprise:

```glsl
// calculates the color when using a directional light.
vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir) {
    vec3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    return (ambient + diffuse + specular);
}
```

We basically copied the code from the previous chapter and used the vectors given as function arguments to calculate
the directional light's contribution vector. The resulting ambient, diffuse and specular contributions are then
returned as a single color vector. The function reads `ubo`, the samplers and `fragTexCoord` directly: they are
global in the shader, so every function can use them.

The C++ side mirrors the struct with std140's rules: four `vec3`s, each starting at a multiple of 16 bytes, so a
padding float after each – 64 bytes. `DirLight dirLight;` goes at the end of `UniformBufferObject`, where it starts at
offset 160 in both (after the matrices at 0 and 64, `viewPos` at 128 and the 16-byte `Material` at 144):

```cpp
// The lights: the same layout as the structs in the fragment shader (a padding float where a vec3 has no float after it).
struct DirLight {
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

In `updateUniformBuffer()` we set learnopengl's values for the sun – the direction of *Light casters* and fairly weak
colours, since five more lights will join it:

```cpp
        // directional light
        ubo.dirLight.direction = glm::vec3(-0.2f, -1.0f, -0.3f);
        ubo.dirLight.ambient   = glm::vec3(0.05f, 0.05f, 0.05f);
        ubo.dirLight.diffuse   = glm::vec3(0.4f, 0.4f, 0.4f);
        ubo.dirLight.specular  = glm::vec3(0.5f, 0.5f, 0.5f);
```
:::
:::d3d12
```hlsl
struct DirLight
{
    float3 direction;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};
```

The light is a member of the constant buffer, added at its end:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
    DirLight dirLight;
};
```

We can then pass `dirLight` to a function that calculates its contribution. If you successfully completed the
previous chapter then the content of this function should come as no surprise:

```hlsl
// calculates the color when using a directional light.
float3 CalcDirLight(DirLight light, float3 normal, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(-light.direction);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    return (ambient + diffuse + specular);
}
```

Two differences from learnopengl's GLSL version:

- Just like in C and C++, a function has to be declared before the line that calls it. learnopengl declares
  prototypes above `main` and defines the functions below it; the project simply **defines the functions before
  `PSMain`**, so no prototypes are needed.
- GLSL's functions read the texture coordinates from the global input `TexCoords`. In HLSL the interpolated inputs
  are not globals – they are the parameter `input` of `PSMain` – so the functions get the texture coordinates as an
  **extra last parameter**, `float2 texCoord`. The constant buffer, the textures and the sampler *are* global, so
  `material.shininess`, `diffuseMap` and `wrapSampler` can be used directly.

The C++ side mirrors the HLSL packing: four `float3`s, and since a `float3` can't cross a 16-byte row, each starts a
new row – a padding float after each, 64 bytes. `DirLight dirLight;` goes at the end of `SceneConstantBuffer`, where it
starts at offset 160 in both (a struct always starts a new row; `material` took the row at 144):

```cpp
    // The lights: what the shaders see as structs DirLight, PointLight and SpotLight.
    struct DirLight
    {
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

In `OnUpdate` we set learnopengl's values for the sun – the direction of *Light casters* and fairly weak colours,
since five more lights will join it:

```cpp
    // directional light
    constantBufferData.dirLight.direction = XMFLOAT3(-0.2f, -1.0f, -0.3f);
    constantBufferData.dirLight.ambient = XMFLOAT3(0.05f, 0.05f, 0.05f);
    constantBufferData.dirLight.diffuse = XMFLOAT3(0.4f, 0.4f, 0.4f);
    constantBufferData.dirLight.specular = XMFLOAT3(0.5f, 0.5f, 0.5f);
```
:::

Phase 1 of the main function then becomes the first contribution to `result`:

:::opengl
```glsl
    // phase 1: directional lighting
    vec3 result = CalcDirLight(dirLight, norm, viewDir);
```
:::
:::vulkan
```glsl
    // phase 1: directional lighting
    vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);
```
:::
:::d3d12
```hlsl
    // phase 1: directional lighting
    float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);
```
:::

Now do the first task, **dir-light**. When you build and run it, the containers are dimly lit from above, the same
way everywhere: the faces turned towards the camera only a little, faces turned upwards – like those of the container
at the top left – more clearly. It's the directional light of *Light casters*, just weaker.

:::opengl
```quiz
learnopengl defines `CalcDirLight` below `main`, but `main` calls it. Why does the shader still compile?
- [ ] GLSL compiles all functions first and resolves the calls afterwards, so the order never matters
- [x] The prototype `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);` above `main` declares the function before it's called
- [ ] Functions whose names start with `Calc` are treated as built-in functions
---
Like C, GLSL requires a function to be declared before its first call. The prototype gives the name, return type and parameters; the body can then follow anywhere below.
```
:::
:::vulkan
```quiz
learnopengl defines `CalcDirLight` below `main`, but `main` calls it. Why does the shader still compile?
- [ ] GLSL compiles all functions first and resolves the calls afterwards, so the order never matters
- [x] The prototype `vec3 CalcDirLight(DirLight light, vec3 normal, vec3 viewDir);` above `main` declares the function before it's called
- [ ] Functions whose names start with `Calc` are treated as built-in functions
---
Like C, GLSL requires a function to be declared before its first call. The prototype gives the name, return type and parameters; the body can then follow anywhere below.
```
:::
:::d3d12
```quiz
Why does the HLSL `CalcDirLight` have a fourth parameter, `float2 texCoord`, which learnopengl's GLSL version doesn't have?
- [ ] HLSL functions must have at least four parameters
- [x] The texture coordinates are part of `PSMain`'s parameter `input`, not a global, so a function only sees them if they're passed in
- [ ] `Sample` only accepts texture coordinates that arrive as a function parameter
---
In GLSL, `TexCoords` is a global input that every function can read. In HLSL the interpolated values reach the shader as the parameter of its entry point, so `PSMain` passes `input.texCoord` on. The cbuffer, the textures and the sampler are globals and need no parameter.
```
:::

## Point light

Similar to directional lights we also want to define a function that calculates the contribution a point light has on
the given fragment, including its attenuation. Just like directional lights we want to define a struct that specifies
all the variables required for a point light:

:::opengl
```glsl
struct PointLight {
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
#define NR_POINT_LIGHTS 4
uniform PointLight pointLights[NR_POINT_LIGHTS];
```
:::
:::vulkan
```glsl
struct PointLight {
    vec3 position;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

#define NR_POINT_LIGHTS 4
```

and in the uniform block, after `dirLight`:

```glsl
    PointLight pointLights[NR_POINT_LIGHTS];
```
:::
:::d3d12
```hlsl
// (linear is a word of HLSL: the attenuation terms are called constantTerm, linearTerm
// and quadraticTerm.)
struct PointLight
{
    float3 position;

    float constantTerm;
    float linearTerm;
    float quadraticTerm;

    float3 ambient;
    float3 diffuse;
    float3 specular;
};

#define NR_POINT_LIGHTS 4
```

and in the cbuffer, after `dirLight`:

```hlsl
    PointLight pointLights[NR_POINT_LIGHTS];
```

As in *Light casters*, `linear` is an HLSL keyword, so the terms are called `constantTerm`, `linearTerm` and
`quadraticTerm`.
:::

As you can see we used a pre-processor directive in {{shaderLanguage}} to define the number of point lights we want
to have in our scene. We then use this `NR_POINT_LIGHTS` constant to create an array of `PointLight` structs. Arrays
in {{shaderLanguage}} are just like C arrays and can be created by the use of two square brackets. Right now we have
4 `PointLight` structs to fill with data.

> We could also define one big struct (instead of different structs per light type) that contains all the necessary
> variables for all the different light types and use that struct for each function, and simply ignore the variables
> we don't need. However, I personally find the current approach more intuitive and aside from a few extra lines of
> code it could save some memory since not all light types need all variables.

The prototype of the point light's function is as follows:

:::opengl
```glsl
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir);
```
:::
:::vulkan
```glsl
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir);
```
:::
:::d3d12
```hlsl
float3 CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
```

(defined after `CalcDirLight`, before `PSMain`, with the extra `texCoord` again).
:::

The function takes all the data it needs as its arguments and returns a vector that represents the color contribution
that this specific point light has on the fragment. Again, some intelligent copy-and-pasting results in the following
function:

:::opengl
```glsl
// calculates the color when using a point light.
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir)
{
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::
:::vulkan
```glsl
// calculates the color when using a point light.
vec3 CalcPointLight(PointLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::
:::d3d12
```hlsl
// calculates the color when using a point light.
float3 CalcPointLight(PointLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;
    return (ambient + diffuse + specular);
}
```
:::

Abstracting this functionality away in a function like this has the advantage that we can easily calculate the
lighting for multiple point lights without the need for duplicated code. In the main function we simply create a loop
that iterates over the point light array that calls `CalcPointLight` for each point light.

```quiz
Each of the four point lights has an ambient strength of 0.05, and `CalcPointLight` attenuates the ambient term too. Why attenuate it here?
- [ ] Ambient light is not allowed to exceed 0.05 in total
- [x] With several lights, every light adds its own ambient term; without attenuation the ambient terms of all lights – even far away ones – would stack up everywhere and wash out the scene
- [ ] The attenuation makes the ambient term brighter near the light, which is needed for the specular highlights
---
This is the note from *Light casters*: one light's unattenuated ambient is harmless, but here five lights' ambient terms add up at every fragment. Attenuated, a point light's ambient only matters near that light.
```

## Putting it all together

Now that we defined both a function for directional lights and a function for point lights we can put it all together
in the main function:

:::opengl
```glsl
void main()
{
    // properties
    vec3 norm = normalize(Normal);
    vec3 viewDir = normalize(viewPos - FragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    // phase 1: directional lighting
    vec3 result = CalcDirLight(dirLight, norm, viewDir);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(pointLights[i], norm, FragPos, viewDir);
    // phase 3: spot light
    result += CalcSpotLight(spotLight, norm, FragPos, viewDir);

    FragColor = vec4(result, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    // properties
    vec3 norm = normalize(fragNormal);
    vec3 viewDir = normalize(ubo.viewPos - fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // main() sums them up for this fragment's final colour.
    // phase 1: directional lighting
    vec3 result = CalcDirLight(ubo.dirLight, norm, viewDir);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(ubo.pointLights[i], norm, fragPos, viewDir);
    // phase 3: spot light
    result += CalcSpotLight(ubo.spotLight, norm, fragPos, viewDir);

    outColor = vec4(result, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // properties
    float3 norm = normalize(input.normal);
    float3 viewDir = normalize(viewPos - input.fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // PSMain sums them up for this fragment's final colour.
    // phase 1: directional lighting
    float3 result = CalcDirLight(dirLight, norm, viewDir, input.texCoord);
    // phase 2: point lights
    for (int i = 0; i < NR_POINT_LIGHTS; i++)
        result += CalcPointLight(pointLights[i], norm, input.fragPos, viewDir, input.texCoord);
    // phase 3: spot light
    result += CalcSpotLight(spotLight, norm, input.fragPos, viewDir, input.texCoord);

    return float4(result, 1.0f);
}
```
:::

Each light type adds its contribution to the resulting output color until all light sources are processed. The
resulting color contains the color impact of all the light sources in the scene combined. We leave the
`CalcSpotLight` function as an exercise for the reader – or rather, for the third task below.

> There are lot of duplicated calculations in this approach spread out over the light type functions (e.g.
> calculating the reflect vector, diffuse and specular terms, and sampling the material textures) so there's room
> for optimization here.

:::opengl
Setting the uniforms for the directional light struct shouldn't be too unfamiliar, but you may be wondering how to set
the uniform values of the point lights since the point light uniform is actually an array of `PointLight` structs.
This isn't something we've discussed before.

Luckily for us, it isn't too complicated. Setting the uniform values of an array of structs works just like setting
the uniforms of a single struct, although this time we also have to define the appropriate index when querying the
uniform's location:

```cpp
lightingShader.setFloat("pointLights[0].constant", 1.0f);
```

Here we index the first `PointLight` struct in the `pointLights` array and internally retrieve the location of its
`constant` variable, which we set to `1.0`.

This does mean unfortunately that we have to manually set all the uniforms for each of the 4 point lights, which
leads up to 28 uniform calls for the point lights alone which is a bit tedious. You could try to abstract a bit away
from this by defining a point light class that sets the uniforms for you, but in the end you'd still have to set each
light's uniform values this way. The comment block in the render loop says the same: a more efficient approach,
*uniform buffer objects*, comes in the *Advanced GLSL* chapter.

The first point light looks like this; the other three are the same with indices 1, 2 and 3:

```cpp
        // point light 1
        lightingShader.setVec3("pointLights[0].position", pointLightPositions[0]);
        lightingShader.setVec3("pointLights[0].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[0].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[0].specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("pointLights[0].constant", 1.0f);
        lightingShader.setFloat("pointLights[0].linear", 0.09f);
        lightingShader.setFloat("pointLights[0].quadratic", 0.032f);
```
:::
:::vulkan
Setting the directional light's values shouldn't be too unfamiliar, but you may be wondering how the array of
`PointLight` structs lines up with C++. In Vulkan the whole block is one piece of memory, so the C++ array must have
exactly the shader's **array stride** – the distance from one element to the next.

In std140, the stride of an array of structs is the struct's size rounded up to a multiple of 16. Let's lay out the
shader's `PointLight`: `position` at 0, `constant` fills the 4 bytes after it (12), `linear` and `quadratic` at 16 and
20, then `ambient` – a `vec3`, so at the next multiple of 16: 32. `diffuse` at 48, `specular` at 64, ending at 76. The
size rounded up to a multiple of 16 is **80**: that's the stride. The C++ struct reproduces it with padding floats:

```cpp
struct PointLight {
    glm::vec3 position;

    float constant; // fills the 4 bytes after position
    float linear;
    float quadratic;
    float pad1; // ambient (a vec3) starts at the next multiple of 16 bytes
    float pad2;

    glm::vec3 ambient;
    float pad3;
    glm::vec3 diffuse;
    float pad4;
    glm::vec3 specular;
    float pad5;
};
```

`sizeof(PointLight)` is then 80, so a plain C++ array has the same stride as the shader's, and the array goes into
`UniformBufferObject` after `dirLight`, at offset 224:

```cpp
    PointLight pointLights[4]; // NR_POINT_LIGHTS in the shader; an array of structs has the same stride (80 bytes) in both
```

> If a struct in an array didn't end on a multiple of 16 bytes in C++, every element after the first would be shifted
> against the shader's – the first point light would look right and the others would read garbage. That's the most
> common uniform-buffer bug, and the padding floats are what prevent it.

The values are the same for all four lights except the position, so `updateUniformBuffer()` sets them in a loop:

```cpp
        // point lights 1 to 4
        for (int i = 0; i < 4; i++) {
            ubo.pointLights[i].position  = pointLightPositions[i];
            ubo.pointLights[i].ambient   = glm::vec3(0.05f, 0.05f, 0.05f);
            ubo.pointLights[i].diffuse   = glm::vec3(0.8f, 0.8f, 0.8f);
            ubo.pointLights[i].specular  = glm::vec3(1.0f, 1.0f, 1.0f);
            ubo.pointLights[i].constant  = 1.0f;
            ubo.pointLights[i].linear    = 0.09f;
            ubo.pointLights[i].quadratic = 0.032f;
        }
```

(OpenGL programs set each member of each array element by name – `"pointLights[0].constant"` – which adds up to 28
calls for the point lights alone. With a uniform buffer we just fill a C++ struct and copy it with one `memcpy`.)
:::
:::d3d12
Setting the directional light's values shouldn't be too unfamiliar, but you may be wondering how the array of
`PointLight` structs lines up with C++. The constant buffer is one piece of memory, so the C++ array must have exactly
the HLSL array's **stride** – the distance from one element to the next.

HLSL doesn't pack arrays: every array element starts a new 16-byte row, and so does every struct. Lay out the HLSL
`PointLight` as in *Light casters*: `position` at 0, `constantTerm` at 12, `linearTerm` and `quadraticTerm` at 16 and
20, `ambient` at 32 (a `float3` can't use the 8 bytes left in that row), `diffuse` at 48, `specular` at 64, ending at
76. The next element starts at the next row, so the stride is **80**. The C++ struct reproduces it:

```cpp
    struct PointLight
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

`sizeof(PointLight)` is then 80, so a plain C++ array has the same stride as HLSL's, and the array goes into
`SceneConstantBuffer` after `dirLight`, at offset 224:

```cpp
        PointLight pointLights[4];    // NR_POINT_LIGHTS: each element starts a new 16-byte row (80 bytes each)
```

> If the C++ struct ended at 76 bytes instead of 80, every element after the first would be shifted against HLSL's –
> the first point light would look right and the others would read garbage. The trailing `padding3` is what prevents
> that.

Then `OnUpdate` sets the values of each light, indexing the array like any C++ array of structs. The first point light
looks like this; the other three are the same with indices 1, 2 and 3:

```cpp
    // point light 1
    constantBufferData.pointLights[0].position = pointLightPositions[0];
    constantBufferData.pointLights[0].ambient = XMFLOAT3(0.05f, 0.05f, 0.05f);
    constantBufferData.pointLights[0].diffuse = XMFLOAT3(0.8f, 0.8f, 0.8f);
    constantBufferData.pointLights[0].specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.pointLights[0].constantTerm = 1.0f;
    constantBufferData.pointLights[0].linearTerm = 0.09f;
    constantBufferData.pointLights[0].quadraticTerm = 0.032f;
```
:::

Let's not forget that we also need to define a position vector for each of the point lights so let's spread them up a
bit around the scene. We'll define another `glm::vec3` array that contains the pointlights' positions:

:::opengl
```cpp
    // positions of the point lights
    glm::vec3 pointLightPositions[] = {
        glm::vec3( 0.7f,  0.2f,  2.0f),
        glm::vec3( 2.3f, -3.3f, -4.0f),
        glm::vec3(-4.0f,  2.0f, -12.0f),
        glm::vec3( 0.0f,  0.0f, -3.0f)
    };
```

It goes right after `cubePositions` in `main`.
:::
:::vulkan
```cpp
// positions of the point lights
const std::vector<glm::vec3> pointLightPositions = {
    glm::vec3( 0.7f,  0.2f,  2.0f),
    glm::vec3( 2.3f, -3.3f, -4.0f),
    glm::vec3(-4.0f,  2.0f, -12.0f),
    glm::vec3( 0.0f,  0.0f, -3.0f)
};
```

It's a global after `cubePositions`, because both `updateUniformBuffer()` and `recordCommandBuffer()` (for the lamps)
need it.
:::
:::d3d12
In DirectXMath that's an array of `XMFLOAT3`:

```cpp
// positions of the point lights
XMFLOAT3 pointLightPositions[] =
{
    XMFLOAT3( 0.7f,  0.2f,  2.0f),
    XMFLOAT3( 2.3f, -3.3f, -4.0f),
    XMFLOAT3(-4.0f,  2.0f, -12.0f),
    XMFLOAT3( 0.0f,  0.0f, -3.0f)
};
```

It's a global after `fov`, because both `OnUpdate` and `PopulateCommandList` (for the lamps) need it.
:::

Now do the task **point-lights**: the struct, the array, `CalcPointLight` with its prototype or definition, phase 2,
the positions and the values of the four lights. When you build and run it, the scene is much brighter. The
containers near the camera are lit most, above all by the point light at (0.7, 0.2, 2.0) right in front of them; even
a far container at the top of the window is lit now, by the point light at (-4.0, 2.0, -12.0) close to it.

:::opengl
```quiz
How do you set the `linear` term of the *third* point light from `main.cpp`?
- [ ] `lightingShader.setFloat("pointLights.linear[2]", 0.09f);`
- [x] `lightingShader.setFloat("pointLights[2].linear", 0.09f);`
- [ ] `lightingShader.setFloat("pointLights[3].linear", 0.09f);`
---
Every member of every array element is a uniform of its own, named like a C expression: array, index (starting at 0, so the third light is `[2]`), then the member.
```
:::
:::vulkan
```quiz
The shader's `PointLight` ends at byte 76. Where does `pointLights[1]` start, relative to `pointLights[0]`?
- [ ] 76 bytes later – right after the last member
- [x] 80 bytes later – in std140 the array stride is the struct size rounded up to a multiple of 16
- [ ] 128 bytes later – std140 rounds array elements up to a power of two
---
That's why the C++ `PointLight` ends with `pad5`: with it `sizeof(PointLight)` is 80, the same as the shader's stride, so `ubo.pointLights[1]` lands where the shader reads `pointLights[1]`.
```
:::
:::d3d12
```quiz
The HLSL `PointLight` ends at byte 76. Where does `pointLights[1]` start, relative to `pointLights[0]`?
- [ ] 76 bytes later – HLSL packs array elements tightly
- [x] 80 bytes later – every array element starts a new 16-byte row
- [ ] 96 bytes later – a struct in a cbuffer always takes six rows
---
HLSL doesn't pack arrays: each element starts at a row boundary. That's why the C++ `PointLight` ends with `padding3`: with it `sizeof(PointLight)` is 80, so the C++ array has HLSL's stride.
```
:::

### The flashlight

The third phase is the spotlight of *Light casters* – with soft edges – as a function. Its struct has learnopengl's
`SpotLight` order: position, direction, the two cut-offs, the attenuation terms and the colours:

:::opengl
```glsl
struct SpotLight {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
[...]
uniform SpotLight spotLight;
```
:::
:::vulkan
```glsl
struct SpotLight {
    vec3 position;
    vec3 direction;
    float cutOff;
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};
```

`SpotLight spotLight;` follows `pointLights` in the block. In std140: `position` 0, `direction` 16, `cutOff` 28,
`outerCutOff` 32, the terms 36, 40 and 44, so `ambient` begins exactly at 48 without padding, `diffuse` 64 and
`specular` 80 – 96 bytes. The C++ struct only needs `pad1` after `position` and a float after each colour:

```cpp
struct SpotLight {
    glm::vec3 position;
    float pad1;
    glm::vec3 direction;
    float cutOff; // fills the 4 bytes after direction
    float outerCutOff;

    float constant;
    float linear;
    float quadratic;

    glm::vec3 ambient; // at 48 bytes: a multiple of 16
    float pad2;
    glm::vec3 diffuse;
    float pad3;
    glm::vec3 specular;
    float pad4;
};
```

(Compare the 112 bytes of *Light casters*' soft spotlight, which kept the attenuation terms at the end: this order
wastes less space.)
:::
:::d3d12
```hlsl
struct SpotLight
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

`SpotLight spotLight;` follows `pointLights` in the cbuffer. It's the layout of *Light casters*' final light, so the
C++ struct is the same, 96 bytes:

```cpp
    struct SpotLight
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
:::

The function combines the attenuation with the soft-edge intensity and applies both to all three terms:

:::opengl
```glsl
// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir)
{
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(material.diffuse, TexCoords));
    vec3 diffuse = light.diffuse * diff * vec3(texture(material.diffuse, TexCoords));
    vec3 specular = light.specular * spec * vec3(texture(material.specular, TexCoords));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::
:::vulkan
```glsl
// calculates the color when using a spot light.
vec3 CalcSpotLight(SpotLight light, vec3 normal, vec3 fragPos, vec3 viewDir) {
    vec3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0);
    // specular shading
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), ubo.material.shininess);
    // attenuation
    float distance = length(light.position - fragPos);
    float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0, 1.0);
    // combine results
    vec3 ambient = light.ambient * vec3(texture(diffuseMap, fragTexCoord));
    vec3 diffuse = light.diffuse * diff * vec3(texture(diffuseMap, fragTexCoord));
    vec3 specular = light.specular * spec * vec3(texture(specularMap, fragTexCoord));
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::
:::d3d12
```hlsl
// calculates the color when using a spot light.
float3 CalcSpotLight(SpotLight light, float3 normal, float3 fragPos, float3 viewDir, float2 texCoord)
{
    float3 lightDir = normalize(light.position - fragPos);
    // diffuse shading
    float diff = max(dot(normal, lightDir), 0.0f);
    // specular shading
    float3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0f), material.shininess);
    // attenuation (dist: distance is the name of an HLSL function)
    float dist = length(light.position - fragPos);
    float attenuation = 1.0f / (light.constantTerm + light.linearTerm * dist + light.quadraticTerm * (dist * dist));
    // spotlight intensity
    float theta = dot(lightDir, normalize(-light.direction));
    float epsilon = light.cutOff - light.outerCutOff;
    float intensity = clamp((theta - light.outerCutOff) / epsilon, 0.0f, 1.0f);
    // combine results
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, texCoord).rgb;
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, texCoord).rgb;
    ambient *= attenuation * intensity;
    diffuse *= attenuation * intensity;
    specular *= attenuation * intensity;
    return (ambient + diffuse + specular);
}
```
:::

learnopengl's flashlight has no ambient light of its own (the sun and the point lights provide enough), full diffuse
and specular strength, the attenuation for a distance of 50, and a tighter soft edge than before – from 12.5° to 15°:

:::opengl
```cpp
        // spotLight
        lightingShader.setVec3("spotLight.position", cameraPos);
        lightingShader.setVec3("spotLight.direction", cameraFront);
        lightingShader.setVec3("spotLight.ambient", 0.0f, 0.0f, 0.0f);
        lightingShader.setVec3("spotLight.diffuse", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("spotLight.specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("spotLight.constant", 1.0f);
        lightingShader.setFloat("spotLight.linear", 0.09f);
        lightingShader.setFloat("spotLight.quadratic", 0.032f);
        lightingShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(12.5f)));
        lightingShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(15.0f)));
```
:::
:::vulkan
```cpp
        // spotLight
        ubo.spotLight.position    = cameraPos;
        ubo.spotLight.direction   = cameraFront;
        ubo.spotLight.ambient     = glm::vec3(0.0f, 0.0f, 0.0f);
        ubo.spotLight.diffuse     = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.spotLight.specular    = glm::vec3(1.0f, 1.0f, 1.0f);
        ubo.spotLight.constant    = 1.0f;
        ubo.spotLight.linear      = 0.09f;
        ubo.spotLight.quadratic   = 0.032f;
        ubo.spotLight.cutOff      = glm::cos(glm::radians(12.5f));
        ubo.spotLight.outerCutOff = glm::cos(glm::radians(15.0f));
```
:::
:::d3d12
```cpp
    // spotLight
    XMStoreFloat3(&constantBufferData.spotLight.position, cameraPos);
    XMStoreFloat3(&constantBufferData.spotLight.direction, cameraFront);
    constantBufferData.spotLight.ambient = XMFLOAT3(0.0f, 0.0f, 0.0f);
    constantBufferData.spotLight.diffuse = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.spotLight.specular = XMFLOAT3(1.0f, 1.0f, 1.0f);
    constantBufferData.spotLight.constantTerm = 1.0f;
    constantBufferData.spotLight.linearTerm = 0.09f;
    constantBufferData.spotLight.quadraticTerm = 0.032f;
    constantBufferData.spotLight.cutOff = std::cos(XMConvertToRadians(12.5f));
    constantBufferData.spotLight.outerCutOff = std::cos(XMConvertToRadians(15.0f));
```
:::

:::vulkan
With the spotlight the uniform block is complete: 160 bytes for the matrices, `viewPos` and the material, 64 for
`dirLight`, 4 × 80 for `pointLights` and 96 for `spotLight` – 640 bytes, every member at the same offset in the
shader and in `UniformBufferObject`.
:::
:::d3d12
With the spotlight the constant buffer is complete: 160 bytes for the matrices, `viewPos` and the material, 64 for
`dirLight`, 4 × 80 for `pointLights` and 96 for `spotLight` – 640 bytes, every field at the same offset in HLSL and
C++. A constant buffer view must be a multiple of 256 bytes, so `CalculateConstantBufferByteSize` rounds the buffer
and its view up to 768; the project already uses it, so nothing else changes.
:::

Now do the task **spot-light**. When you build and run it, a bright disc appears on container 0, where the flashlight
hits it: the wood in the centre and the steel frame around it become almost twice as bright, the frame near white.
The corners of container 0 and all the other containers stay exactly as they were.

```quiz
After the task **spot-light** the corners of container 0 and all the other containers look exactly as before. Why does the flashlight add nothing there?
- [ ] The spotlight is only computed for fragments of container 0
- [x] Those fragments lie outside the outer cone, so `intensity` is 0 – and since the flashlight's ambient is (0, 0, 0) and the ambient term is multiplied by the intensity too, its contribution there is exactly zero
- [ ] The attenuation of the spotlight is 0 for every fragment further than 3 units away
---
`CalcSpotLight` multiplies all three terms by `attenuation * intensity`. Outside 15° the clamped intensity is 0, so the function returns black, and adding black to `result` changes nothing.
```

```quiz
In the centre of container 0 the six lights together give a colour whose components can add up to more than 1.0. What happens to such a value?
- [ ] The whole colour is divided by its largest component, so the hue stays the same
- [ ] The value wraps around and becomes dark again
- [x] It is clamped to 1.0 when it is written to the window's image, which stores normalized 8-bit values – brightly lit parts saturate towards white
---
The window's image holds each component as 0–255, i.e. 0.0–1.0. Higher results are simply clamped, which is why the top of container 0's steel frame comes out nearly white (255 in the blue channel). Handling brightness above 1.0 properly is the subject of HDR, much later in learnopengl.
```

### The lamps

Finally, the lamps: a small white cube at each point light's position, drawn with the lamp's shaders after the
containers – learnopengl's *we now draw as many light bulbs as we have point lights*:

:::opengl
```cpp
        // also draw the lamp object(s)
        lightCubeShader.use();
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);

        // we now draw as many light bulbs as we have point lights.
        glBindVertexArray(lightCubeVAO);
        for (unsigned int i = 0; i < 4; i++)
        {
            model = glm::mat4(1.0f);
            model = glm::translate(model, pointLightPositions[i]);
            model = glm::scale(model, glm::vec3(0.2f)); // make it a smaller cube
            lightCubeShader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
```
:::
:::vulkan
In `recordCommandBuffer()`, after the containers' loop, we bind the lamp's pipeline once; the descriptor set stays
bound (both pipelines use the same pipeline layout), and in the loop only the pushed model matrix changes:

```cpp
        // also draw the lamp objects
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, lightCubePipeline);

        // we now draw as many light bulbs as we have point lights.
        for (unsigned int i = 0; i < 4; i++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, pointLightPositions[i]);
            model = glm::scale(model, glm::vec3(0.2f)); // make it a smaller cube
            constants.model = model;
            vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

            vkCmdDraw(commandBuffer, static_cast<uint32_t>(vertices.size()), 1, 0, 0);
        }
```
:::
:::d3d12
In `PopulateCommandList`, after the containers' loop, we switch to the lamp's pipeline state once; the root signature
and its tables stay set, and in the loop only the model matrix in the root constants changes. DirectXMath multiplies
row vectors, so the scaling comes first and the translation second:

```cpp
    // also draw the lamp object(s): with the lamp's pipeline state, a small cube (scale 0.2)
    // at each point light's position
    m_commandList->SetPipelineState(m_lightCubePipelineState.Get());
    for (UINT i = 0; i < 4; i++)
    {
        XMMATRIX model = XMMatrixScaling(0.2f, 0.2f, 0.2f) * XMMatrixTranslation(pointLightPositions[i].x, pointLightPositions[i].y, pointLightPositions[i].z);
        XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
        m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
        m_commandList->DrawInstanced(36, 1, 0, 0);
    }
```
:::

Now do the last task, **lamps**. Then build and run it – and look closely, because almost nothing changes. With the
camera at (0, 0, 3) looking down -z:

- lamp 1 at (0.7, 0.2, 2.0) is only one unit in front of the camera and mostly outside the view: you see just a thin
  white sliver at the right border of the window;
- lamp 2 at (2.3, -3.3, -4.0) is below the bottom edge of the window;
- lamp 3 at (-4.0, 2.0, -12.0) is hidden behind container 9, near the top left;
- lamp 4 at (0.0, 0.0, -3.0) is straight behind container 0.

The code is right all the same: four more draw calls with the lamp's shaders. On your own computer, step back with S
and look around with the mouse, and the four lamps appear where the light comes from.

```quiz
After the task **lamps** you only see a thin white sliver at the right border. Where are the other lamps?
- [ ] They are drawn black, because the lamp shader has no light
- [x] With the camera at (0, 0, 3) one is below the window, and two are behind containers 9 and 0, so the depth test hides them
- [ ] They are not drawn, because only the first lamp's model matrix is pushed
---
All four lamps are drawn every frame. The camera just isn't placed to see them: lamp 2 is out of view, lamps 3 and 4 fail the depth test behind closer containers, and lamp 1 is mostly beside the view.
```

As you can see, there appears to be some form of a global light (like a sun) somewhere in the sky, we have 4 lights
scattered throughout the scene and a flashlight is visible from the player's perspective. Looks pretty neat doesn't
it?

All the light sources use the default light properties we've used in the previous chapters, but if you play around
with these values you can get pretty interesting results. Artists and level designers generally
tweak all these lighting variables in a large editor to make sure the lighting matches the environment. Using our
simple lighting environment you can already create some pretty interesting visuals simply by tweaking the lights'
attributes.

learnopengl shows this with four pictures of the same scene – a desert, a factory, a horror scene and a biochemical
lab – where only the lights' attributes and the clear color (changed to better reflect the lighting) differ: by
simply adjusting some of the lighting parameters you can create completely different atmospheres.

You should now have a pretty good understanding of lighting in {{api}}. With the knowledge so far we can already
create interesting and visually rich environments and atmospheres. Try playing around with all the different values
to create your own atmospheres.

## Exercises

- Can you (sort of) re-create the different atmospheres of learnopengl's last image – a **desert**, a **factory**, a
  **horror** scene and a **biochemical lab** – by tweaking the light's attribute values?

:::opengl
This is not a task in the project: try it once you have finished the tasks, and use **Build & run** to compare. Change
the clear colour in `glClearColor` and the lights' colours in the render loop. For a desert, for example, make
everything warm: a yellowish clear colour, a strong yellow-white directional light and orange point lights. For a
horror scene, an almost black clear colour, a very weak directional light, dim reddish point lights with a short range
(linear 0.14, quadratic 0.07 or smaller ranges from the table in *Light casters*) and a narrow flashlight. Remember to
give the lamps the point lights' colours too if you want them to match – that needs a colour uniform in
`light_cube.fs`.
:::
:::vulkan
This is not a task in the project: try it once you have finished the tasks, and use **Build & run** to compare. Change
the clear colour (`clearValues[0].color` in `recordCommandBuffer()`) and the lights' colours in
`updateUniformBuffer()`. For a desert, for example, make everything warm: a yellowish clear colour, a strong
yellow-white directional light and orange point lights. For a horror scene, an almost black clear colour, a very weak
directional light, dim reddish point lights with a short range (linear 0.14, quadratic 0.07 or smaller ranges from the
table in *Light casters*) and a narrow flashlight. If you want the lamps to show the point lights' colours too, give
the lamp shader a colour – for example in the push constants.
:::
:::d3d12
This is not a task in the project: try it once you have finished the tasks, and use **Build & run** to compare. Change
the clear colour (`clearColor` in `PopulateCommandList`) and the lights' colours in `OnUpdate`. For a desert, for
example, make everything warm: a yellowish clear colour, a strong yellow-white directional light and orange point
lights. For a horror scene, an almost black clear colour, a very weak directional light, dim reddish point lights with
a short range (linear 0.14, quadratic 0.07 or smaller ranges from the table in *Light casters*) and a narrow
flashlight. If you want the lamps to show the point lights' colours too, give `light_cube.hlsl` a colour – for example
in the root constants.
:::

This was the last chapter of the *Lighting* part. Everything you've learned here – the Phong model, materials,
lighting maps and light casters – is the base that the rest of learnopengl builds on.
