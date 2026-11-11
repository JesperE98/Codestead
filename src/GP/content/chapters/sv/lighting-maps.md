# Ljuskartor

I förra kapitlet gick vi igenom möjligheten att ge varje föremål ett eget material som reagerar på sitt eget sätt på
ljus. Det är utmärkt för att ge varje föremål ett unikt utseende jämfört med andra föremål, men ger fortfarande inte
mycket flexibilitet i hur ett enskilt föremål ser ut.

I förra kapitlet definierade vi ett material för ett helt föremål. Föremål i verkligheten består dock oftast inte av
ett enda material, utan av flera. Tänk på en bil: karossen har en blank lack, rutorna speglar delvis omgivningen,
däcken är allt annat än blanka och har därför inga spekulära högdagrar, och fälgarna är superblanka (om du faktiskt
har tvättat bilen, vill säga). Bilen har också diffusa och ambienta färger som inte är desamma över hela föremålet; en
bil visar många olika ambienta/diffusa färger. Sammantaget har ett sådant föremål olika materialegenskaper för var och
en av sina delar.

Materialsystemet från förra kapitlet räcker alltså inte för annat än de enklaste modellerna, så vi behöver bygga ut
det med *diffuse maps* och *specular maps*. De låter oss styra den diffusa komponenten (och indirekt den ambienta,
eftersom de ändå bör vara desamma) och den spekulära komponenten hos ett föremål med mycket större precision.

## Diffuse maps

Det vi vill ha är ett sätt att ange ett föremåls diffusa färg för varje enskilt fragment. Något slags system där vi kan
hämta ett färgvärde utifrån fragmentets position på föremålet?

Det här låter säkert bekant, och vi har använt ett sådant system ett tag nu. Det låter precis som texturerna vi gick
igenom ingående i ett av de tidigare kapitlen, och det är i grunden just det: en textur. Vi använder bara ett annat
namn för samma princip: en bild som lindas runt ett föremål och som vi kan slå upp unika färgvärden i per fragment. I
belysta scener kallas den oftast *diffuse map* (det var i allmänhet så 3D-grafiker kallade dem före PBR), eftersom
texturbilden representerar alla föremålets diffusa färger.

För att visa diffuse maps använder vi en bild av en trälåda med en stålkant: kursens `container2.png`, träplankor som
hålls ihop av en grå stålram. (learnopengl.com använder en egen bild av en sådan låda; idén är densamma.)

Att använda en diffuse map i shadrar är precis som vi visade i texturkapitlet. Den här gången tar texturen dock
platsen för materialets diffusa `vec3`-färg.

:::opengl
```glsl
struct Material {
    sampler2D diffuse;
    vec3 specular;
    float shininess;
};
...
in vec2 TexCoords;
```

Tänk på att `sampler2D` är en så kallad *opak typ* (opaque type), vilket betyder att vi inte kan skapa instanser av
den, bara deklarera den som uniform. Om structen skulle instansieras på annat sätt än som uniform (till exempel som
funktionsparameter) kan GLSL ge konstiga fel; samma sak gäller därför varje struct som innehåller sådana opaka typer.
:::
:::vulkan
Här skiljer sig Vulkan från OpenGL. En sampler är en *opak typ* (opaque type): den är inte ett värde i en buffer utan
ett handtag till en bild och en sampler som descriptor setet tillhandahåller. Ett uniform-block kan inte innehålla en
sådan, och Vulkan-GLSL tillåter inte ens opaka typer inuti en struct – så samplern kan inte ligga i structen
`Material`, som finns i uniform-blocket. I stället får diffuse mapen en egen binding, bredvid blocket, och structen
behåller bara talen:

```glsl
// The lighting maps are textures; a uniform block cannot hold a sampler, so they have bindings of their own.
layout(binding = 0) uniform sampler2D diffuseMap;

struct Material {
    vec3 specular;
    float shininess;
};
...
layout(location = 2) in vec2 fragTexCoord;
```

`diffuseMap` är learnopengls `material.diffuse` under ett annat namn. Binding 0 är ledig: uniform buffern behöll
binding 2 från de tidigare kapitlen, där binding 0 och 1 innehöll lådans två texturer.
:::
:::d3d12
Här skiljer sig Direct3D 12 från OpenGL. En textur är inte ett värde i en buffer: shadern läser den genom en shader
resource view (SRV) i ett `t`-register, och en cbuffer – och varje struct i den – kan inte innehålla en sådan. Därför
blir diffuse mapen en global `Texture2D`, bredvid cbuffern, tillsammans med samplern den läses med, och structen
behåller bara talen:

```hlsl
// The material's diffuse colour is a texture: register t0, in the descriptor table of
// root parameter 2. (Textures cannot be members of a cbuffer or its structs.)
Texture2D diffuseMap : register(t0);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// The rest of the material.
struct Material
{
    float3 specular;
    float shininess;
};
```

`diffuseMap` är learnopengls `material.diffuse` under ett annat namn, och `wrapSampler` är den statiska sampler du
redan använde i kapitlet *Textures*.
:::

Vi har också tagit bort materialets ambienta färgvektor, eftersom den ambienta färgen ändå är lika med den diffusa nu
när vi styr det ambienta med ljuset. Det finns alltså ingen anledning att lagra den separat.

```quiz
Varför har materialet ingen egen ambient färg längre när diffuse mapen kommer in?
- [ ] En textur kan bara ersätta en av färgerna, och learnopengl valde den diffusa
- [ ] Ambient belysning stängs av när en textur används
- [x] En ytas ambienta färg är i praktiken alltid dess diffusa färg, och ljusets `ambient`-intensitet styr redan hur stark den är – så den ambienta termen läser också diffuse mapen
---
Båda termerna beskriver ytans egen färg; bara ljuset avgör hur mycket av den som syns (0.2 för ambient, 0.5 för diffust i det här projektet). Alltså `ambient = light.ambient * diffus färg` och `diffuse = light.diffuse * diff * diffus färg`, båda från samma texel.
```

Observera att vi återigen behöver texturkoordinater i fragment shadern, så den får en extra indatavariabel. Sedan
läser vi helt enkelt texturen för att hämta fragmentets diffusa färgvärde:

:::opengl
```glsl
    vec3 diffuse = light.diffuse * diff * texture(material.diffuse, TexCoords).rgb;
```

Glöm inte heller att sätta materialets ambienta färg lika med den diffusa:

```glsl
    vec3 ambient = light.ambient * texture(material.diffuse, TexCoords).rgb;
```
:::
:::vulkan
```glsl
    vec3 diffuse = ubo.light.diffuse * diff * texture(diffuseMap, fragTexCoord).rgb;
```

Glöm inte heller att sätta materialets ambienta färg lika med den diffusa:

```glsl
    vec3 ambient = ubo.light.ambient * texture(diffuseMap, fragTexCoord).rgb;
```
:::
:::d3d12
```hlsl
    float3 diffuse = light.diffuse * diff * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
```

Glöm inte heller att sätta materialets ambienta färg lika med den diffusa:

```hlsl
    float3 ambient = light.ambient * diffuseMap.Sample(wrapSampler, input.texCoord).rgb;
```
:::

Det är allt som krävs för att använda en diffuse map. Som du ser är det inget nytt, men det ger ett dramatiskt lyft i
bildkvalitet. För att få det att fungera behöver vi dock uppdatera vertexdata med texturkoordinater, skicka dem som
vertexattribut vidare till fragment shadern, ladda texturen och binda den till rätt texturenhet.

:::opengl
Det här kapitlets projekt är resultatet från *Materials*, med den belysta kubens shadrar omdöpta till
`lighting_maps.vs` och `lighting_maps.fs`. Ljuset har learnopengls fasta intensiteter igen (ambient 0.2, diffust 0.5,
spekulärt 1.0 – ingen föränderlig färg), och materialet är fortfarande korallfärgat. Några saker för texturer finns
redan: `stb_image.h` (med `STB_IMAGE_IMPLEMENTATION`), de tre bilderna `container2.png`, `container2_specular.png` och
`matrix.png`, och vertexdata med texturkoordinater – varje vertex har nu en position, en normal och texturkoordinater,
8 floats:

```cpp
    float vertices[] = {
        // positions          // normals           // texture coords
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
        ...
```

Positions- och normalattributen använder redan ett stride på `8 * sizeof(float)`, för kubens VAO och för lampans.
`// TODO:`-kommentarerna markerar var din kod ska in: texturkoordinatattributet, laddningen av texturerna och
bindningen av dem i renderloopen.
:::
:::vulkan
Det här kapitlets projekt är resultatet från *Materials*, med kubens shadrar omdöpta till `shaders/lighting_maps.vert`
och `.frag`. Ljuset har learnopengls fasta intensiteter igen (ambient 0.2, diffust 0.5, spekulärt 1.0 – ingen
föränderlig färg), och materialet är fortfarande korallfärgat. Det texturer behöver finns redan, från kapitlet
*Textures*: `stb_image.h`, bilderna `textures/container2.png`, `textures/container2_specular.png` och
`textures/matrix.png`, vulkan-tutorials hjälpfunktioner `beginSingleTimeCommands()`, `endSingleTimeCommands()`,
`transitionImageLayout()` och `copyBufferToImage()`, och samplern `textureSampler` (linjär filtrering, repeat,
anisotropi), som skapas i `initVulkan()` och förstörs i `cleanup()`. Structen `Vertex` har en tredje medlem,
`glm::vec2 texCoord`, med learnopengls koordinater, v vänd (`1 - v`): learnopengl vänder bilderna när de laddas, vi
vänder koordinaterna i stället, som i kapitlet *Textures*.

Kroppen av *Textures*-kapitlets `createTextureImage()` är nu en hjälpfunktion som varje karta kan använda:

```cpp
    // A texture image (device local, ready for sampling) with the pixels of an image loaded by stb_image as RGBA,
    // copied through a staging buffer. The caller frees the pixels.
    void createTextureImage(stbi_uc* pixels, int texWidth, int texHeight, VkImage& image, VkDeviceMemory& imageMemory) {
```

Den skapar en staging buffer, kopierar pixlarna dit, skapar en device-local `VK_FORMAT_R8G8B8A8_UNORM`-image, byter
dess layout till `TRANSFER_DST_OPTIMAL`, kopierar buffern till den och byter layouten till
`SHADER_READ_ONLY_OPTIMAL`. `// TODO:`-kommentarerna markerar var din kod ska in: texturkoordinatattributet och
laddningen av kartorna.
:::
:::d3d12
Det här kapitlets projekt är resultatet från *Materials*, med den belysta kubens shadrar omdöpta till
`lighting_maps.hlsl`. Ljuset har learnopengls fasta intensiteter igen (ambient 0.2, diffust 0.5, spekulärt 1.0 – ingen
föränderlig färg), och materialet är fortfarande korallfärgat. Några saker för texturer finns redan: `stb_image.h`
(med `STB_IMAGE_IMPLEMENTATION`), de tre bilderna `container2.png`, `container2_specular.png` och `matrix.png`, och en
`Vertex`-struct med en tredje medlem, `XMFLOAT2 texCoord`. Texturkoordinaterna är learnopengls med v vänd (`1 - v`):
i Direct3D är v = 0 bildens översta rad, och bilderna laddas utan vändning, som i kapitlet *Textures*.
`// TODO:`-kommentarerna markerar var din kod ska in: input layoutens element för texturkoordinaterna, laddningen av
texturerna och texturernas root parameter i `PopulateCommandList`.
:::

Först måste texturkoordinaterna nå fragment shadern, precis som normalerna gjorde i *Basic Lighting*.

:::opengl
Vertexattributet på location 2 är de 2 floats som kommer efter normalen:

```cpp
    // texture coord attribute
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
```

Vertex shadern tar emot dem och skickar dem vidare:

```glsl
layout (location = 2) in vec2 aTexCoords;
...
out vec2 TexCoords;
...
    TexCoords = aTexCoords;
```

och fragment shadern tar emot dem med `in vec2 TexCoords;`.
:::
:::vulkan
`getAttributeDescriptions()` returnerar ett tredje attribut, location 2, för `texCoord` – två 32-bitars floats:

```cpp
    static std::array<VkVertexInputAttributeDescription, 3> getAttributeDescriptions() {
        std::array<VkVertexInputAttributeDescription, 3> attributeDescriptions{};
        ...
        attributeDescriptions[2].binding = 0;
        attributeDescriptions[2].location = 2;
        attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
        attributeDescriptions[2].offset = offsetof(Vertex, texCoord);
```

Vår `createPipeline()` använder bara de första `attributeCount` attributen, så kubens pipeline måste nu läsa 3
(lampans läser fortfarande bara positionen):

```cpp
        createPipeline("shaders/lighting_maps.vert.spv", "shaders/lighting_maps.frag.spv", 3, lightingPipeline); // position, normal and texture coordinates
```

Vertex shadern skickar dem vidare:

```glsl
layout(location = 2) in vec2 inTexCoord;
...
layout(location = 2) out vec2 fragTexCoord;
...
    fragTexCoord = inTexCoord;
```

och fragment shadern tar emot dem med `layout(location = 2) in vec2 fragTexCoord;`.
:::
:::d3d12
Input layouten får ett tredje element: två floats med semantiken `TEXCOORD`, 24 byte in i vertexen, efter positionens
och normalens 3 + 3 floats:

```cpp
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

`VSMain` tar emot dem som en tredje indata och skickar dem vidare i `PSInput`:

```hlsl
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD;
};

PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    ...
    result.texCoord = texCoord;
```

Lampans pipeline använder samma input layout; dess vertex shader ignorerar helt enkelt de element den inte läser.
:::

Gör nu den första uppgiften, **texcoords**, och bygg och kör sedan. Ingenting ändras än – kuben är fortfarande
korallfärgad – men koordinaterna är nu på väg till fragment shadern.

Sedan kommer själva texturen.

:::opengl
Projektet använder learnopengls hjälpfunktion `loadTexture`, i slutet av `main.cpp`, så att vi slipper upprepa
texturkoden från kapitlet *Textures* för varje karta:

```cpp
// utility function for loading a 2D texture from file
// ---------------------------------------------------
unsigned int loadTexture(const char *path)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    stbi_set_flip_vertically_on_load(true); // tell stb_image.h to flip loaded textures on the y-axis (the image's first row is its top, OpenGL's v = 0 is the bottom)
    unsigned char *data = stbi_load(path, &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format = GL_RGB;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
```

Den väljer format utifrån antalet kanaler i filen, så den fungerar lika bra för gråskale-, RGB- och RGBA-bilder. Till
skillnad från learnopengls version vänder den bilden vid laddningen, som kapitlet *Textures* gjorde, så att bilderna
blir rättvända. Med den tar det några rader att ladda diffuse mapen och tala om för shadern vilken texturenhet
`material.diffuse` läser från, före renderloopen:

```cpp
    // load textures (we now use a utility function to keep the code more organized)
    // -----------------------------------------------------------------------------
    unsigned int diffuseMap = loadTexture("container2.png");

    // shader configuration
    // --------------------
    lightingShader.use();
    lightingShader.setInt("material.diffuse", 0);
```

Observera att en sampler inuti en struct sätts precis som alla andra struct-fält, med sitt fullständiga namn. I
renderloopen binder vi texturen till enhet 0 innan kuben ritas:

```cpp
        // bind diffuse map
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
```

De två `setVec3`-anropen för `material.ambient` och `material.diffuse` försvinner – de uniform-variablerna finns inte
längre. Vi behåller den spekulära färgen på 0.5 och använder, som learnopengl, shininess 64:

```cpp
        // material properties
        lightingShader.setVec3("material.specular", 0.5f, 0.5f, 0.5f);
        lightingShader.setFloat("material.shininess", 64.0f);
```

Ta till sist bort texturen tillsammans med de andra objekten i slutet av `main`: `glDeleteTextures(1, &diffuseMap);`.
:::
:::vulkan
Varje karta får en egen funktion som laddar dess bild och skapar imagen och dess image view – vulkan-tutorials
`createTextureImage()` och `createTextureImageView()` i ett, för en fil. Imagen, dess minne och vyn är nya medlemmar i
programmet:

```cpp
    VkImage diffuseMapImage;
    VkDeviceMemory diffuseMapImageMemory;
    VkImageView diffuseMapImageView;
```

```cpp
    // the diffuse map: the colour of the surface (for the ambient and the diffuse light)
    void createDiffuseMap() {
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container2.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, diffuseMapImage, diffuseMapImageMemory);
        stbi_image_free(pixels);

        diffuseMapImageView = createImageView(diffuseMapImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

`initVulkan()` anropar `createDiffuseMap();` där TODO:n står, efter `createCommandPool()` (kopieringen behöver en
command buffer) och före `createTextureSampler()`, och `cleanup()` förstör de tre objekten efter samplern:

```cpp
        vkDestroyImageView(device, diffuseMapImageView, nullptr);
        vkDestroyImage(device, diffuseMapImage, nullptr);
        vkFreeMemory(device, diffuseMapImageMemory, nullptr);
```

Imagen har en enda mipnivå: vulkan-tutorial lägger till mipmaps först i ett senare kapitel. OpenGL:s `loadTexture`
genererar dem, så lådans finaste detaljer kan se lite skarpare ut här än i OpenGL.

Sedan behöver shadern kartan. I OpenGL skulle vi binda texturen till en texturenhet; i Vulkan säger descriptor setet
vilken image och sampler shaderns binding 0 läser. Det tar samma tre steg som i kapitlet *Textures*. Layouten får en
combined image sampler på binding 0, för fragmentsteget:

```cpp
        // The uniform buffer keeps binding 2; the lighting maps take the bindings 0, 1 and 3.
        VkDescriptorSetLayoutBinding diffuseMapLayoutBinding{};
        diffuseMapLayoutBinding.binding = 0;
        diffuseMapLayoutBinding.descriptorCount = 1;
        diffuseMapLayoutBinding.descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        diffuseMapLayoutBinding.pImmutableSamplers = nullptr;
        diffuseMapLayoutBinding.stageFlags = VK_SHADER_STAGE_FRAGMENT_BIT;
        ...
        std::array<VkDescriptorSetLayoutBinding, 2> bindings = {diffuseMapLayoutBinding, uboLayoutBinding};
```

Poolen måste ha plats för en combined image sampler:

```cpp
        std::array<VkDescriptorPoolSize, 2> poolSizes{};
        poolSizes[0].type = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
        poolSizes[0].descriptorCount = 1; // the set has one uniform buffer
        poolSizes[1].type = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        poolSizes[1].descriptorCount = 1; // and a combined image sampler for each lighting map
```

Och `createDescriptorSets()` skriver image view och sampler till binding 0:

```cpp
        VkDescriptorImageInfo diffuseMapInfo{};
        diffuseMapInfo.imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
        diffuseMapInfo.imageView = diffuseMapImageView;
        diffuseMapInfo.sampler = textureSampler;

        std::array<VkWriteDescriptorSet, 2> descriptorWrites{};
        ...
        descriptorWrites[1].sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
        descriptorWrites[1].dstSet = descriptorSet;
        descriptorWrites[1].dstBinding = 0;
        descriptorWrites[1].dstArrayElement = 0;
        descriptorWrites[1].descriptorType = VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;
        descriptorWrites[1].descriptorCount = 1;
        descriptorWrites[1].pImageInfo = &diffuseMapInfo;
```

Eftersom descriptor setet binds en gång i `recordCommandBuffer()`, som förut, ändras ingenting där: kartan binds
tillsammans med uniform buffern. C++-structen `Material` förlorar `ambient` och `diffuse` precis som shaderns – den är
nu `glm::vec3 specular; float shininess;`, 16 byte – och `updateUniformBuffer()` behåller den spekulära färgen på 0.5
och använder, som learnopengl, shininess 64:

```cpp
        ubo.material.specular  = glm::vec3(0.5f, 0.5f, 0.5f);
        ubo.material.shininess = 64.0f;
```
:::
:::d3d12
Projektet har learnopengls hjälpfunktion `loadTexture` som medlemsfunktion, `LoadTexture`, i slutet av `main.cpp`. Den
gör stegen från kapitlet *Textures* för en fil, så att vi slipper upprepa dem för varje karta:

```cpp
void D3D12App::LoadTexture(const char* path, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
```

Den laddar bilden som RGBA med `stbi_load(path, …, 4)`, skapar en `DXGI_FORMAT_R8G8B8A8_UNORM`-textur med en mipnivå i
en default heap, skapar en upload buffer på `GetRequiredIntermediateSize` byte, spelar in kopieringen med
`UpdateSubresources` i command listen, lägger till barriären till `PIXEL_SHADER_RESOURCE` och skapar SRV:n i plats
`descriptorIndex` i CBV/SRV-heapen. Command listen är fortfarande öppen då; `LoadAssets` kör den i slutet och väntar
på GPU:n. Därför är upload buffern en utparameter: anroparen håller den vid liv till dess.

Texturen har en enda mipnivå, som i kapitlet *Textures*. OpenGL:s `loadTexture` genererar mipmaps, så lådans finaste
detaljer kan se lite skarpare ut här än i OpenGL.

Laddningen av diffuse mapen hamnar där TODO:n står, efter vertex buffern. Texturen är en ny medlem,
`ComPtr<ID3D12Resource> m_diffuseMap;`, och dess SRV hamnar i heap-plats 1, direkt efter CBV:n i plats 0:

```cpp
    // Load the textures: the SRVs go into the heap after the CBV (slot 0), in the order of
    // their registers t0, t1 ... Their upload buffers must stay alive until the command list
    // that copies from them has executed (the end of this method waits for it).
    ComPtr<ID3D12Resource> diffuseMapUploadHeap;
    LoadTexture("container2.png", m_diffuseMap, diffuseMapUploadHeap, 1);
```

Heapen behöver alltså plats för två descriptors: `cbvSrvHeapDesc.NumDescriptors = 2;    // one CBV + one SRV per texture`.

Root signaturen talar om för shadrarna var texturen finns: ett andra descriptor range, med SRV:er från register `t0`
och framåt, i en ny root parameter 2 som pixel shadern ser – och den statiska samplern från kapitlet *Textures* på
`s0`:

```cpp
        // Descriptor ranges: 1 CBV at register b1, for the table of root parameter 1, and
        // the SRVs of the textures from register t0 on (1 SRV: t0), for root parameter 2.
        CD3DX12_DESCRIPTOR_RANGE ranges[2];
        ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1);
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 1, 0);

        // Root parameter 2: a descriptor table with the textures' SRVs, for the pixel shader.
        CD3DX12_ROOT_PARAMETER rootParameters[3];
        rootParameters[0].InitAsConstants(sizeof(ModelConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
        rootParameters[2].InitAsDescriptorTable(1, &ranges[1], D3D12_SHADER_VISIBILITY_PIXEL);

        // A static sampler is part of the root signature itself (no descriptor needed).
        // Sampler s0: linear filtering; texture coordinates outside 0..1 wrap around.
        D3D12_STATIC_SAMPLER_DESC samplers[1] = {};
        samplers[0].Filter = D3D12_FILTER_MIN_MAG_MIP_LINEAR;
        samplers[0].AddressU = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressV = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        samplers[0].AddressW = D3D12_TEXTURE_ADDRESS_MODE_WRAP;
        ...
        samplers[0].ShaderRegister = 0;
        samplers[0].RegisterSpace = 0;
        samplers[0].ShaderVisibility = D3D12_SHADER_VISIBILITY_PIXEL;

        CD3DX12_ROOT_SIGNATURE_DESC rootSignatureDesc;
        rootSignatureDesc.Init(_countof(rootParameters), rootParameters, _countof(samplers), samplers, D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT);
```

I OpenGL skulle vi binda texturen till en texturenhet före ritningen; i Direct3D 12 pekar vi root parameter 2 på den
heap-plats där SRV:n ligger, i `PopulateCommandList`, efter root parameter 1:

```cpp
    // Root parameter 2: the textures' table, starting at the heap's second descriptor (slot 1).
    CD3DX12_GPU_DESCRIPTOR_HANDLE srvHandle(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(2, srvHandle);
```

C++-structen `Material` förlorar `ambient` och `diffuse` precis som shaderns – den är nu `XMFLOAT3 specular; float
shininess;`, en rad på 16 byte – och `OnUpdate` behåller den spekulära färgen på 0.5 och använder, som learnopengl,
shininess 64:

```cpp
    // material properties
    constantBufferData.material.specular = XMFLOAT3(0.5f, 0.5f, 0.5f);
    constantBufferData.material.shininess = 64.0f;
```
:::

:::opengl
```quiz
`lightingShader.setInt("material.diffuse", 0);` körs en gång, före renderloopen. Vad gör den?
- [ ] Den binder `diffuseMap` till texturenhet 0 för resten av programmet
- [ ] Den laddar upp diffuse mapens pixlar till shadern
- [x] Den talar om för samplern `material.diffuse` att den ska läsa från texturenhet 0 – vilken textur som än är bunden till `GL_TEXTURE0` när kuben ritas
---
En sampler-uniform innehåller ett texturenhetsnummer, inte en textur. Själva texturen kopplas till enheten med `glActiveTexture(GL_TEXTURE0)` och `glBindTexture` i renderloopen; shadern läser det som är bundet där när ritanropet görs.
```
:::
:::vulkan
```quiz
Hur kommer det sig att fragment shaderns `layout(binding = 0) uniform sampler2D diffuseMap;` läser `container2.png`?
- [ ] `createDiffuseMap()` binder imagen till texturenhet 0
- [x] Descriptor setets binding 0 är en combined image sampler, och `vkUpdateDescriptorSets` skriver `diffuseMapImageView` och `textureSampler` dit; setet binds före ritningen
- [ ] Shadern laddar själv filen när pipelinen skapas
---
Layouten deklarerar binding 0 som en combined image sampler för fragmentsteget, poolen har plats för den, och skrivningen (`dstBinding = 0`, `pImageInfo = &diffuseMapInfo`) lägger image view och sampler där. `vkCmdBindDescriptorSets` i `recordCommandBuffer()` gör den synlig för ritanropet.
```
:::
:::d3d12
```quiz
Hur kommer det sig att pixel shaderns `Texture2D diffuseMap : register(t0);` läser `container2.png`?
- [ ] `LoadTexture` binder texturen direkt till register t0
- [ ] Den statiska samplern s0 innehåller texturen
- [x] `LoadTexture` lägger dess SRV i heap-plats 1; root parameter 2 är en tabell vars SRV-range börjar på t0, och `SetGraphicsRootDescriptorTable(2, …)` pekar den på plats 1
---
Register nås genom root signaturen: rangen `SRV, 1, 0` säger "tabellens första descriptor är t0", och GPU-handtaget till `SetGraphicsRootDescriptorTable` säger var tabellen börjar i heapen – plats 1, där SRV:n ligger. Den statiska samplern säger bara *hur* texturen ska läsas.
```
:::

Gör nu uppgiften **diffuse-map** och bygg och kör sedan. Den korallfärgade kuben är nu en trälåda med stålram, belyst
som förut: framsidan ljus, vänstersidan mörk. Som du ser ser lådan nu ut som en riktig låda: ett dramatiskt lyft i
bildkvalitet. Titta dock noga på den spekulära högdagern i framsidans övre vänstra hörn: det är en gråvit glans som
täcker stålet och träet likadant.

## Specular maps

Du har säkert märkt att den spekulära högdagern ser lite konstig ut, eftersom föremålet är en låda som mest består av
trä, och trä har inte sådana spekulära högdagrar. Vi skulle kunna lösa det genom att sätta föremålets spekulära
material till noll, men då skulle lådans stålkanter inte heller längre visa några spekulära högdagrar, och stål *ska*
visa spekulära högdagrar. Vi vill kunna styra vilka delar av föremålet som ska visa en spekulär högdager, och med
varierande intensitet. Det här är ett problem som låter bekant. En slump? Knappast.

Vi kan använda en texturkarta även för spekulära högdagrar. Det betyder att vi behöver ta fram en svartvit (eller
färgad, om du känner för det) textur som anger den spekulära intensiteten för varje del av föremålet. Kursens
`container2_specular.png` är en sådan specular map: stålramen är ljus, träplankorna nästan svarta.

Intensiteten hos den spekulära högdagern kommer från ljusstyrkan hos varje pixel i bilden. Varje pixel i specular
mapen kan ses som en färgvektor där svart representerar färgvektorn (0, 0, 0) och grått till exempel färgvektorn
(0.5, 0.5, 0.5). I fragment shadern läser vi sedan motsvarande färgvärde och multiplicerar det med ljusets spekulära
intensitet. Ju "vitare" en pixel är, desto större blir resultatet av multiplikationen och desto ljusare blir
föremålets spekulära komponent.

Eftersom lådan mest består av trä, och trä som material inte ska ha några spekulära högdagrar, har hela träpartiet av
den diffusa texturen gjorts svart: svarta partier har ingen spekulär högdager. Stålkanten har varierande spekulär
intensitet, där själva stålet är relativt mottagligt för spekulära högdagrar medan sprickorna inte är det.

Tekniskt sett har även trä spekulära högdagrar, fast med ett mycket lägre shininess-värde (mer spridning av ljuset)
och mindre genomslag, men för inlärningens skull kan vi låtsas att trä inte reagerar alls på spekulärt ljus.

Med verktyg som Photoshop eller Gimp är det relativt enkelt att göra om en diffus textur till en sådan spekulär bild,
genom att klippa bort vissa delar, göra den svartvit och öka ljusstyrkan/kontrasten.

```quiz
I specular mapen är träplankorna nästan svarta och stålramen ljus. Vad betyder det för belysningen?
- [x] Den spekulära termen multipliceras med kartan: på träet blir den nästan 0 (ingen högdager), på stålet behåller den nästan ljusets fulla spekulära intensitet
- [ ] Träet får högre shininess och stålet lägre
- [ ] Träet ritas svart och stålet vitt
---
Specular mapen skalar bara den spekulära komponenten; ytans färg kommer fortfarande från diffuse mapen. Svart (0, 0, 0) tar bort högdagern, vitt (1, 1, 1) släpper igenom den med full styrka, gråa värden ligger där emellan.
```

## Läsa specular maps

En specular map är precis som vilken annan textur som helst, så koden liknar koden för diffuse mapen.

:::opengl
Se till att ladda bilden ordentligt och skapa ett texturobjekt. Eftersom vi använder ytterligare en texturs sampler i
samma fragment shader måste vi använda en annan texturenhet för specular mapen och binda den till rätt texturenhet
före renderingen:

```cpp
    unsigned int specularMap = loadTexture("container2_specular.png");
    ...
    lightingShader.setInt("material.specular", 1);
    ...
        // bind specular map
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);
```

`setInt` hamnar under diffuse mapens, före renderloopen, och bindningen efter diffuse mapens, i loopen. Uppdatera
sedan fragment shaderns materialegenskaper så att den spekulära komponenten är en `sampler2D` i stället för en `vec3`:

```glsl
struct Material {
    sampler2D diffuse;
    sampler2D specular;
    float shininess;
};
```

Och till sist vill vi läsa specular mapen för att hämta fragmentets spekulära intensitet:

```glsl
    vec3 specular = light.specular * spec * texture(material.specular, TexCoords).rgb;
```

`material.specular` är nu en sampler, så anropet `setVec3("material.specular", …)` i renderloopen måste bort: bara
shininess blir kvar under `// material properties`. Och glöm inte `glDeleteTextures(1, &specularMap);` i slutet.
:::
:::vulkan
I Vulkan finns inga texturenheter: specular mapen får descriptor setets binding 1, genom samma steg som diffuse mapen.
Nya medlemmar `specularMapImage`, `specularMapImageMemory` och `specularMapImageView`, som förstörs i `cleanup()`, och
en funktion som laddar bilden:

```cpp
    // the specular map: how strong the specular highlight is on each part of the surface (the steel shines, the wood does not)
    void createSpecularMap() {
        int texWidth, texHeight, texChannels;
        stbi_uc* pixels = stbi_load("textures/container2_specular.png", &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);

        if (!pixels) {
            throw std::runtime_error("failed to load texture image!");
        }

        createTextureImage(pixels, texWidth, texHeight, specularMapImage, specularMapImageMemory);
        stbi_image_free(pixels);

        specularMapImageView = createImageView(specularMapImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    }
```

som anropas med `createSpecularMap();` efter `createDiffuseMap();`. I `createDescriptorSetLayout()` en
`specularMapLayoutBinding` som diffuse mapens, med `binding = 1`, och arrayen med bindings växer till tre:

```cpp
        std::array<VkDescriptorSetLayoutBinding, 3> bindings = {diffuseMapLayoutBinding, specularMapLayoutBinding, uboLayoutBinding};
```

Poolens storlek för combined image samplers blir 2 (`poolSizes[1].descriptorCount = 2;`), och `createDescriptorSets()`
får en `VkDescriptorImageInfo specularMapInfo` (`specularMapImageView`, samma `textureSampler`) och en tredje
skrivning, `descriptorWrites[2]`, med `dstBinding = 1` och `pImageInfo = &specularMapInfo`. Båda kartorna delar en
sampler: en combined image sampler-descriptor är ett par av en image view och en sampler, och inget hindrar två par
från att använda samma sampler.

I fragment shadern deklareras kartan bredvid diffuse mapen, och structen behåller bara shininess:

```glsl
layout(binding = 0) uniform sampler2D diffuseMap;
layout(binding = 1) uniform sampler2D specularMap;

struct Material {
    float shininess;
};
```

Och till sist vill vi läsa specular mapen för att hämta fragmentets spekulära intensitet:

```glsl
    vec3 specular = ubo.light.specular * spec * texture(specularMap, fragTexCoord).rgb;
```

C++-structen `Material` måste återigen stämma med blocket. En struct med en ensam `float` tar ändå 16 byte i ett
uniform-block – dess storlek avrundas uppåt till en multipel av 16 – så den behöver tre utfyllnadsfloats:

```cpp
struct Material {
    float shininess;
    float pad1; // a struct in a uniform block takes a multiple of 16 bytes
    float pad2;
    float pad3;
};
```

`ubo.material.specular` finns inte längre, så dess rad i `updateUniformBuffer()` försvinner: bara
`ubo.material.shininess = 64.0f;` blir kvar.
:::
:::d3d12
I Direct3D 12 finns inga texturenheter: specular mapen får register `t1`, och dess SRV hamnar i heap-plats 2, direkt
efter diffuse mapens. En ny medlem `ComPtr<ID3D12Resource> m_specularMap;`, och efter diffuse mapen:

```cpp
    ComPtr<ID3D12Resource> specularMapUploadHeap;
    LoadTexture("container2_specular.png", m_specularMap, specularMapUploadHeap, 2);
```

Heapen behöver plats för tre descriptors (`NumDescriptors = 3`), och SRV-rangen i root parameter 2 växer till två
descriptors, t0 och t1:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

`PopulateCommandList` ändras inte: tabellen börjar fortfarande på plats 1, och med två descriptors täcker den nu
plats 1 och 2 – diffuse mapen som t0 och specular mapen som t1. Det är därför texturerna laddas i registerordning: en
descriptor table är en följd av intilliggande heap-platser.

I shadern deklareras kartan bredvid diffuse mapen, och structen behåller bara shininess:

```hlsl
Texture2D diffuseMap : register(t0);
Texture2D specularMap : register(t1);
...
struct Material
{
    float shininess;
};
```

Och till sist vill vi läsa specular mapen för att hämta fragmentets spekulära intensitet:

```hlsl
    float3 specular = light.specular * spec * specularMap.Sample(wrapSampler, input.texCoord).rgb;
```

C++-structen `Material` måste återigen stämma med cbuffern. Nästa medlem, `Light light`, är en struct och börjar på en
ny 16-byte-rad, så raden med `shininess` måste fyllas ut i C++:

```cpp
    // The material: what the shaders see as struct Material. Laid out as HLSL does: the
    // next member (a struct) starts a new 16-byte row, so the row is padded to 16 bytes.
    struct Material
    {
        float shininess;
        float padding0[3];
    };
```

`material.specular` finns inte längre, så dess rad i `OnUpdate` försvinner: bara
`constantBufferData.material.shininess = 64.0f;` blir kvar.
:::

:::opengl
```quiz
Båda kartorna binds med `glBindTexture(GL_TEXTURE_2D, …)`. Varför ersätter inte det andra anropet det första?
- [x] `glActiveTexture(GL_TEXTURE1)` väljer först texturenhet 1, så specular mapen binds till enhet 1 medan diffuse mapen stannar på enhet 0
- [ ] Eftersom de två texturerna har olika storlek
- [ ] `glBindTexture` lägger till texturer i en lista; shadern tar dem i ordning
---
`glBindTexture` binder till den *aktiva* texturenheten. Med `glActiveTexture(GL_TEXTURE0)` före den första bindningen och `GL_TEXTURE1` före den andra hittar varje sampler (`material.diffuse` = 0, `material.specular` = 1) sin egen textur.
```
:::
:::vulkan
```quiz
Varför är kartorna deklarationer `layout(binding = N) uniform sampler2D` bredvid uniform-blocket i stället för medlemmar i `Material`, som i learnopengl?
- [ ] Eftersom samplers alltid måste ha lägre binding-nummer än uniform buffern
- [ ] Eftersom Vulkan bara tillåter en textur per struct
- [x] Ett uniform-block kan inte innehålla samplers, och `Material` ligger i uniform-blocket; samplers är opaka typer som descriptor setet tillhandahåller, var och en genom en egen binding
---
Blocket är vanligt minne som läses på fasta offset; en sampler är ett handtag till en image view och ett samplerobjekt, som en combined image sampler-descriptor tillhandahåller – och Vulkan-GLSL tillåter inte opaka typer i structar alls. Därför får varje karta en egen binding (0, 1 och senare 3), och structen behåller bara talen.
```
:::
:::d3d12
```quiz
SRV-rangen växer från 1 till 2 descriptors, och specular mapens SRV hamnar i heap-plats 2. Varför plats 2?
- [ ] Eftersom register t1 alltid betyder heap-plats 2
- [x] Root parameter 2:s tabell börjar på plats 1 och täcker intilliggande platser: den första är t0 (diffuse mapen), nästa, plats 2, är t1
- [ ] Vilken ledig plats som helst fungerar; root signaturen letar upp SRV:n utifrån texturen
---
En descriptor table är ett starthandtag plus en följd av intilliggande descriptors. Rangen `SRV, 2, 0` kopplar tabellens descriptors till t0 och t1 i ordning, så specular mapens SRV måste ligga direkt efter diffuse mapens.
```
:::

Gör nu uppgiften **specular-map** och bygg och kör sedan. Nu glänser bara stålet: högdagern på ramen i det övre vänstra
hörnet är klart vit, medan träplankorna precis bredvid har förlorat sin glans och bara visar sin diffusa färg.

Med en specular map kan vi ange in i minsta detalj vilka delar av ett föremål som är blanka, och till och med styra
intensiteten. Specular maps ger oss ett extra lager av kontroll över belysningen ovanpå diffuse mapen.

> Om du inte vill vara alltför konventionell kan du också använda riktiga färger i specular mapen, för att inte bara
> ange den spekulära intensiteten för varje fragment utan också högdagerns färg. I verkligheten bestäms högdagerns
> färg dock mest av själva ljuskällan, så det skulle inte ge realistiska bilder (därför är bilderna oftast svartvita:
> vi bryr oss bara om intensiteten).

Om du kör programmet nu ser du tydligt att lådans material nu liknar en riktig trälåda med stålramar.

Med diffuse och specular maps kan vi verkligen lägga till enormt mycket detalj i relativt enkla föremål. Vi kan lägga
till ännu mer detalj med andra texturkartor, som normal/bump maps och/eller reflection maps, men det sparar vi till
senare kapitel. Visa din låda för alla vänner och hela familjen, och var nöjd med att vår låda en dag kan bli ännu
vackrare än den är nu!

## Övningar

- Lek med ljuskällans ambienta, diffusa och spekulära vektorer och se hur de påverkar lådans utseende.
- Försök invertera specular mapens färgvärden i fragment shadern, så att träet får spekulära högdagrar och stålkanterna
  inte (observera att kanterna fortfarande visar lite spekulär högdager på grund av sprickorna i stålet, fast med
  lägre intensitet).
- Försök skapa en specular map av den diffusa texturen som använder riktiga färger i stället för svart och vitt, och
  se att resultatet inte ser särskilt realistiskt ut.
- Lägg också till något som kallas *emission map*: en textur som lagrar emissionsvärden per fragment.
  Emissionsvärden är färger som ett föremål kan *sända ut* som om det innehöll en egen ljuskälla; på så sätt kan ett
  föremål lysa oavsett ljusförhållanden. Emission maps är ofta det du ser när föremål i ett spel lyser (som en robots
  ögon eller ljuslister på en låda). Lägg till `matrix.png` – gröna tecken på svart – som emission map på lådan, som
  om tecknen sände ut ljus.

De tre första övningarna provar du på egen hand. För den andra ändras bara den spekulära termen:

:::opengl
```glsl
    vec3 specular = light.specular * spec * (vec3(1.0) - texture(material.specular, TexCoords).rgb);
```
:::
:::vulkan
```glsl
    vec3 specular = ubo.light.specular * spec * (vec3(1.0) - texture(specularMap, fragTexCoord).rgb);
```
:::
:::d3d12
```hlsl
    float3 specular = light.specular * spec * (1.0f - specularMap.Sample(wrapSampler, input.texCoord).rgb);
```
:::

```quiz
Du inverterar specular mapen i shadern (1 minus det lästa värdet). Vad ser du?
- [ ] Ingenting ändras, eftersom specular mapen är svartvit
- [x] Träet får en högdager och stålramen förlorar det mesta av sin – bara de mörka sprickorna i stålet glänser fortfarande lite
- [ ] Hela lådan blir sitt eget fotografiska negativ
---
Bara den spekulära faktorn inverteras, inte färgen: det nästan svarta träet blir nästan vitt i kartan och släpper nu igenom högdagern, medan det ljusa stålet stoppar den. Diffuse mapen – lådans färg – är orörd.
```

Den fjärde övningen, emission mapen, är kapitlets sista uppgift. Den fungerar precis som de andra kartorna, med en
tredje textur:

:::opengl
```cpp
    unsigned int emissionMap = loadTexture("matrix.png");
    ...
    lightingShader.setInt("material.emission", 2);
    ...
        // bind emission map
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, emissionMap);
```

plus `glDeleteTextures(1, &emissionMap);` i slutet. I shadern läggs `sampler2D emission;` till i materialet efter
`specular`, och den utsända färgen adderas till resultatet:

```glsl
    // emission
    vec3 emission = texture(material.emission, TexCoords).rgb;

    vec3 result = ambient + diffuse + specular + emission;
```
:::
:::vulkan
Medlemmarna `emissionMapImage`, `emissionMapImageMemory` och `emissionMapImageView`, en `createEmissionMap()` som
laddar `"textures/matrix.png"` (anropas efter `createSpecularMap()`, förstörs i `cleanup()`), och en combined image
sampler på **binding 3** – binding 2 är uniform buffern. Arrayen med bindings växer till fyra
(`{diffuseMapLayoutBinding, specularMapLayoutBinding, uboLayoutBinding, emissionMapLayoutBinding}`), poolstorleken till
3, och setet får en fjärde skrivning med `dstBinding = 3` och `pImageInfo = &emissionMapInfo`. I shadern:

```glsl
layout(binding = 3) uniform sampler2D emissionMap; // binding 2 is the uniform buffer
...
    // emission
    vec3 emission = texture(emissionMap, fragTexCoord).rgb;

    vec3 result = ambient + diffuse + specular + emission;
```
:::
:::d3d12
En medlem `ComPtr<ID3D12Resource> m_emissionMap;`, som laddas till heap-plats 3 efter specular mapen:

```cpp
    ComPtr<ID3D12Resource> emissionMapUploadHeap;
    LoadTexture("matrix.png", m_emissionMap, emissionMapUploadHeap, 3);
```

`NumDescriptors = 4`, och SRV-rangen växer till tre descriptors (`ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV,
3, 0);`): t0, t1 och t2. I shadern:

```hlsl
Texture2D emissionMap : register(t2);
...
    // emission
    float3 emission = emissionMap.Sample(wrapSampler, input.texCoord).rgb;

    float3 result = ambient + diffuse + specular + emission;
```
:::

Gör nu uppgiften **emission** och bygg och kör sedan. Gröna tecken lyser över lådans båda synliga sidor – även på
vänstersidan, som ljuset inte når. Mellan tecknen, där emission mapen är svart, ser lådan ut precis som förut.

```quiz
Varför lyser de gröna tecknen lika starkt på vänstersidan, som inte får något diffust ljus?
- [ ] Emission mapen läses med en annan sampler som ignorerar normalerna
- [x] Emissionen adderas till resultatet för sig, utan att multipliceras med någon av ljusets komponenter eller med `diff`
- [ ] Vänstersidan får diffust ljus från framsidans emission
---
Ambient, diffust och spekulärt skalas alla av ljuset (och av vinkeln mot det); emissionstermen är texturens färg som den är. Det är det som får den att se ut som ljus från själva föremålet – den lyser oavsett ljusförhållanden.
```

Nästa kapitel börjar igen utan emission mapen, från lådan med dess diffuse och specular maps, och tittar på olika
sorters ljuskällor.
