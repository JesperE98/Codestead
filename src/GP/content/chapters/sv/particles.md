# Partiklar

En *partikel* är, sett från {{api}}s perspektiv, en liten 2D-rektangel som alltid är vänd mot kameran (billboarding) och
(oftast) har en textur där stora delar av spriten är genomskinliga. En enskild partikel är i praktiken bara en sprite,
som vi har använt flitigt, men när du lägger ihop hundratals eller till och med tusentals sådana partiklar kan du skapa
fantastiska effekter.

När man arbetar med partiklar finns det oftast ett objekt som kallas *partikelsändare* (particle emitter) eller
*partikelgenerator*, som från sin plats hela tiden skapar nya partiklar som tynar bort med tiden. Om en sådan sändare till
exempel skapade små partiklar med en rökliknande textur, färgade dem mindre ljust ju längre från sändaren de kom och gav
dem ett glödande utseende, skulle du få en eldliknande effekt.

En enskild partikel har ofta en livsvariabel som sakta minskar efter att den har skapats. När dess liv är under en viss
gräns (oftast 0) dödar vi partikeln, så att den kan ersättas av en ny partikel nästa gång en skapas. En partikelsändare
styr alla partiklar den har skapat och ändrar deras beteende utifrån deras attribut. En partikel har i allmänhet
följande attribut: en position, en hastighet, en färg och sitt liv.

Idén är att skapa en partikelsändare som hela tiden skapar partiklar vid bollen, så att ett spår av mjuka, glödande
partiklar följer bollen genom trädgården. Kursens partikeltextur, `textures/particle.png`, är ett mjukt vitt sken på
64 × 64 som tonar ut till genomskinligt mot kanterna (learnopengl använder en egen partikeltextur här).

## Partiklar

Partikelsändaren hanterar alla partiklar. learnopengl skriver en struct `Particle` och en klass `ParticleGenerator`;
kursen skriver klassen som en struct med fria funktioner, som överallt i spelet. En partikel:

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

En död partikel har livet 0 – vilket varje partikel har från början. Generatorn håller alla, ett fast antal (`amount`),
och det den behöver för att rita dem:

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

Shadern, texturen (som sitt ID, som ett spelobjekts sprite) och rektangelns VAO är learnopengls renderingstillstånd.
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

learnopengls renderingstillstånd på Vulkans vis: "shadern" är partikelpipelinen, texturen dess descriptor set (som ett
spelobjekts sprite), learnopengls VAO rektangelns vertex buffer – och, som i `SpriteRenderer`, pipelinelayouten och
command buffern som spelas in (`recordCommandBuffer` sätter `Particles.commandBuffer = commandBuffer;` bredvid
renderarens).
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

Shadern är ett pipeline state object, texturen dess ID – vyns plats i heapen, som ett spelobjekts sprite –, learnopengls
VAO rektangelns vertex buffer och dess vy.
:::

learnopengls konstruktor anropar en privat `init()`, som skapar rektangeln och `amount` döda partiklar; kursen skriver den
som `InitParticles`, samma mönster som sprite-renderarens `InitRenderData`:

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

En medlem i applikationsklassen: den skapar en buffer med enheten.
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

Rektangeln är sprite-rektangeln: (0, 0) till (1, 1), position och texturkoordinater i en `vec4`. I `Init`, efter att
texturerna har laddats, blir learnopengls `new ParticleGenerator(shader, texture, 500)`:

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

Femhundra partiklar är learnopengls tal – mycket fler än spåret behöver åt gången, som vi ska se.

## Partikelshadern

För att rendera partiklarna använder vi en annan uppsättning shaders. Partiklarna ritas som små rektanglar, så vertex
shadern skalar enhetsrektangeln till 10 × 10 pixlar och flyttar den till partikelns position (`offset`), och fragment
shadern multiplicerar texturen med partikelns färg:

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

med uniforms `projection`, `offset`, `color` och samplern `sprite`. I `Init` laddas shadern som `"particle"` och ställs in
som sprite-shadern – samplern på enhet 0, samma projektion:

```cpp
    LoadShader("particle.vs", "particle.fs", nullptr, "particle");
```

Shaderfunktionerna får två setters för de nya uniform-typerna, `SetVector2f` (`glUniform2f`) och `SetVector4f`
(`glUniform4f`), skrivna som `SetVector3f`.
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

Projektionen kommer från uniform buffern (binding 0), texturen är binding 1, som i sprite-shadern; learnopengls två
uniforms per partikel är ett push constant-block, `ParticleConstants { vec2 offset; vec4 color; }`. C++-sidan kräver
omsorg om layouten:

```cpp
struct ParticleConstants {
    glm::vec2 offset;
    alignas(16) glm::vec4 color;
};
```

I ett push constant-block börjar en `vec4` på en multipel av 16 byte, så `color` ligger på byte 16, efter de 8 byten i
`offset`. C++ skulle lägga en `glm::vec4` direkt efter `glm::vec2`, på byte 8; `alignas(16)` flyttar den till 16. De 32
byten ryms i pipelinelayoutens push constant-intervall (76 byte, sprites `PushConstants`): båda pipelines delar på den
enda layouten.
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

learnopengls två uniforms per partikel är root constants på b0 – 8 av root signaturens 19. C++-sidan kräver omsorg om
layouten:

```cpp
struct ParticleConstants
{
    XMFLOAT2 offset;
    XMFLOAT2 padding;
    XMFLOAT4 color;
};
```

HLSL packar en constant buffer i rader på 16 byte och låter inte en `float4` gränsla två av dem, så `color` börjar på
byte 16, efter de 8 byten i `offset`; C++-structen fyller ut 8 byte för att stämma. Projektionen är constant buffern på
b1, sprites – learnopengls "ställ in partikelshadern med samma projektion" behöver ingen kod här.
:::

```quiz
En partikels `Color` är (rColor, rColor, rColor, 1) med rColor mellan 0.5 och 1.49, och partikeltexturen är ett vitt sken. Vad ger fragment shaderns `texture × color`?
- [ ] En färgad partikel: texturens färgton gånger färgen
- [x] Ett grått till vitt sken, ljusast i mitten, som tonar ut mot rektangelns kanter där texturen är genomskinlig
- [ ] En helt vit kvadrat på 10 × 10 pixlar
- [ ] Svart: värden över 1 är inte tillåtna
---
Texturen ger formen och den mjuka kanten (dess alfa), färgen ljusstyrkan. En färg över 1 kläms till 1 när den skrivs; den slumpade ljusstyrkan gör spåret lite ojämnt, som gnistor.
```

## Uppdatera partiklarna

Generatorns uppdateringsfunktion anropas varje bildruta. Den skapar nya partiklar vid ett objekt och låter alla levande
åldras:

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

Alfa är `p.Color.w` – den fjärde komponenten i en `XMFLOAT4`, glm:s `.a`.
:::

Den har learnopengls namn, `Update`, som spelets `Update(Game&, float)` – en överlagring: C++ väljer en utifrån
argumenten. Den första loopen kan se lite skrämmande ut. Eftersom partiklar dör med tiden vill vi skapa `newParticles`
partiklar varje bildruta, men eftersom vi inte vill fortsätta skapa nya partiklar i all oändlighet (då tar minnet snabbt
slut) skapar vi bara upp till högst `amount`. Om vi lade alla nya partiklar sist i listan skulle vi snabbt få en lista
med tusentals partiklar. Det är inte särskilt effektivt, med tanke på att bara en liten del av listan innehåller
partiklar som faktiskt lever.

Det vi vill är att hitta den första partikeln som är död (liv < 0.0f) och uppdatera den som en ny, återuppväckt partikel:

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

Funktionen sparar indexet för den senaste döda partikeln den hittade. Eftersom nästa döda partikel troligast ligger
direkt efter det indexet söker vi först därifrån. Hittar vi ingen död partikel på det sättet gör vi helt enkelt en
långsammare linjär sökning. Om ingen partikel är död returnerar den index 0, vilket gör att den första partikeln skrivs
över. Observera att om det här sista fallet inträffar ofta bör du reservera fler partiklar.

När den första döda partikeln i listan har hittats uppdaterar vi dess värden genom att anropa `respawnParticle`, som tar
partikeln, ett `GameObject` och en förskjutningsvektor:

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

`XMVectorReplicate(random)` lägger till samma tal till x och y, som glm:s `object.Position + random + offset` gör.
:::

Funktionen återställer helt enkelt partikelns liv till 1.0f, ger den en slumpad ljusstyrka (via färgvektorn) från 0.5
och uppåt och tilldelar en (lite slumpad) position och hastighet utifrån spelobjektets data. Den slumpade förskjutningen
−5.0 … +4.9 läggs till *båda* komponenterna – samma tal –, så partiklarna sprids längs en diagonal linje kring
startpunkten. Hastigheten är en tiondel av objektets, och uppdateringen *drar av* den: partiklarna driver sakta åt
motsatt håll mot bollen, vilket lämnar dem efter den som ett spår.

Den andra partikelloopen i uppdateringsfunktionen går igenom alla partiklar och minskar för var och en livet med delta
time; på så sätt motsvarar varje partikels liv exakt den sekund den får leva. Sedan kontrollerar vi om partikeln lever,
och i så fall uppdaterar vi dess position och färg. Vi minskar också sakta alfakomponenten i varje partikel så att det
ser ut som om de långsamt försvinner – och ganska snabbt: `2.5f` per sekund betyder att alfa når 0 efter 0.4 s, 24
bildrutor, medan partikeln lever en hel sekund, 60 bildrutor. Under de sista 36 bildrutorna av sitt liv är en partikel
fortfarande "levande" och ritas, men med ett alfa på 0 eller lägre bidrar den inte med något till bilden.

**rand().** `rand()` returnerar talen i en fast följd; utan `srand` (learnopengl anropar ingen) börjar varje körning med
samma frö, 1, och får samma tal. Kursens bilder använder glibc:s följd – Linux C-bibliotek, som simulatorn också följer.
:::d3d12
Ett Direct3D 12-program körs på Windows och får Microsofts C-runtimes `rand()`: en annan följd (med `RAND_MAX` 32767), så
på en riktig Windows-dator skiljer sig partiklarnas slumpade förskjutningar och ljusstyrkor lite från kursens bilder –
spårets plats och utseende förblir desamma.
:::

I spelets `Update`, efter kollisionerna, skapar generatorn 2 partiklar per bildruta vid bollen, förskjutna med halva
radien:

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

(`glm::vec2(r / 2)` sätter båda komponenterna; `XMFLOAT2` behöver båda utskrivna.)
:::

Bollen skickas som sin `GameObject`-del, som i `DrawObject`. Förskjutningen flyttar partiklarna från bollens övre vänstra
hörn mot dess mitt; en partikelrektangel på 10 × 10 hamnar då på bollens övre vänstra del.

Gör nu uppgifterna **particle-shader**, **particle-generator** och **spawn**: shadern och dess inställning, structarna och
`InitParticles`, och uppdateringsfunktionerna med anropet. Partiklarna lever nu, men ingenting ritar dem, så bilden – vid
**2.0 s**, bollen på väg ned efter sin studs mot stenen – ändras inte ännu.

```quiz
Två partiklar skapas varje bildruta, var och en lever 60 bildrutor, men dess alfa når 0 efter 24. Ungefär hur många partiklar lever samtidigt när spåret har byggts upp, och hur många av dem syns?
- [ ] 500 lever, 500 syns: generatorns amount
- [ ] 2 lever och syns: bara de nyaste
- [x] Ungefär 120 lever (2 × 60), men bara ungefär 48 syns (2 × 24) – de andra ritas med ett alfa på 0 eller lägre
- [ ] 60 lever, 24 syns
---
De 500 används aldrig alla: `firstUnusedParticle` återanvänder hela tiden döda, så generatorn behöver aldrig fler än ungefär 120. learnopengls tal gör spåret kort; en långsammare uttoning (en mindre faktor än 2.5) skulle göra det längre.
```

## Rendera partiklarna

Allt som återstår är att rendera partiklarna:

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

Här sätter vi för varje partikel dess uniforms offset och color, binder texturen och renderar 2D-rektangeln. Det som är
intressant att notera är de två anropen av `glBlendFunc`. När partiklarna renderas använder vi i stället för standardens
destinationsfaktor `GL_ONE_MINUS_SRC_ALPHA` blendläget `GL_ONE` (additivt), som ger partiklarna en snygg glödeffekt när de
staplas på varandra. Det är troligen också blendläget som används för att rendera eld i ett spel, eftersom eld glöder mer
i mitten, där de flesta partiklarna finns. Efteråt sätts standardblendingen tillbaka – annars skulle bollen, som ritas
härnäst, och nästa bildrutas bakgrund och block också adderas.
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

Här pushar vi för varje partikel dess förskjutning och färg, binder texturens descriptor set och rektangeln, och ritar
2D-rektangeln. learnopengl byter blendfunktion runt partikelritningen med `glBlendFunc`: i stället för standardens
destinationsfaktor `GL_ONE_MINUS_SRC_ALPHA` använder den `GL_ONE` – *additiv* blending, som ger partiklarna en snygg
glödeffekt när de staplas på varandra (det är troligen också blendläget som används för att rendera eld i ett spel,
eftersom eld glöder mer i mitten, där de flesta partiklarna finns). **I Vulkan är blendingen en del av pipelinen**, så
partiklarna får en egen pipeline. `createPipeline` och `LoadShader` får en parameter för destinationens färgfaktor:

```cpp
        colorBlendAttachment.dstColorBlendFactor = dstColorBlendFactor;
```

och `Init` skapar de två pipelines med samma hjälpfunktion:

```cpp
        LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA);
        LoadShader("shaders/particle.vert.spv", "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE); // additive blending
```

Det finns ingenting att återställa efter partiklarna: bollens `DrawSprite` binder sprite-pipelinen, med dess
alfablending, igen.
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

Här sätter vi för varje partikel dess root constants (förskjutning och färg), texturens descriptor-tabell och
rektangeln, och ritar 2D-rektangeln. learnopengl byter blendfunktion runt partikelritningen med `glBlendFunc`: i stället
för standardens destinationsfaktor `GL_ONE_MINUS_SRC_ALPHA` använder den `GL_ONE` – *additiv* blending, som ger
partiklarna en snygg glödeffekt när de staplas på varandra (det är troligen också blendläget som används för att rendera
eld i ett spel, eftersom eld glöder mer i mitten, där de flesta partiklarna finns). **I Direct3D 12 är blendingen en del
av pipeline state objectet**, så partikelshadern får en egen PSO: `Compile` får en parameter
`D3D12_BLEND destBlend = D3D12_BLEND_INV_SRC_ALPHA`, som tilldelas `DestBlend` och `DestBlendAlpha` (glBlendFunc sätter
båda), och `LoadShader` skickar den vidare:

```cpp
    LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE);
```

Det finns ingenting att återställa efter partiklarna: bollens `DrawSprite` sätter sprite-PSO:n, med dess alfablending,
igen.
:::

Med additiv blending adderas färgerna för överlappande partiklar: där flera nya partiklar överlappar går summan snabbt
över 1 och kläms till vitt – spårets ljusa kärna –, medan de äldre, svagare partiklarna bara lägger till lite till
himlen bakom dem. Blendingen räknar `src.rgb × src.a + dst.rgb`: en partikels eget alfa avgör fortfarande hur mycket den
lägger till, och därför tonar spåret ut när alfa tonar ut.

learnopengl ritar varje levande partikel med ett eget ritanrop – ungefär 120 per bildruta här. På en riktig GPU är det
det långsamma sättet: *instancing* (kapitlet Instancing) skulle rita alla med ett anrop, från en buffer med
förskjutningar och färger. Kursen behåller learnopengls loop.

Till sist ritas partiklarna i `Render` **efter racketen och före bollen**:

```cpp
        // draw particles
        DrawParticles(Particles);
```

så att bollen täcker de nyaste partiklarna, som skapas under den, och spåret verkar komma fram bakom den.

Gör nu uppgiften **draw-particles**. Tryck på **Build & run**: **ett glödande spår följer bollen**, från dess övre vänstra
del tillbaka upp mot stenen den studsade mot – vitt där de nyaste partiklarna överlappar, uttonande längre bak.

:::opengl
```quiz
Varför anropar `DrawParticles` `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)` i slutet?
- [ ] Därför att partikelshadern behöver det för sitt nästa ritanrop
- [x] Därför att blendfunktionen är globalt OpenGL-tillstånd: utan återställningen skulle bollen som ritas härnäst, och nästa bildrutas bakgrund, block och racket, adderas till det som ligger bakom i stället för att täcka det
- [ ] Därför att partiklarna annars skulle ritas två gånger
- [ ] Därför att `GL_ONE` bara är tillåtet inuti en loop
---
OpenGL:s tillståndsmaskin behåller det som sattes sist. En funktion som ändrar globalt tillstånd för sina egna ritanrop bör sätta tillbaka det – eller så ska varje ritanrop sätta det tillstånd det behöver.
```
:::
:::vulkan
```quiz
learnopengl återställer `glBlendFunc` efter att partiklarna har ritats. Varför återställer Vulkan-versionens `DrawParticles` ingenting?
- [ ] Därför att Vulkan inte har någon blending
- [ ] Därför att push constants återställer blendingen efter varje ritanrop
- [x] Därför att blendfaktorerna är en del av varje pipeline: partikelpipelinen adderar (`VK_BLEND_FACTOR_ONE`), och bollens `DrawSprite` binder sprite-pipelinen med dess egen alfablending igen
- [ ] Därför att render passet slutar efter partiklarna
---
Två pipelines som bara skiljer sig i en blendfaktor. Att binda en pipeline sätter hela dess tillstånd på en gång – ingenting följer med från förra ritanropet.
```
:::
:::d3d12
```quiz
learnopengl återställer `glBlendFunc` efter att partiklarna har ritats. Varför återställer Direct3D 12-versionens `DrawParticles` ingenting?
- [ ] Därför att root constants återställer blendingen efter varje ritanrop
- [ ] Därför att Direct3D 12 blendar additivt som standard
- [ ] Därför att command listen stängs efter partiklarna
- [x] Därför att blend-tillståndet är en del av varje pipeline state object: partikel-PSO:n adderar (`D3D12_BLEND_ONE`), och bollens `DrawSprite` sätter sprite-PSO:n med dess egen alfablending igen
---
Två PSO:er som bara skiljer sig i destinationens blendfaktor. Att sätta en pipeline state sätter hela dess tillstånd på en gång – ingenting följer med från förra ritanropet.
```
:::

```quiz
Partiklarna ritas efter racketen och före bollen. Vad skulle ändras om de ritades efter bollen?
- [ ] Ingenting: med additiv blending spelar ritordningen aldrig någon roll
- [ ] Partiklarna skulle inte längre synas
- [x] De nyaste partiklarna, som skapas på bollens övre vänstra del, skulle glöda ovanpå bollen i stället för att döljas under den
- [ ] Bollen skulle adderas till partiklarna och bli vit
---
Additiva partiklar sinsemellan kan ritas i vilken ordning som helst (additionen bryr sig inte), men bollen ritas med vanlig alfablending: det som ritas efter den täcker den eller läggs till den.
```

## Mer att läsa

- [Particles](https://learnopengl.com/In-Practice/2D-Game/Particles): learnopengls kapitel som det här kapitlet följer.
- [std::rand](https://en.cppreference.com/w/cpp/numeric/random/rand): slumptalen, och varför varje körning får samma tal
  utan `srand`.

:::opengl
- [glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlendFunc.xhtml): blendfaktorerna.
:::
:::vulkan
- [Color blending (Vulkan Tutorial)](https://vulkan-tutorial.com/Drawing_a_triangle/Graphics_pipeline_basics/Fixed_functions):
  blendfaktorerna i pipelinen.
:::
:::d3d12
- [D3D12_BLEND](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ne-d3d12-d3d12_blend): blendfaktorerna.
:::
