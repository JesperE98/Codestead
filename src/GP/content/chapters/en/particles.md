# Particles

A *particle*, as seen from {{api}}'s perspective, is a tiny 2D quad that is always facing the camera (billboarding)
and (usually) contains a texture with large parts of the sprite being transparent. A particle by itself is effectively
just a sprite as we've been using extensively, but when you put together hundreds or even thousands of these particles
together you can create amazing effects.

When working with particles, there is usually an object called a *particle emitter* or *particle generator* that,
from its location, continuously spawns new particles that decay over time. If such a particle emitter would for
example spawn tiny particles with a smoke-like texture, color them less bright the larger the distance from the
emitter, and give them a glowy appearance, you'd get a fire-like effect.

A single particle often has a life variable that slowly decays once it's spawned. Once its life is less than a certain
threshold (usually 0), we kill the particle so it can be replaced with a new particle when the next particle spawns. A
particle emitter controls all its spawned particles and changes their behavior based on their attributes. A particle
generally has the following attributes: a position, a velocity, a colour and its life.

The idea is to create a particle emitter that continuously spawns particles at the ball, so that a trail of soft,
glowing particles follows the ball through the garden. The course's particle texture, `textures/particle.png`, is a
64 × 64 soft white glow that fades to transparent towards its edges (learnopengl uses its own particle texture here).

## Particles

The particle emitter manages all the particles. learnopengl writes a `Particle` struct and a `ParticleGenerator`
class; the course writes the class as a struct with free functions, as everywhere in the game. A particle:

:::opengl
```cpp
struct Particle
{
    glm::vec2 Position = glm::vec2(0.0f), Velocity = glm::vec2(0.0f);
    glm::vec4 Color = glm::vec4(1.0f);
    float     Life = 0.0f;
};
```
:::
:::vulkan
```cpp
struct Particle {
    glm::vec2 Position = glm::vec2(0.0f), Velocity = glm::vec2(0.0f);
    glm::vec4 Color = glm::vec4(1.0f);
    float     Life = 0.0f;
};
```
:::
:::d3d12
```cpp
struct Particle
{
    XMFLOAT2 Position = XMFLOAT2(0.0f, 0.0f), Velocity = XMFLOAT2(0.0f, 0.0f);
    XMFLOAT4 Color = XMFLOAT4(1.0f, 1.0f, 1.0f, 1.0f);
    float    Life = 0.0f;
};
```
:::

A dead particle has a life of 0 – which every particle has to begin with. The generator holds all of them, a fixed
`amount`, and what it needs to draw them:

:::opengl
```cpp
struct ParticleGenerator
{
    // state
    std::vector<Particle> particles;
    unsigned int          amount = 0;
    // render state
    Shader                shader;
    unsigned int          texture = 0; // the texture's ID
    unsigned int          VAO = 0;
};
```

The shader, the texture (as its ID, like a game object's sprite) and the quad's VAO are learnopengl's render state.
:::
:::vulkan
```cpp
struct ParticleGenerator {
    // state
    std::vector<Particle> particles;
    unsigned int          amount = 0;
    // render state
    VkPipeline       shader = VK_NULL_HANDLE;  // the particle pipeline (additive blending)
    VkDescriptorSet  texture = VK_NULL_HANDLE; // the particle texture's descriptor set
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE; // learnopengl's VAO: the particle quad
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE; // the command buffer being recorded this frame
};
```

learnopengl's render state in Vulkan's terms: the "shader" is the particle pipeline, the texture its descriptor set
(like a game object's sprite), learnopengl's VAO the quad's vertex buffer – and, as in the `SpriteRenderer`, the pipeline
layout and the command buffer being recorded (`recordCommandBuffer` sets `Particles.commandBuffer = commandBuffer;`
next to the renderer's).
:::
:::d3d12
```cpp
struct ParticleGenerator
{
    // state
    std::vector<Particle>    particles;
    unsigned int             amount = 0;
    // render state
    Shader                   shader;
    unsigned int             texture = 0; // the texture's ID (its view's slot in the heap)
    ComPtr<ID3D12Resource>   quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW quadVertexBufferView = {};
};
```

The shader is a pipeline state object, the texture its ID – its view's slot in the heap, like a game object's sprite –,
learnopengl's VAO the quad's vertex buffer and its view.
:::

learnopengl's constructor calls a private `init()`, which creates the quad and `amount` dead particles; the course
writes it as `InitParticles`, the same pattern as the sprite renderer's `InitRenderData`:

:::opengl
```cpp
void InitParticles(ParticleGenerator& generator)
{
    // set up mesh and attribute properties
    unsigned int VBO;
    float particle_quad[] = {
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
    glGenVertexArrays(1, &generator.VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(generator.VAO);
    // fill mesh buffer
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(particle_quad), particle_quad, GL_STATIC_DRAW);
    // set mesh attributes
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glBindVertexArray(0);

    // create generator.amount default particle instances
    for (unsigned int i = 0; i < generator.amount; ++i)
        generator.particles.push_back(Particle());
}
```
:::
:::vulkan
```cpp
    void InitParticles(ParticleGenerator& generator) {
        generator.pipelineLayout = pipelineLayout;
        // set up mesh and attribute properties
        const std::vector<Vertex> particle_quad = {
            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}},
            {{0.0f, 0.0f, 0.0f, 0.0f}},

            {{0.0f, 1.0f, 0.0f, 1.0f}},
            {{1.0f, 1.0f, 1.0f, 1.0f}},
            {{1.0f, 0.0f, 1.0f, 0.0f}}
        };
        VkDeviceSize bufferSize = sizeof(particle_quad[0]) * particle_quad.size();

        createBuffer(bufferSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, generator.quadBuffer, generator.quadBufferMemory);

        void* data;
        vkMapMemory(device, generator.quadBufferMemory, 0, bufferSize, 0, &data);
            memcpy(data, particle_quad.data(), (size_t) bufferSize);
        vkUnmapMemory(device, generator.quadBufferMemory);

        // create amount default particle instances
        for (unsigned int i = 0; i < generator.amount; ++i)
            generator.particles.push_back(Particle());
    }
```

A member of the application class: it creates a buffer with the device.
:::
:::d3d12
```cpp
void InitParticles(ParticleGenerator& generator)
{
    // set up mesh and attribute properties: the same unit quad as the sprites, in an upload heap
    float particle_quad[] = {
        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 0.0f,

        0.0f, 1.0f, 0.0f, 1.0f,
        1.0f, 1.0f, 1.0f, 1.0f,
        1.0f, 0.0f, 1.0f, 0.0f
    };
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_UPLOAD);
    CD3DX12_RESOURCE_DESC bufferDesc = CD3DX12_RESOURCE_DESC::Buffer(sizeof(particle_quad));
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &bufferDesc,
        D3D12_RESOURCE_STATE_GENERIC_READ,
        nullptr,
        IID_PPV_ARGS(&generator.quadVertexBuffer)));

    UINT8* pVertexDataBegin = nullptr;
    CD3DX12_RANGE readRange(0, 0);        // We do not intend to read from this resource on the CPU.
    ThrowIfFailed(generator.quadVertexBuffer->Map(0, &readRange, reinterpret_cast<void**>(&pVertexDataBegin)));
    memcpy(pVertexDataBegin, particle_quad, sizeof(particle_quad));
    generator.quadVertexBuffer->Unmap(0, nullptr);

    generator.quadVertexBufferView.BufferLocation = generator.quadVertexBuffer->GetGPUVirtualAddress();
    generator.quadVertexBufferView.StrideInBytes = 4 * sizeof(float);
    generator.quadVertexBufferView.SizeInBytes = sizeof(particle_quad);

    // create generator.amount default particle instances
    for (unsigned int i = 0; i < generator.amount; ++i)
        generator.particles.push_back(Particle());
}
```
:::

The quad is the sprite quad: (0, 0) to (1, 1), position and texture coordinates in one `vec4`. In `Init`, after the
textures are loaded, learnopengl's `new ParticleGenerator(shader, texture, 500)` becomes:

:::opengl
```cpp
    Particles.shader = GetShader("particle");
    Particles.texture = GetTexture("particle").ID;
    Particles.amount = 500;
    InitParticles(Particles);
```
:::
:::vulkan
```cpp
        Particles.shader = GetShader("particle");
        Particles.texture = GetTexture("particle").DescriptorSet;
        Particles.amount = 500;
        InitParticles(Particles);
```
:::
:::d3d12
```cpp
    Particles.shader = GetShader("particle");
    Particles.texture = GetTexture("particle").ID;
    Particles.amount = 500;
    InitParticles(Particles);
```
:::

Five hundred particles is learnopengl's number – far more than the trail needs at a time, as we'll see.

## The particle shader

To render the particles we use a different set of shaders. The particles are drawn as small quads, so the vertex
shader scales the unit quad to 10 × 10 pixels and moves it to the particle's position (`offset`), and the fragment
shader multiplies the texture by the particle's colour:

:::opengl
```glsl
void main()
{
    float scale = 10.0;
    TexCoords = vertex.zw;
    ParticleColor = color;
    gl_Position = projection * vec4((vertex.xy * scale) + offset, 0.0, 1.0);
}
```

```glsl
void main()
{
    color = (texture(sprite, TexCoords) * ParticleColor);
}
```

with the uniforms `projection`, `offset`, `color` and the sampler `sprite`. In `Init` the shader is loaded as
`"particle"` and configured like the sprite shader – the sampler on unit 0, the same projection:

```cpp
    LoadShader("particle.vs", "particle.fs", nullptr, "particle");
```

The shader functions gain two setters for the new uniform types, `SetVector2f` (`glUniform2f`) and `SetVector4f`
(`glUniform4f`), written like `SetVector3f`.
:::
:::vulkan
```glsl
void main() {
    float scale = 10.0f;
    TexCoords = vertex.zw;
    ParticleColor = pc.color;
    gl_Position = ubo.projection * vec4((vertex.xy * scale) + pc.offset, 0.0, 1.0);
}
```

```glsl
void main() {
    color = (texture(sprite, TexCoords) * ParticleColor);
}
```

The projection comes from the uniform buffer (binding 0), the texture is binding 1, as in the sprite shader;
learnopengl's two per-particle uniforms are a push constant block, `ParticleConstants { vec2 offset; vec4 color; }`.
The C++ side needs care with the layout:

```cpp
struct ParticleConstants {
    glm::vec2 offset;
    alignas(16) glm::vec4 color;
};
```

In a push constant block a `vec4` starts at a multiple of 16 bytes, so `color` is at byte 16, after the 8 bytes of
`offset`. C++ would put a `glm::vec4` right after the `glm::vec2`, at byte 8; `alignas(16)` moves it to 16. The 32
bytes fit into the push constant range of the pipeline layout (76 bytes, the sprites' `PushConstants`): both pipelines
share the one layout.
:::
:::d3d12
```hlsl
cbuffer ParticleConstants : register(b0)
{
    float2 offset;
    float4 color;
};

PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    float scale = 10.0f;
    result.texCoord = texCoord;
    result.particleColor = color;
    result.position = mul(float4((position * scale) + offset, 0.0f, 1.0f), projection);

    return result;
}

float4 PSMain(PSInput input) : SV_TARGET
{
    return sprite.Sample(wrapSampler, input.texCoord) * input.particleColor;
}
```

learnopengl's two per-particle uniforms are root constants at b0 – 8 of the root signature's 19. The C++ side needs care
with the layout:

```cpp
struct ParticleConstants
{
    XMFLOAT2 offset;
    XMFLOAT2 padding;
    XMFLOAT4 color;
};
```

HLSL packs a constant buffer in 16-byte rows and does not let a `float4` straddle two of them, so `color` starts at
byte 16, after `offset`'s 8 bytes; the C++ struct pads 8 bytes to match. The projection is the constant buffer at b1,
the sprites' – learnopengl's "configure the particle shader with the same projection" needs no code here.
:::

```quiz
A particle's `Color` is (rColor, rColor, rColor, 1) with rColor between 0.5 and 1.49, and the particle texture is a white glow. What does the fragment shader's `texture × color` give?
- [ ] A coloured particle: the texture's hue times the colour
- [x] A grey to white glow, brightest in the middle, fading out towards the quad's edges where the texture is transparent
- [ ] A solid white square of 10 × 10 pixels
- [ ] Black: values above 1 are not allowed
---
The texture provides the shape and the soft edge (its alpha), the colour the brightness. A colour above 1 is clamped to 1 when it is written; the random brightness makes the trail look a little uneven, like sparks.
```

## Updating the particles

The generator's update function is called every frame. It spawns new particles at an object and lets all living ones
age:

:::opengl
```cpp
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset = glm::vec2(0.0f, 0.0f))
{
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i)
    {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i)
    {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f)
        {   // particle is alive, thus update
            p.Position -= p.Velocity * dt;
            p.Color.a -= dt * 2.5f;
        }
    }
}
```
:::
:::vulkan
```cpp
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, glm::vec2 offset = glm::vec2(0.0f, 0.0f)) {
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i) {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i) {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f) { // particle is alive, thus update
            p.Position -= p.Velocity * dt;
            p.Color.a -= dt * 2.5f;
        }
    }
}
```
:::
:::d3d12
```cpp
void Update(ParticleGenerator& generator, float dt, GameObject& object, unsigned int newParticles, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))
{
    // add new particles
    for (unsigned int i = 0; i < newParticles; ++i)
    {
        int unusedParticle = firstUnusedParticle(generator);
        respawnParticle(generator.particles[unusedParticle], object, offset);
    }
    // update all particles
    for (unsigned int i = 0; i < generator.amount; ++i)
    {
        Particle& p = generator.particles[i];
        p.Life -= dt; // reduce life
        if (p.Life > 0.0f)
        {   // particle is alive, thus update
            XMStoreFloat2(&p.Position, XMLoadFloat2(&p.Position) - XMLoadFloat2(&p.Velocity) * dt);
            p.Color.w -= dt * 2.5f;
        }
    }
}
```

The alpha is `p.Color.w` – the fourth component of an `XMFLOAT4`, glm's `.a`.
:::

It has learnopengl's name, `Update`, like the game's `Update(Game&, float)` – an overload: C++ picks one by the
arguments. The first loop might look a little daunting. As particles die over time we want to spawn `newParticles`
particles each frame, but since we don't want to infinitely keep spawning new particles (we'll quickly run out of
memory this way) we only spawn up to a max of `amount`. If we were to push all new particles to the end of the list
we'll quickly get a list filled with thousands of particles. This isn't really efficient considering only a small
portion of that list has particles that are actually alive.

What we want is to find the first particle that is dead (life < 0.0f) and update that particle as a new respawned
particle:

:::opengl
```cpp
unsigned int firstUnusedParticle(ParticleGenerator& generator)
{
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}
```
:::
:::vulkan
```cpp
unsigned int firstUnusedParticle(ParticleGenerator& generator) {
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i) {
        if (generator.particles[i].Life <= 0.0f) {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i) {
        if (generator.particles[i].Life <= 0.0f) {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}
```
:::
:::d3d12
```cpp
unsigned int firstUnusedParticle(ParticleGenerator& generator)
{
    // first search from last used particle, this will usually return almost instantly
    for (unsigned int i = lastUsedParticle; i < generator.amount; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // otherwise, do a linear search
    for (unsigned int i = 0; i < lastUsedParticle; ++i)
    {
        if (generator.particles[i].Life <= 0.0f)
        {
            lastUsedParticle = i;
            return i;
        }
    }
    // all particles are taken, override the first one (note that if it repeatedly hits this case, more particles should be reserved)
    lastUsedParticle = 0;
    return 0;
}
```
:::

The function stores the index of the last dead particle it found. Since the next dead particle will most likely be
right after the last particle index, we first search from this stored index. If we found no dead particles this way,
we simply do a slower linear search. If no particles are dead, it will return index 0 which results in the first
particle being overwritten. Note that if it reaches this last case often, you should consider allocating more
particles.

Then, once the first dead particle in the list is found, we update its values by calling `respawnParticle` that takes
the particle, a `GameObject`, and an offset vector:

:::opengl
```cpp
void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = glm::vec2(0.0f, 0.0f))
{
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    particle.Position = object.Position + random + offset;
    particle.Color = glm::vec4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    particle.Velocity = object.Velocity * 0.1f;
}
```
:::
:::vulkan
```cpp
void respawnParticle(Particle& particle, GameObject& object, glm::vec2 offset = glm::vec2(0.0f, 0.0f)) {
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    particle.Position = object.Position + random + offset;
    particle.Color = glm::vec4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    particle.Velocity = object.Velocity * 0.1f;
}
```
:::
:::d3d12
```cpp
void respawnParticle(Particle& particle, GameObject& object, XMFLOAT2 offset = XMFLOAT2(0.0f, 0.0f))
{
    float random = ((rand() % 100) - 50) / 10.0f;
    float rColor = 0.5f + ((rand() % 100) / 100.0f);
    XMStoreFloat2(&particle.Position, XMLoadFloat2(&object.Position) + XMVectorReplicate(random) + XMLoadFloat2(&offset));
    particle.Color = XMFLOAT4(rColor, rColor, rColor, 1.0f);
    particle.Life = 1.0f;
    XMStoreFloat2(&particle.Velocity, XMLoadFloat2(&object.Velocity) * 0.1f);
}
```

`XMVectorReplicate(random)` adds the same number to x and y, as glm's `object.Position + random + offset` does.
:::

This function simply resets the particle's life to 1.0f, randomly gives it a brightness (via the color vector)
starting from 0.5, and assigns a (slightly random) position and velocity based on the game object's data. The random
offset −5.0 … +4.9 is added to *both* components – the same number –, so the particles scatter along a diagonal line
around the spawn point. The velocity is a tenth of the object's, and the update *subtracts* it: the particles drift
slowly in the opposite direction of the ball, which leaves them behind it as a trail.

The second particle loop within the update function loops over all particles and for each particle reduces its life
by the delta time variable; this way, each particle's life corresponds to exactly the second it's allowed to live.
Then we check if the particle is alive and if so, update its position and color attributes. We also slowly reduce the
alpha component of each particle so it looks like they're slowly disappearing over time – and quite fast: `2.5f` per
second means the alpha reaches 0 after 0.4 s, 24 frames, while the particle lives for a whole second, 60 frames. For
the last 36 frames of its life a particle is still "alive" and drawn, but with an alpha of 0 or below it adds nothing
to the picture.

**rand().** `rand()` returns the numbers of a fixed sequence; without a `srand` (learnopengl calls none) every run
starts at the same seed, 1, and gets the same numbers. The course's pictures use glibc's sequence – the C library of
Linux, which the simulator follows too.
:::d3d12
A Direct3D 12 program runs on Windows and gets the Microsoft C runtime's `rand()`: a different sequence (with a
`RAND_MAX` of 32767), so on a real Windows machine the particles' random offsets and brightnesses differ a little from
the course's pictures – the trail's place and look stay the same.
:::

In the game's `Update`, after the collisions, the generator spawns 2 particles per frame at the ball, offset by half
its radius:

:::opengl vulkan
```cpp
    // update particles
    Update(Particles, dt, Ball, 2, glm::vec2(Ball.Radius / 2.0f));
```
:::
:::d3d12
```cpp
    // update particles
    Update(Particles, dt, Ball, 2, XMFLOAT2(Ball.Radius / 2.0f, Ball.Radius / 2.0f));
```

(`glm::vec2(r / 2)` sets both components; `XMFLOAT2` needs both written out.)
:::

The ball is passed as its `GameObject` part, as in `DrawObject`. The offset moves the particles from the ball's
top-left corner towards its middle; a 10 × 10 particle quad then sits on the ball's upper left part.

Now do the tasks **particle-shader**, **particle-generator** and **spawn**: the shader and its setup, the structs and
`InitParticles`, and the update functions with the call. The particles live now, but nothing draws them, so the picture
– at **2.0 s**, the ball coming down after its bounce off the stone – does not change yet.

```quiz
Two particles spawn every frame, each lives 60 frames, but its alpha reaches 0 after 24. About how many particles are alive at once once the trail has built up, and how many of them can you see?
- [ ] 500 alive, 500 visible: the generator's amount
- [ ] 2 alive and visible: only the newest
- [x] About 120 alive (2 × 60), but only about 48 visible (2 × 24) – the others are drawn with an alpha of 0 or less
- [ ] 60 alive, 24 visible
---
The 500 are never all in use: `firstUnusedParticle` keeps reusing dead ones, so the generator never needs more than about 120. learnopengl's numbers make the trail short; a slower fade (a smaller factor than 2.5) would make it longer.
```

## Rendering the particles

All that's left to do is to render the particles:

:::opengl
```cpp
void DrawParticles(ParticleGenerator& generator)
{
    // use additive blending to give it a 'glow' effect
    glBlendFunc(GL_SRC_ALPHA, GL_ONE);
    Use(generator.shader);
    for (Particle particle : generator.particles)
    {
        if (particle.Life > 0.0f)
        {
            SetVector2f(generator.shader, "offset", particle.Position);
            SetVector4f(generator.shader, "color", particle.Color);
            glBindTexture(GL_TEXTURE_2D, generator.texture);
            glBindVertexArray(generator.VAO);
            glDrawArrays(GL_TRIANGLES, 0, 6);
            glBindVertexArray(0);
        }
    }
    // don't forget to reset to default blending mode
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
}
```

Here, for each particle, we set their offset and color uniform values, bind the texture, and render the 2D quad. What
is interesting to note here are the two calls to `glBlendFunc`. When rendering the particles, instead of the default
destination blend mode of `GL_ONE_MINUS_SRC_ALPHA`, we use the `GL_ONE` (additive) blend mode that gives the particles
a very neat glow effect when stacked onto each other. This is also likely the blend mode used when rendering fire in a
game, since fire is more 'glowy' at the center where most of the particles are. Afterwards the default blending is set
again – otherwise the ball, drawn next, and the next frame's background and bricks would be added up too.
:::
:::vulkan
```cpp
void DrawParticles(ParticleGenerator& generator) {
    // use additive blending to give it a 'glow' effect: the particle pipeline adds (VK_BLEND_FACTOR_ONE)
    vkCmdBindPipeline(generator.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, generator.shader);
    for (Particle particle : generator.particles) {
        if (particle.Life > 0.0f) {
            ParticleConstants constants{};
            constants.offset = particle.Position;
            constants.color = particle.Color;
            vkCmdPushConstants(generator.commandBuffer, generator.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(ParticleConstants), &constants);
            vkCmdBindDescriptorSets(generator.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, generator.pipelineLayout, 0, 1, &generator.texture, 0, nullptr);
            VkBuffer vertexBuffers[] = {generator.quadBuffer};
            VkDeviceSize offsets[] = {0};
            vkCmdBindVertexBuffers(generator.commandBuffer, 0, 1, vertexBuffers, offsets);
            vkCmdDraw(generator.commandBuffer, 6, 1, 0, 0);
        }
    }
    // (no reset of the blending needed: every sprite draw binds the sprite pipeline again)
}
```

Here, for each particle, we push its offset and colour, bind the texture's descriptor set and the quad, and draw the
2D quad. learnopengl switches the blend function around the particle draws with `glBlendFunc`: instead of the default
destination factor `GL_ONE_MINUS_SRC_ALPHA`, it uses `GL_ONE` – *additive* blending, which gives the particles a very
neat glow effect when stacked onto each other (this is also likely the blend mode used when rendering fire in a game,
since fire is more 'glowy' at the center where most of the particles are). **In Vulkan, blending is part of the
pipeline**, so the particles get a pipeline of their own. `createPipeline` and `LoadShader` gain a parameter for the
destination colour factor:

```cpp
        colorBlendAttachment.dstColorBlendFactor = dstColorBlendFactor;
```

and `Init` makes the two pipelines from the same helper:

```cpp
        LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA);
        LoadShader("shaders/particle.vert.spv", "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE); // additive blending
```

There is nothing to restore after the particles: the ball's `DrawSprite` binds the sprite pipeline, with its alpha
blending, again.
:::
:::d3d12
```cpp
void DrawParticles(ParticleGenerator& generator)
{
    // use additive blending to give it a 'glow' effect: the particle shader's pipeline state
    // blends with SRC_ALPHA and ONE (learnopengl's glBlendFunc(GL_SRC_ALPHA, GL_ONE)); the
    // sprites' pipeline state keeps its own blending, so nothing needs to be reset afterwards
    Use(generator.shader);
    for (Particle particle : generator.particles)
    {
        if (particle.Life > 0.0f)
        {
            ParticleConstants constants = {};
            constants.offset = particle.Position;
            constants.color = particle.Color;
            Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(ParticleConstants) / 4, &constants, 0);
            CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), generator.texture, Graphics.SrvDescriptorSize);
            Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
            Graphics.CommandList->IASetVertexBuffers(0, 1, &generator.quadVertexBufferView);
            Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
        }
    }
}
```

Here, for each particle, we set its root constants (offset and colour), the texture's descriptor table and the quad,
and draw the 2D quad. learnopengl switches the blend function around the particle draws with `glBlendFunc`: instead of
the default destination factor `GL_ONE_MINUS_SRC_ALPHA`, it uses `GL_ONE` – *additive* blending, which gives the
particles a very neat glow effect when stacked onto each other (this is also likely the blend mode used when rendering
fire in a game, since fire is more 'glowy' at the center where most of the particles are). **In Direct3D 12, blending
is part of the pipeline state object**, so the particle shader gets a PSO of its own: `Compile` gains a parameter
`D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA`, assigned to `DestBlend` and `DestBlendAlpha` (glBlendFunc sets
both), and `LoadShader` passes it on:

```cpp
    LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE);
```

There is nothing to restore after the particles: the ball's `DrawSprite` sets the sprite PSO, with its alpha blending,
again.
:::

With additive blending the colours of overlapping particles add up: where several fresh particles overlap, the sum
quickly passes 1 and is clamped to white – the bright core of the trail –, while the older, fainter particles add only
a little to the sky behind them. Blending computes `src.rgb × src.a + dst.rgb`: a particle's own alpha still decides how
much it adds, which is why the fading alpha makes the trail fade.

learnopengl draws every living particle with a draw call of its own – about 120 per frame here. On a real GPU that is
the slow way: *instancing* (the Instancing chapter) would draw them all with one call, from a buffer of offsets and
colours. The course keeps learnopengl's loop.

Finally, the particles are drawn in `Render` **after the paddle and before the ball**:

```cpp
        // draw particles
        DrawParticles(Particles);
```

so the ball covers the newest particles, which spawn under it, and the trail seems to come out from behind it.

Now do the task **draw-particles**. Press **Build & run**: **a glowing trail follows the ball**, from its upper left
back up towards the stone it bounced off – white where the newest particles overlap, fading out further back.

:::opengl
```quiz
Why does `DrawParticles` call `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` at the end?
- [ ] Because the particle shader needs it for its next draw
- [x] Because the blend function is global OpenGL state: without the reset the ball drawn next, and the next frame's background, bricks and paddle, would be added to what is behind them instead of covering it
- [ ] Because otherwise the particles would be drawn twice
- [ ] Because `GL_ONE` is only allowed inside a loop
---
OpenGL's state machine keeps whatever was set last. A function that changes global state for its own draws should put it back – or every draw should set the state it needs.
```
:::
:::vulkan
```quiz
learnopengl resets `glBlendFunc` after drawing the particles. Why does the Vulkan `DrawParticles` reset nothing?
- [ ] Because Vulkan has no blending
- [ ] Because push constants reset the blending after every draw
- [x] Because the blend factors are part of each pipeline: the particle pipeline adds (`VK_BLEND_FACTOR_ONE`), and the ball's `DrawSprite` binds the sprite pipeline with its own alpha blending again
- [ ] Because the render pass ends after the particles
---
Two pipelines that differ only in one blend factor. Binding a pipeline sets all of its state at once – nothing carries over from the previous draw.
```
:::
:::d3d12
```quiz
learnopengl resets `glBlendFunc` after drawing the particles. Why does the Direct3D 12 `DrawParticles` reset nothing?
- [ ] Because root constants reset the blending after every draw
- [ ] Because Direct3D 12 blends additively by default
- [ ] Because the command list is closed after the particles
- [x] Because the blend state is part of each pipeline state object: the particle PSO adds (`D3D12_BLEND_ONE`), and the ball's `DrawSprite` sets the sprite PSO with its own alpha blending again
---
Two PSOs that differ only in the destination blend factor. Setting a pipeline state sets all of its state at once – nothing carries over from the previous draw.
```
:::

```quiz
The particles are drawn after the paddle and before the ball. What would change if they were drawn after the ball?
- [ ] Nothing: with additive blending the order of the draws never matters
- [ ] The particles would no longer be visible
- [x] The newest particles, which spawn on the ball's upper left part, would glow on top of the ball instead of being hidden under it
- [ ] The ball would be added to the particles and turn white
---
Additive particles among themselves can be drawn in any order (addition does not care), but the ball is drawn with normal alpha blending: whatever is drawn after it covers or adds to it.
```

## Additional resources

- [Particles](https://learnopengl.com/In-Practice/2D-Game/Particles): learnopengl's chapter this chapter follows.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): the random numbers, and why every run gets the
  same ones without `srand`.

:::opengl
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): the blend factors.
:::
:::vulkan
- [Color blending (Vulkan Tutorial)](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  the blend factors in the pipeline.
:::
:::d3d12
- [D3D12_BLEND](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ne-d3d12-d3d12_blend): the blend factors.
:::
