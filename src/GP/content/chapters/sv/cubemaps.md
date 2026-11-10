# Cubemaps

Vi har använt 2D-texturer ett tag nu, men det finns fler texturtyper som vi inte har utforskat än. I det här kapitlet
går vi igenom en texturtyp som är en kombination av flera texturer i en: en *cube map*.

En cube map är en textur som innehåller 6 enskilda 2D-texturer som var och en bildar en sida av en kub: en texturerad
kub. Du undrar kanske vad poängen är med en sådan kub? Varför kombinera 6 enskilda texturer till en enda enhet i
stället för att bara använda 6 separata texturer? Jo, cube maps har den användbara egenskapen att de kan indexeras och
samplas med en riktningsvektor. Tänk dig en enhetskub på 1×1×1 med en riktningsvektors startpunkt i mitten. Att sampla
ett texturvärde ur cube mapen med en riktningsvektor går till så här: vektorn börjar i kubens mitt, pekar någonstans,
och där den tränger igenom kubens yta – på en av de sex sidorna – där ligger texeln vi får.

Riktningsvektorns längd spelar ingen roll. Så länge en riktning anges hämtar GPU:n den texel som riktningen (till
slut) träffar och returnerar det samplade texturvärdet.

Om vi tänker oss en kubform som vi sätter en sådan cube map på, skulle riktningsvektorn likna kubens (interpolerade)
lokala vertexposition. På så sätt kan vi sampla cube mapen med kubens egna positionsvektorer, så länge kuben är
centrerad i origo. Vi betraktar alltså kubens alla vertexpositioner som dess texturkoordinater när vi samplar en cube
map. Resultatet är en texturkoordinat som når rätt sida av cube mapen.

```quiz
En cube map samplas med en riktning i stället för 2D-texturkoordinater. Vad händer om du samplar den med (0, 0, -2) i stället för (0, 0, -1)?
- [ ] Du får en texel dubbelt så långt in på -Z-sidan
- [ ] Samplingen misslyckas: riktningar för cube maps måste ha längden 1
- [x] Du får samma texel: bara riktningen räknas, inte längden
- [ ] Du får texeln på motsatt sida, +Z
---
GPU:n väljer sida utifrån vektorns största komponent och delar de två andra med den, så varje positiv multipel av en riktning hamnar på samma texel. Därför kan skyboxen skicka sina onormaliserade vertexpositioner rakt vidare.
```

Som i de andra kapitlen i den här delen finns allt här i alla API:er; texten visar det för {{api}}.

:::opengl
Projektet börjar med scenen från *Depth testing* utan golvet – learnopengl ritar bara de två marmorkuberna i det här
kapitlet: på (-1, 0, -1) och (2, 0, 0), med `glEnable(GL_DEPTH_TEST); glDepthFunc(GL_LESS);`, kameran på (0, 0, 3)
som tittar längs -z, och shadrarna `cubemaps.vs` / `cubemaps.fs` som läser `texture1`. Renderloopen räknar ut `model`,
`view` och `projection` först och har en TODO för skyboxen innan kuberna ritas. Nya filer: `skybox.vs` och `skybox.fs`
(deras `main` är en TODO), och himlens sex bilder i `skybox/`.
:::
:::vulkan
Projektet börjar med scenen från *Depth testing* utan golvet – learnopengl ritar bara de två marmorkuberna i det här
kapitlet: på (-1, 0, -1) och (2, 0, 0), kameran på (0, 0, 3) som tittar längs -z, kubens 36 vertexar (position och
texturkoordinater) i vertex buffern, ett descriptor set med marmorn, modellmatrisen i en push constant och view och
projection i uniform buffern. `createPipeline(vert, frag, pipeline)` skapar pipelinen från `shaders/cubemaps.vert` /
`.frag`. Nya filer: `shaders/skybox.vert` och `shaders/skybox.frag` (deras `main` är en TODO), och himlens sex bilder
i `textures/skybox/`.
:::
:::d3d12
Projektet börjar med scenen från *Depth testing* utan golvet – learnopengl ritar bara de två marmorkuberna i det här
kapitlet: på (-1, 0, -1) och (2, 0, 0), kameran på (0, 0, 3) som tittar längs -z, ett PSO med djupfunktionen LESS och
shadrarna i `cubemaps.hlsl`. Vertex buffern rymmer kuben (vertex 0–35, position och texturkoordinater); CBV/SRV-heapen
rymmer CBV:n (plats 0) och marmorn (plats 1). Nya filer: `skybox.hlsl`, som bara har en TODO-kommentar, och himlens
sex bilder i `skybox/`.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift trycker du på **Build & run**
(Ctrl+Enter) för att kompilera programmet och köra det i den inbyggda simulatorn.

## Skapa en cube map

En cube map är en textur som alla andra texturer, så för att skapa en genererar vi en textur och binder den till rätt
texturmål innan vi gör några fler texturoperationer.

:::opengl
Den här gången binder vi den till `GL_TEXTURE_CUBE_MAP`:

```cpp
    unsigned int textureID;
    glGenTextures(1, &textureID);
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);
```

Eftersom en cube map innehåller 6 texturer, en för varje sida, måste vi anropa `glTexImage2D` sex gånger med
parametrar som liknar dem i de tidigare kapitlen. Den här gången måste vi dock sätta texturens *target*-parameter till
en viss sida av cube mapen, för att tala om för OpenGL vilken sida vi skapar en textur för. Det betyder att vi anropar
`glTexImage2D` en gång för varje sida av cube mapen.

Eftersom vi har 6 sidor ger OpenGL oss 6 särskilda texturmål för sidorna av en cube map:

| Texturmål | Orientering |
| --- | --- |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_X` | Höger (+X) |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` | Vänster (-X) |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` | Uppe (+Y) |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` | Nere (-Y) |
| `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` | +Z |
| `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` | -Z |

Som många av OpenGL:s enum-värden ökar deras underliggande `int`-värde linjärt, så om vi har en array eller vector med
texturernas sökvägar kan vi loopa över dem genom att börja med `GL_TEXTURE_CUBE_MAP_POSITIVE_X` och öka enum-värdet med
1 i varje varv, och på så sätt gå igenom alla texturmål:

```cpp
    int width, height, nrComponents;
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        unsigned char *data = stbi_load(faces[i].c_str(), &width, &height, &nrComponents, 0);
        if (data)
        {
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
        ...
    }
```

Här har vi en vector som heter `faces` och som innehåller sökvägarna till alla texturer som cube mapen behöver, i
ordningen från tabellen. Det skapar en textur för varje sida av den bundna cube mapen.

Eftersom en cube map är en textur som alla andra anger vi också dess wrapping- och filtreringsmetoder:

```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
```

Låt dig inte skrämmas av `GL_TEXTURE_WRAP_R`; den sätter bara wrappingmetoden för texturens R-koordinat, som motsvarar
texturens tredje dimension (som z för positioner). Vi sätter wrappingmetoden till `GL_CLAMP_TO_EDGE` eftersom
texturkoordinater som ligger exakt mellan två sidor kanske inte träffar någon sida exakt (på grund av vissa
hårdvarubegränsningar), och med `GL_CLAMP_TO_EDGE` returnerar OpenGL alltid kantvärdena när vi samplar mellan sidor.

Innan vi ritar de föremål som ska använda cube mapen aktiverar vi motsvarande texturenhet och binder cube mapen; inte
mycket annorlunda jämfört med vanliga 2D-texturer.

I fragment shadern måste vi också använda en annan sampler, av typen `samplerCube`, som vi samplar med funktionen
`texture`, men den här gången med en riktningsvektor av typen `vec3` i stället för en `vec2`:

```glsl
in vec3 textureDir; // direction vector representing a 3D texture coordinate
uniform samplerCube cubemap; // cube map texture sampler

void main()
{
    FragColor = texture(cubemap, textureDir);
}
```
:::
:::vulkan
I Vulkan är en cube map ingen egen imagetyp. Den är en 2D-image med **6 array layers**, ett per sida, skapad med
flaggan `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, och läst genom en image view av typen `VK_IMAGE_VIEW_TYPE_CUBE` som
täcker de sex lagren. Array layer i är sida i, i en fast ordning:

| Array layer | Sida | OpenGL:s mål |
| --- | --- | --- |
| 0 | Höger (+X) | `GL_TEXTURE_CUBE_MAP_POSITIVE_X` |
| 1 | Vänster (-X) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` |
| 2 | Uppe (+Y) | `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` |
| 3 | Nere (-Y) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` |
| 4 | +Z | `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` |
| 5 | -Z | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` |

Reglerna som väljer sida och texel för en riktning är desamma som OpenGL:s, så samma sex bilder ger samma himmel.
Flaggan hamnar i imagens create info, bredvid de sex lagren:

```cpp
        // the image: 6 array layers, and the flag that allows a cube view of them
        VkImageCreateInfo imageInfo{};
        imageInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
        imageInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT;
        imageInfo.imageType = VK_IMAGE_TYPE_2D;
        imageInfo.extent.width = static_cast<uint32_t>(texWidth);
        imageInfo.extent.height = static_cast<uint32_t>(texHeight);
        imageInfo.extent.depth = 1;
        imageInfo.mipLevels = 1;
        imageInfo.arrayLayers = 6;
        imageInfo.format = VK_FORMAT_R8G8B8A8_UNORM;
        imageInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
        imageInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
        imageInfo.usage = VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
        imageInfo.samples = VK_SAMPLE_COUNT_1_BIT;
        imageInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
```

De sex sidorna måste vara kvadratiska och alla lika stora (våra är 256 × 256). Viewn är det som får shadern att se en
kub i stället för sex separata bilder:

```cpp
        // a cube view of the six layers: a shader samples it with a direction (samplerCube)
        VkImageViewCreateInfo viewInfo{};
        viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
        viewInfo.image = image;
        viewInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
        viewInfo.format = VK_FORMAT_R8G8B8A8_UNORM;
        viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        viewInfo.subresourceRange.baseMipLevel = 0;
        viewInfo.subresourceRange.levelCount = 1;
        viewInfo.subresourceRange.baseArrayLayer = 0;
        viewInfo.subresourceRange.layerCount = 6;
```

En cube map samplas med en sampler som alla andra texturer, så den får också wrapping- och filtreringslägen. Vi
använder linjär filtrering och `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`, som learnopengl gör med `GL_CLAMP_TO_EDGE`:
texturkoordinater som ligger exakt mellan två sidor kanske inte träffar någon sida exakt, och clampningen ser till att
vi alltid får kantvärden där. Projektets hjälpfunktion skapar den:

```cpp
        createTextureSampler(VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE, cubemapSampler); // no seams where two faces meet
```

I fragment shadern använder vi en annan samplertyp, `samplerCube`, som vi samplar med funktionen `texture`, men den här
gången med en riktningsvektor av typen `vec3` i stället för en `vec2`:

```glsl
layout(binding = 1) uniform samplerCube skybox;

layout(location = 0) in vec3 fragTexCoord;

layout(location = 0) out vec4 outColor;

void main() {
    outColor = texture(skybox, fragTexCoord);
}
```

Descriptor set layouten ändras inte: binding 1 är fortfarande en `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`. Det som
måste passa är viewn: en `samplerCube` i shadern behöver en view av typen `VK_IMAGE_VIEW_TYPE_CUBE` i descriptorn.
:::
:::d3d12
I Direct3D 12 är en cube map en 2D-textur med **6 array slices**, en per sida – `DepthOrArraySize = 6` i dess
resursbeskrivning – och en shader resource view med `D3D12_SRV_DIMENSION_TEXTURECUBE` som visar de sex skivorna för
shadern som en kub. Skiva i (subresurs i, med en mipnivå) är sida i, i en fast ordning:

| Array slice | Sida | OpenGL:s mål |
| --- | --- | --- |
| 0 | Höger (+X) | `GL_TEXTURE_CUBE_MAP_POSITIVE_X` |
| 1 | Vänster (-X) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_X` |
| 2 | Uppe (+Y) | `GL_TEXTURE_CUBE_MAP_POSITIVE_Y` |
| 3 | Nere (-Y) | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Y` |
| 4 | +Z | `GL_TEXTURE_CUBE_MAP_POSITIVE_Z` |
| 5 | -Z | `GL_TEXTURE_CUBE_MAP_NEGATIVE_Z` |

Reglerna som väljer sida och texel för en riktning är desamma som OpenGL:s, så samma sex bilder ger samma himmel.
Resursbeskrivningen är den som `LoadTexture` använder, med sex skivor:

```cpp
    D3D12_RESOURCE_DESC textureDesc = {};
    textureDesc.MipLevels = 1;
    textureDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    textureDesc.Width = static_cast<UINT64>(width);
    textureDesc.Height = static_cast<UINT>(height);
    textureDesc.Flags = D3D12_RESOURCE_FLAG_NONE;
    textureDesc.DepthOrArraySize = 6;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.SampleDesc.Quality = 0;
    textureDesc.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D;
```

De sex sidorna måste vara kvadratiska och alla lika stora (våra är 256 × 256). Viewn är det som får shadern att se en
kub i stället för sex separata bilder:

```cpp
    // Describe and create a SRV that sees the six slices as one cube (a TextureCube in HLSL).
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = textureDesc.Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE;
    srvDesc.TextureCube.MostDetailedMip = 0;
    srvDesc.TextureCube.MipLevels = 1;
```

En cube map samplas med en sampler som alla andra texturer. Projektets statiska sampler `s0` wrappar (WRAP), vilket är
vad en upprepande 2D-textur vill ha; för cube mapen lägger vi till en andra statisk sampler på register `s1` som
clampar, som learnopengl gör med `GL_CLAMP_TO_EDGE`: texturkoordinater som ligger exakt mellan två sidor kanske inte
träffar någon sida exakt, och clampningen ser till att vi alltid får kantvärden där. I `LoadAssets` växer arrayen till
`D3D12_STATIC_SAMPLER_DESC samplers[2] = {};` och efter `samplers[0]`:

```cpp
        // Sampler s1: the same, but texture coordinates are clamped to the edge (learnopengl's
        // GL_CLAMP_TO_EDGE for the cube map): no filtering across the seams between the faces.
        samplers[1] = samplers[0];
        samplers[1].AddressU = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressV = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        samplers[1].ShaderRegister = 1;
```

I HLSL är en cube map en `TextureCube`, och dess `Sample`-metod tar en riktning av typen `float3` i stället för en
`float2`:

```hlsl
TextureCube skybox : register(t0);
SamplerState clampSampler : register(s1);

float4 PSMain(PSInput input) : SV_TARGET
{
    return skybox.Sample(clampSampler, input.texCoords);
}
```

Root-signaturen ändras inte: root-parameter 2:s table rymmer fortfarande en SRV på register `t0`. Det som måste passa
är viewn: en `TextureCube` i shadern behöver en SRV med `D3D12_SRV_DIMENSION_TEXTURECUBE`.
:::

Det är ju bra och så, men varför bry sig? Jo, det råkar finnas en hel del intressanta tekniker som är mycket enklare att
implementera med en cube map. En av dem är att skapa en *skybox*.

## Skybox

En skybox är en (stor) kub som omsluter hela scenen och innehåller 6 bilder av en omgivande miljö, vilket ger spelaren
illusionen att miljön hen befinner sig i är mycket större än den faktiskt är. Några exempel på skyboxar i datorspel är
bilder av berg, av moln eller av en stjärnklar natthimmel.

Kursen har en egen himmel, i sex bilder på 256 × 256: `right.png`, `left.png`, `top.png`, `bottom.png`, `front.png` och
`back.png` – sidorna +X, -X, +Y, -Y, +Z och -Z. Den visar en blå himmel med moln och en sol, grå berg längs horisonten,
ett rödvitrandigt torn och gröna rutiga fält nedanför horisonten. Bilderna gjordes med specifikationens regler för cube
maps, så de möts utan skarvar, och deras riktningar är världens: solen ligger åt -Z, framför standardkameran (strax
utanför dess synfält, uppe till höger), tornet åt +Z, bakom kameran. Lägg inte för stor vikt vid filnamnen: de följer
learnopengls lista över sidor, där `front` är +Z – så när kameran tittar längs -z ser du på `back.png`.

Om du lägger ut de sex sidorna platt som en uppvikt kub får du en korsformad bild: de fyra vågräta sidorna i en rad med
den övre sidan ovanför och den nedre under. Sedda inifrån kuben ger de illusionen av att befinna sig i en stor
utomhusmiljö.

### Ladda en skybox

Eftersom en skybox i sig bara är en cube map är det inte så annorlunda att ladda en skybox jämfört med det vi har sett
i början av kapitlet. För att ladda skyboxen använder vi följande funktion, som tar emot en vector med 6
textursökvägar:

:::opengl
```cpp
// loads a cubemap texture from 6 individual texture faces
// order:
// +X (right)
// -X (left)
// +Y (top)
// -Y (bottom)
// +Z (front)
// -Z (back)
// -------------------------------------------------------
unsigned int loadCubemap(std::vector<std::string> faces)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);

    // no flip: the cube map rule puts each image's first row (its top) at the top of the face
    stbi_set_flip_vertically_on_load(false);
    int width, height, nrComponents;
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        unsigned char *data = stbi_load(faces[i].c_str(), &width, &height, &nrComponents, 0);
        if (data)
        {
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
        else
        {
            std::cout << "Cubemap texture failed to load at path: " << faces[i] << std::endl;
            stbi_image_free(data);
        }
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);

    return textureID;
}
```

Funktionen i sig borde inte vara så överraskande. Den är i stort sett all cube map-kod vi såg i förra avsnittet,
samlad i en enda hanterbar funktion. Den hamnar i slutet av `main.cpp`, med sin prototyp
`unsigned int loadCubemap(std::vector<std::string> faces);` överst bredvid `loadTexture`s (och `#include <string>` och
`#include <vector>`).

En rad förtjänar uppmärksamhet: `stbi_set_flip_vertically_on_load(false)`. Vår `loadTexture` vänder varje bild vid
inläsningen, eftersom OpenGL:s v = 0 är nederkanten av en 2D-textur. Cube maps följer en annan regel: specifikationen
lägger varje sidbilds första rad – bildens överkant – vid sidans överkant, sett inifrån kuben. Sidorna måste alltså
läsas in som de är, och eftersom stb_images vändningsinställning är global stänger `loadCubemap` av den innan den
läser in dem.

Innan vi anropar funktionen lägger vi texturernas sökvägar i en vector, i den ordning som cube mapens enum-värden
anger:

```cpp
    std::vector<std::string> faces
    {
        "skybox/right.png",
        "skybox/left.png",
        "skybox/top.png",
        "skybox/bottom.png",
        "skybox/front.png",
        "skybox/back.png"
    };
    unsigned int cubemapTexture = loadCubemap(faces);
```

I slutet av `main` tar `glDeleteTextures(1, &cubemapTexture);` bort den tillsammans med marmortexturen.
:::
:::vulkan
I Vulkan läser funktionen in de sex bilderna, kopierar dem efter varandra till en enda staging buffer, skapar imagen
med sex lager, kopierar sida i till lager i och skapar kubvyn. Delarna är de från vulkan-tutorials texturkapitel,
`createTextureImage`, `transitionImageLayout` och `copyBufferToImage`, utökade till sex lager:

```cpp
    // learnopengl's loadCubemap: six images -> one cube map. A cube map is an image with 6 array layers, one per face,
    // in the order +X (right), -X (left), +Y (top), -Y (bottom), +Z (front), -Z (back), read through a cube view.
    // The images are not flipped: the cube map rules put each image's first row (its top) at the top of the face.
    void loadCubemap(const std::vector<std::string>& faces, VkImage& image, VkDeviceMemory& imageMemory, VkImageView& imageView) {
        // the six images, all of the same size, as RGBA
        std::array<stbi_uc*, 6> pixels{};
        int texWidth = 0, texHeight = 0, texChannels = 0;
        for (size_t i = 0; i < faces.size(); i++) {
            pixels[i] = stbi_load(faces[i].c_str(), &texWidth, &texHeight, &texChannels, STBI_rgb_alpha);
            if (!pixels[i]) {
                throw std::runtime_error("failed to load cubemap texture " + faces[i] + "!");
            }
        }
        VkDeviceSize faceSize = texWidth * texHeight * 4;

        // one staging buffer with the six faces one after the other
        VkBuffer stagingBuffer;
        VkDeviceMemory stagingBufferMemory;
        createBuffer(faceSize * 6, VK_BUFFER_USAGE_TRANSFER_SRC_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, stagingBuffer, stagingBufferMemory);

        void* data;
        vkMapMemory(device, stagingBufferMemory, 0, faceSize * 6, 0, &data);
        for (size_t i = 0; i < 6; i++) {
            memcpy(static_cast<stbi_uc*>(data) + faceSize * i, pixels[i], static_cast<size_t>(faceSize));
            stbi_image_free(pixels[i]);
        }
        vkUnmapMemory(device, stagingBufferMemory);
```

Imagen skapas med create info från förra avsnittet, och dess minne allokeras och binds som i `createImage`. Sedan
kommer layoutövergångarna och kopieringen. Barriärerna är de från `transitionImageLayout`, men deras subresource range
täcker alla sex lagren – `barrier.subresourceRange.layerCount = 6;` – och kopieringen har en region per sida:

```cpp
        // face i of the staging buffer -> array layer i (learnopengl: GL_TEXTURE_CUBE_MAP_POSITIVE_X + i)
        std::array<VkBufferImageCopy, 6> regions{};
        for (uint32_t i = 0; i < 6; i++) {
            regions[i].bufferOffset = faceSize * i;
            regions[i].bufferRowLength = 0;
            regions[i].bufferImageHeight = 0;
            regions[i].imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
            regions[i].imageSubresource.mipLevel = 0;
            regions[i].imageSubresource.baseArrayLayer = i;
            regions[i].imageSubresource.layerCount = 1;
            regions[i].imageOffset = {0, 0, 0};
            regions[i].imageExtent = {static_cast<uint32_t>(texWidth), static_cast<uint32_t>(texHeight), 1};
        }
        vkCmdCopyBufferToImage(commandBuffer, stagingBuffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, static_cast<uint32_t>(regions.size()), regions.data());
```

Loopen med `bufferOffset = faceSize * i` och `baseArrayLayer = i` är learnopengls loop över
`GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`. Efter den andra barriären (till `VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`)
förstörs staging buffern och kubvyn skapas. Funktionen hamnar där dess TODO står, bredvid `loadTexture`; `faceSize` är
storleken på en RGBA-sida i bytes.

Lägg märke till vad funktionen *inte* gör: vänder bilderna. En cube map har en egen regel för hur en sidbild ligger på
kuben – varje bilds första rad, bildens överkant, vid sidans överkant sett inifrån – och Vulkans regel är OpenGL:s.
y-vändningen i vår projektionsmatris ändrar inget av detta: den vänder bara bilden på skärmen rätt, riktningarna i
världen förblir desamma. Bilderna läses alltså in som de är, och himlen ser exakt ut som i OpenGL-kapitlet.

I `initVulkan()` räknar vi upp de sex filerna i lagrens ordning och anropar funktionen efter `createCommandPool()`
(den spelar in kommandon), följd av samplern:

```cpp
        std::vector<std::string> faces = {
            "textures/skybox/right.png",
            "textures/skybox/left.png",
            "textures/skybox/top.png",
            "textures/skybox/bottom.png",
            "textures/skybox/front.png",
            "textures/skybox/back.png"
        };
        loadCubemap(faces, cubemapImage, cubemapImageMemory, cubemapImageView);
```

Medlemmarna är `VkImage cubemapImage;`, `VkDeviceMemory cubemapImageMemory;`, `VkImageView cubemapImageView;` och
`VkSampler cubemapSampler;`; `cleanup()` förstör dem tillsammans med de andra texturerna (`#include <string>` för
filnamnen).
:::
:::d3d12
I Direct3D 12 läser funktionen in de sex bilderna, skapar texturen med sex skivor och en upload heap som rymmer alla,
spelar in kopieringen av de sex sidorna och en barriär, och skapar kub-SRV:n. Den är `LoadTexture` utökad till sex
skivor:

```cpp
void D3D12App::LoadCubemap(const std::vector<std::string>& faces, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex)
{
    // Load the six images as RGBA. No vertical flip: a face's first row is its top
    // (learnopengl also loads its cube map without the flip).
    int width = 0, height = 0, nrChannels = 0;
    unsigned char* data[6] = {};
    for (UINT i = 0; i < 6; i++)
    {
        data[i] = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 4);
        if (data[i] == nullptr)
        {
            throw std::runtime_error("Cubemap texture failed to load at path: " + faces[i]);
        }
    }
```

Sedan resursbeskrivningen från förra avsnittet, `CreateCommittedResource` i tillståndet COPY_DEST, och en upload heap.
Dess storlek kommer från `GetRequiredIntermediateSize(texture.Get(), 0, 6)` – alla sex subresurserna, lagda så som
GPU:n vill ha dem. Själva kopieringen tar en `D3D12_SUBRESOURCE_DATA` per sida:

```cpp
    // One D3D12_SUBRESOURCE_DATA per face: subresource i is array slice i, the face
    // GL_TEXTURE_CUBE_MAP_POSITIVE_X + i in OpenGL. UpdateSubresources copies all six into
    // the upload heap now and schedules the copy into the texture.
    D3D12_SUBRESOURCE_DATA faceData[6] = {};
    for (UINT i = 0; i < 6; i++)
    {
        faceData[i].pData = data[i];
        faceData[i].RowPitch = width * 4;
        faceData[i].SlicePitch = faceData[i].RowPitch * height;
    }
    UpdateSubresources(m_commandList.Get(), texture.Get(), uploadHeap.Get(), 0, 0, 6, faceData);
```

`UpdateSubresources(commandList, destination, intermediate, intermediateOffset, firstSubresource, numSubresources,
data)`: subresurs 0 till 5 – learnopengls loop över `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`. Efter den kommer en barriär
från COPY_DEST till PIXEL_SHADER_RESOURCE, kub-SRV:n på plats `descriptorIndex` i CBV/SRV-heapen, och de sex bilderna
frigörs. Funktionen hamnar där dess TODO står, i slutet av filen, och dess deklaration i klassen:

```cpp
    void LoadCubemap(const std::vector<std::string>& faces, ComPtr<ID3D12Resource>& texture, ComPtr<ID3D12Resource>& uploadHeap, UINT descriptorIndex);
```

Lägg märke till vad funktionen *inte* gör: vänder bilderna. En cube map har en egen regel för hur en sidbild ligger på
kuben – varje bilds första rad, bildens överkant, vid sidans överkant sett inifrån – och Direct3D:s regel är OpenGL:s.
Bilderna läses alltså in som de är, och himlen ser exakt ut som i OpenGL-kapitlet.

I `LoadAssets`, efter marmorn, räknar vi upp de sex filerna i skivornas ordning och läser in dem i en ny medlem
`ComPtr<ID3D12Resource> m_skyboxTexture;`, med SRV:n på heap-plats 2 (heapen växer till
`cbvSrvHeapDesc.NumDescriptors = 3;`, och `#include <vector>` hamnar överst):

```cpp
    std::vector<std::string> faces
    {
        "skybox/right.png",
        "skybox/left.png",
        "skybox/top.png",
        "skybox/bottom.png",
        "skybox/front.png",
        "skybox/back.png"
    };
    ComPtr<ID3D12Resource> skyboxTextureUploadHeap;
    LoadCubemap(faces, m_skyboxTexture, skyboxTextureUploadHeap, 2);
```

Upload heapen måste leva tills command listen som kopierar från den har körts – precis som marmorns är den en lokal
variabel som lever till slutet av `LoadAssets`, som väntar på GPU:n.
:::

Gör nu den första uppgiften, **load-cubemap**, och tryck på **Build & run**. Ingenting ändras – cube mapen är inläst,
men ingenting samplar den än. Det ändrar vi nu.

:::opengl
```quiz
Varför anropar `loadCubemap` `stbi_set_flip_vertically_on_load(false)` innan sidorna läses in?
- [x] Cube maps lägger varje bilds första rad vid sidans överkant, så sidorna får inte vändas – och `loadTexture` hade slagit på vändningen för alla följande inläsningar
- [ ] Cube map-sidor måste lagras upp och ned
- [ ] `stbi_load` kan inte läsa in RGB-bilder med vändningen påslagen
- [ ] Vändningen skulle byta plats på +Y- och -Y-sidorna
---
2D-texturerna vänds eftersom OpenGL:s v = 0 är nederkanten av en 2D-textur. Regeln för cube maps är en annan – första raden är sidans överkant – och stb_images inställning är global, så den måste stängas av igen.
```
:::
:::vulkan
```quiz
Vad gör de sex lagren i `cubemapImage` till en cube map som en `samplerCube` kan sampla?
- [ ] Det räcker att kopiera sidorna i ordningen +X, -X, +Y, -Y, +Z, -Z
- [x] Imagen skapas med `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT` och läses genom en `VK_IMAGE_VIEW_TYPE_CUBE`-view av alla sex lagren
- [ ] En särskild descriptortyp för cube maps i descriptor set layouten
- [ ] Samplerns `VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`
---
Imagen är en vanlig 2D-image med sex lager; flaggan tillåter en kubvy av den, och kubvyn är det som shadern samplar med en riktning. Descriptorn är fortfarande en combined image sampler.
```
:::
:::d3d12
```quiz
Vad gör de sex skivorna i `m_skyboxTexture` till en cube map som en `TextureCube` kan sampla?
- [ ] En särskild resursdimension för cube maps i resursbeskrivningen
- [ ] Den statiska samplern `s1` med adresseringsläget CLAMP
- [x] Dess SRV har `ViewDimension = D3D12_SRV_DIMENSION_TEXTURECUBE`: vyn visar 2D-texturens sex skivor för shadern som en kub
- [ ] `UpdateSubresources` med sex subresurser
---
Resursen är en 2D-textur med `DepthOrArraySize = 6`; TEXTURECUBE-vyn är det som får shadern att se en kub som den kan sampla med en riktning. Root-signaturen rymmer fortfarande bara en SRV på `t0`.
```
:::

### Visa en skybox

Eftersom en skybox ritas på en kub behöver vi ytterligare en VAO, VBO och en ny uppsättning vertexar som för vilket
annat 3D-objekt som helst. Skyboxen är en kub från -1 till 1 runt origo; dess vertexar behöver bara positioner,
eftersom positionen är riktningen vi samplar med.

:::opengl
learnopengls `skyboxVertices` är 36 vertexar med 3 floats vardera:

```cpp
    float skyboxVertices[] = {
        // positions
        -1.0f,  1.0f, -1.0f,
        -1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f,  1.0f, -1.0f,
        -1.0f,  1.0f, -1.0f,
        ...
    };
```

(hela listan finns i uppgiftens tips och i lösningen), med en VAO som bara har ett attribut:

```cpp
    // skybox VAO
    unsigned int skyboxVAO, skyboxVBO;
    glGenVertexArrays(1, &skyboxVAO);
    glGenBuffers(1, &skyboxVBO);
    glBindVertexArray(skyboxVAO);
    glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), &skyboxVertices, GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glBindVertexArray(0);
```
:::
:::vulkan
Alla vertexar ligger i en enda vertex buffer, så learnopengls `skyboxVertices` läggs till sist i `vertices`, efter
kuben – de blir vertex 36..71. En `Vertex` har en position och texturkoordinater; skyboxen behöver bara positionen, så
varje vertex anger bara den, och texturkoordinaterna värdeinitieras till noll:

```cpp
    // skybox: vertices 36..71, learnopengl's skyboxVertices - a cube from -1 to 1 around the origin, positions only
    // (the texture coordinates stay 0: the skybox's shader does not read them)
    {{-1.0f,  1.0f, -1.0f}},
    {{-1.0f, -1.0f, -1.0f}},
    {{ 1.0f, -1.0f, -1.0f}},
    {{ 1.0f, -1.0f, -1.0f}},
    {{ 1.0f,  1.0f, -1.0f}},
    {{-1.0f,  1.0f, -1.0f}},
    ...
```

(hela listan finns i lösningen.)
:::
:::d3d12
Alla vertexar ligger i en enda vertex buffer, så learnopengls `skyboxVertices` hamnar sist i `vertices[]`, efter
kuben – de blir vertex 36 till 71. En `Vertex` har en position och texturkoordinater; skyboxen behöver bara
positionen, och `{}` lämnar det andra attributet på noll:

```cpp
            // the skybox: vertices 36 to 71 - a cube from -1 to 1 around the origin. Only the
            // positions matter: they are the directions the skybox shader samples the cube
            // map in. {} leaves the other attribute at zero (the skybox shader does not read it).
            { { -1.0f,  1.0f, -1.0f }, {} },
            { { -1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f, -1.0f, -1.0f }, {} },
            { {  1.0f,  1.0f, -1.0f }, {} },
            { { -1.0f,  1.0f, -1.0f }, {} },
            ...
```

(hela listan finns i lösningen.)
:::

En cube map som texturerar en 3D-kub kan samplas med kubens lokala positioner som texturkoordinater. När en kub är
centrerad i origo (0,0,0) är var och en av dess positionsvektorer också en riktningsvektor från origo. Den
riktningsvektorn är precis vad vi behöver för att få texturvärdet vid just den positionen på kuben. Därför behöver vi
bara ange positionsvektorer och inga texturkoordinater.

För att rendera skyboxen behöver vi en ny uppsättning shadrar, som inte är särskilt komplicerade. Eftersom vi bara har
ett vertexattribut är vertex shadern ganska enkel:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 TexCoords;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    TexCoords = aPos; // the direction from the centre of the cube to the vertex
    gl_Position = projection * view * vec4(aPos, 1.0);
}
```

Det intressanta med den här vertex shadern är att vi sätter den inkommande lokala positionsvektorn som utgående
texturkoordinat, för (interpolerad) användning i fragment shadern. Fragment shadern tar dem sedan som indata för att
sampla en `samplerCube`:

```glsl
#version 330 core
out vec4 FragColor;

in vec3 TexCoords;

uniform samplerCube skybox;

void main()
{
    FragColor = texture(skybox, TexCoords);
}
```
:::
:::vulkan
```glsl
void main() {
    fragTexCoord = inPosition; // the direction from the centre of the cube to the vertex
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
    gl_Position = ubo.proj * view * vec4(inPosition, 1.0);
}
```

Det intressanta med den här vertex shadern är att vi sätter den inkommande lokala positionsvektorn som utgående
texturkoordinat, för (interpolerad) användning i fragment shadern. Fragment shadern tar dem sedan som indata för att
sampla `samplerCube`, som visades ovan: `outColor = texture(skybox, fragTexCoord);`. (Raden med `mat3` kommer vi till
strax.)
:::
:::d3d12
Skyboxens shadrar hamnar i `skybox.hlsl`. De deklarerar cube mapen, den clampande samplern och scenens constant buffer
med de två matriserna:

```hlsl
// The cube map: register t0, in the descriptor table of root parameter 2.
TextureCube skybox : register(t0);
// The sampler: register s1, the static sampler that clamps to the edge.
SamplerState clampSampler : register(s1);

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 texCoords : TEXCOORD;    // a direction, not a point on a 2D image
};

// The vertex shader: the skybox stays around the camera, however far it moves.
PSInput VSMain(float3 position : POSITION)
{
    PSInput result;

    // The direction from the centre of the cube to the vertex.
    result.texCoords = position;
    // (float3x3)view is the view matrix without its translation (learnopengl:
    // mat4(mat3(view))): the camera turns, but never gets nearer to the sky.
    float3 viewPosition = mul(position, (float3x3)view);
    result.position = mul(float4(viewPosition, 1.0f), projection);

    return result;
}
```

Det intressanta med den här vertex shadern är att vi sätter den inkommande lokala positionsvektorn som utgående
texturkoordinat, för (interpolerad) användning i pixel shadern. Pixel shadern tar dem sedan som indata för att sampla
`TextureCube`, som visades ovan: `return skybox.Sample(clampSampler, input.texCoords);`. Vertex shadern läser bara
elementet `POSITION` i input layouten; elementet `TEXCOORD` finns kvar i layouten, men en vertex shader får strunta i
element som den inte deklarerar. (Raden med `float3x3` kommer vi till strax.)
:::

Fragment shadern är ganska okomplicerad. Vi tar vertexattributets interpolerade positionsvektor som texturens
riktningsvektor och använder den för att sampla texturvärdena ur cube mapen.

Att rendera skyboxen är enkelt nu när vi har en cube map-textur: vi binder helt enkelt cube map-texturen, och
skyboxens sampler fylls automatiskt med skyboxens cube map. För att rita skyboxen ritar vi den som det första föremålet
i scenen och stänger av skrivningen till djupbuffern. På så sätt ritas skyboxen alltid i bakgrunden bakom alla andra
föremål, eftersom enhetskuben med största sannolikhet är mindre än resten av scenen.

:::opengl
```cpp
        // skybox: drawn first and without writing to the depth buffer, so everything else is drawn in front of it
        glDepthMask(GL_FALSE);
        skyboxShader.use();
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
        skyboxShader.setMat4("projection", projection);
        glBindVertexArray(skyboxVAO);
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        glDepthMask(GL_TRUE);
```

Shaderprogrammet är `Shader skyboxShader("skybox.vs", "skybox.fs");`, och i shaderkonfigurationen sätts dess sampler
till texturenhet 0 (`skyboxShader.use(); skyboxShader.setInt("skybox", 0);`). VAO:n och VBO:n tas bort i slutet av
`main`.
:::
:::vulkan
I Vulkan är "stäng av skrivningen till djupbuffern" en del av pipelinen: `depthStencil.depthWriteEnable = VK_FALSE`.
Skyboxen behöver därför en egen pipeline, `skyboxPipeline`, och `createPipeline` får tre nya parametrar – hur många
vertexattribut pipelinen beskriver, om den skriver djup, och dess compare op (som behövs i nästa avsnitt):

```cpp
    void createPipeline(const std::string& vertShaderFile, const std::string& fragShaderFile, uint32_t attributeCount, VkBool32 depthWriteEnable, VkCompareOp depthCompareOp, VkPipeline& pipeline) {
```

Inuti beskriver `vertexInputInfo.vertexAttributeDescriptionCount = attributeCount;` bara de första `attributeCount`
attributen i en `Vertex`, och djuptillståndet använder parametrarna:

```cpp
        depthStencil.depthWriteEnable = depthWriteEnable;
        depthStencil.depthCompareOp = depthCompareOp;
```

Skyboxens shader läser bara positionen, så dess pipeline beskriver bara attribut 0 (ett beskrivet attribut som shadern
inte läser skulle ge en prestandavarning från valideringslagret). I `initVulkan()`:

```cpp
        createPipeline("shaders/cubemaps.vert.spv", "shaders/cubemaps.frag.spv", 2, VK_TRUE, VK_COMPARE_OP_LESS, graphicsPipeline); // position and texture coordinates
        // the skybox only needs the position, and it does not write to the depth buffer: everything drawn after it is
        // drawn in front of it
        createPipeline("shaders/skybox.vert.spv", "shaders/skybox.frag.spv", 1, VK_FALSE, VK_COMPARE_OP_LESS, skyboxPipeline);
```

Cube mapen når shadern genom ett eget descriptor set, `skyboxDescriptorSet`, skapat med projektets hjälpfunktion
(poolen behöver nu plats för 2 set: `maxSets = 2` och `descriptorCount` 2 för båda poolstorlekarna):

```cpp
        createDescriptorSet(cubemapImageView, cubemapSampler, skyboxDescriptorSet);
```

I `recordCommandBuffer()`, efter att vertex buffern har bundits och före kuberna, ritas skyboxen först:

```cpp
        // skybox: drawn first and without writing to the depth buffer, so everything else is drawn in front of it
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, skyboxPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &skyboxDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 36, 1, 36, 0); // the skybox's 36 vertices start at vertex 36
```

Kuberna binder sedan `graphicsPipeline` och sitt eget descriptor set som förut. `skyboxPipeline` förstörs i
`cleanup()` tillsammans med den andra pipelinen.
:::
:::d3d12
I Direct3D 12 är "stäng av skrivningen till djupbuffern" en del av pipeline state objectets depth stencil-tillstånd:
`DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` behåller djuptestet men skriver ingenting. Skyboxen behöver därför ett
eget PSO, `m_skyboxPipelineState` – scenens beskrivning med shadrarna i `skybox.hlsl`, skapat direkt efter
`m_pipelineState`:

```cpp
        // The skybox's pipeline state: the same description with the shaders of skybox.hlsl,
        // and the depth test on but no depth writes (learnopengl: glDepthMask(GL_FALSE)).
        ComPtr<ID3DBlob> skyboxVertexShader;
        ComPtr<ID3DBlob> skyboxPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"skybox.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &skyboxVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"skybox.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &skyboxPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(skyboxVertexShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(skyboxPixelShader.Get());
        psoDesc.DepthStencilState.DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO;
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_skyboxPipelineState)));
```

I `PopulateCommandList` behöver vi GPU-handtaget för cube mapens SRV bredvid marmorns:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE skyboxTexture(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
```

och före kuberna ritas skyboxen först:

```cpp
    // skybox: drawn first and without writing to the depth buffer, so everything else is
    // drawn in front of it. Its own pipeline state, the cube map, 36 vertices from vertex 36 on.
    m_commandList->SetPipelineState(m_skyboxPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, skyboxTexture);
    m_commandList->DrawInstanced(36, 1, 36, 0);
    m_commandList->SetPipelineState(m_pipelineState.Get());    // back to the scene's pipeline state
```

Den sista raden är viktig: pipeline state sätts på command listen och gäller tills nästa `SetPipelineState`, så annars
skulle kuberna ritas med skyboxens shadrar.
:::

Om du körde det här skulle du dock råka ut för problem. Vi vill att skyboxen ska vara centrerad kring spelaren, så att
skyboxen inte kommer närmare hur långt spelaren än rör sig, vilket ger intrycket att den omgivande miljön är extremt
stor. Den nuvarande view-matrisen transformerar däremot alla skyboxens positioner genom att rotera, skala och flytta
dem, så om spelaren rör sig, rör sig cube mapen också! Vi vill ta bort translationsdelen av view-matrisen, så att bara
rotationen påverkar skyboxens positionsvektorer.

Du kanske minns från kapitlet om grundläggande ljussättning att vi kan ta bort translationsdelen av en
transformationsmatris genom att ta den övre vänstra 3×3-matrisen ur 4×4-matrisen. Det gör vi genom att omvandla
view-matrisen till en 3×3-matris (som tar bort translationen) och sedan tillbaka till en 4×4-matris:

:::opengl
```cpp
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
```

Det tar bort all translation men behåller alla rotationer, så att användaren fortfarande kan se sig omkring i scenen.
Det är raden i koden ovan: skyboxen får en egen view-matris, utan translationen, medan kuberna fortsätter att använda
den fullständiga.
:::
:::vulkan
```glsl
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
```

Det tar bort all translation men behåller alla rotationer, så att användaren fortfarande kan se sig omkring i scenen.
learnopengl gör det i C++ och ger skyboxens shader en egen view-matris; vårt projekt har en uniform buffer för alla
pipelines, så skyboxens vertex shader gör det själv.
:::
:::d3d12
```hlsl
    float3 viewPosition = mul(position, (float3x3)view);
```

Det tar bort all translation men behåller alla rotationer, så att användaren fortfarande kan se sig omkring i scenen.
learnopengl gör det i C++ och ger skyboxens shader en egen view-matris; vårt projekt har en constant buffer för alla
ritanrop, så skyboxens vertex shader gör det själv. Typomvandlingen `(float3x3)view` behåller matrisens övre vänstra
3×3-del – rotationen – och släpper translationen; att multiplicera resultatet med projektionen kräver sedan en `float4`
igen, med w = 1.
:::

```quiz
Varför använder skyboxen view-matrisen utan dess translation?
- [ ] Translationen skulle vända skyboxen ut och in
- [ ] Utan den ritas skyboxen snabbare
- [ ] En cube map kan inte samplas med förflyttade positioner
- [x] Himlen måste förbli centrerad kring kameran: när kameran vrids ska det ändra vad du ser av den, när den flyttas ska ingen del av himlen komma närmare
---
Med translationen borttagen följer skyboxkuben med kameran, så himlen verkar oändligt långt borta. Rotationen finns kvar, så när du ser dig omkring syns andra delar av himlen.
```

Gör nu uppgiften **skybox** och tryck på **Build & run**. Den mörkgrå bakgrunden är borta: bakom kuberna finns en blå
himmel med moln, grå berg längs horisonten mitt i fönstret, ett ljust dis längs horisonten och gröna rutiga fält
nedanför. Uppe i högra hörnet är himlen ljusare – solen ligger strax utanför synfältet. Kuberna är oförändrade och står
framför himlen. Flytta kameran med musen och WASD-tangenterna: himlen vrids med dig när du ser dig omkring, men du
kommer aldrig närmare bergen.

## En optimering

Just nu har vi renderat skyboxen först, innan vi renderade alla andra föremål i scenen. Det fungerar utmärkt, men är
inte särskilt effektivt. Om vi renderar skyboxen först kör vi fragment shadern för varje pixel på skärmen, trots att
bara en liten del av skyboxen till slut syns; fragment som enkelt hade kunnat kastas med *early depth testing* och
sparat oss värdefull bandbredd.

För att få en liten prestandaförbättring renderar vi därför skyboxen sist. Då är djupbuffern helt fylld med scenens
alla djupvärden, så vi behöver bara rendera skyboxens fragment där det tidiga djuptestet går igenom, vilket kraftigt
minskar antalet anrop av fragment shadern. Problemet är att skyboxen med största sannolikhet ritas ovanpå alla andra
föremål, eftersom den bara är en liten kub runt kameran (från -1 till 1) och klarar de flesta djuptester. Att bara
rendera den utan djuptest är ingen lösning, eftersom skyboxen då ändå skriver över alla andra föremål i scenen när den
ritas sist. Vi behöver lura djupbuffern att tro att skyboxen har det största djupvärdet, 1.0, så att den misslyckas med
djuptestet överallt där ett annat föremål ligger framför den.

I kapitlet om koordinatsystem sa vi att *perspektivdivisionen* utförs efter att vertex shadern har körts, och delar
`gl_Position`s xyz-koordinater med dess w-komponent. Vi vet också från kapitlet om djuptestning att z-komponenten i
resultatet av divisionen är vertexens djupvärde. Med den informationen kan vi sätta utdatapositionens z-komponent lika
med dess w-komponent, vilket ger en z-komponent som alltid är `1.0`, eftersom z-komponenten blir w / w = 1.0 när
perspektivdivisionen tillämpas:

:::opengl
```glsl
void main()
{
    TexCoords = aPos; // the direction from the centre of the cube to the vertex
    vec4 pos = projection * view * vec4(aPos, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
```
:::
:::vulkan
```glsl
void main() {
    fragTexCoord = inPosition; // the direction from the centre of the cube to the vertex
    mat4 view = mat4(mat3(ubo.view)); // remove translation from the view matrix: the sky never comes nearer
    vec4 pos = ubo.proj * view * vec4(inPosition, 1.0);
    gl_Position = pos.xyww; // z = w: after the perspective divide the depth is 1.0, the largest depth value
}
```

I Vulkan är djupintervallet efter perspektivdivisionen 0..1 (OpenGL:s är -1..1, som sedan avbildas på 0..1), men den
bortre änden är 1.0 i båda, så tricket fungerar oförändrat.
:::
:::d3d12
```hlsl
    float3 viewPosition = mul(position, (float3x3)view);
    float4 pos = mul(float4(viewPosition, 1.0f), projection);
    // z = w: after the perspective divide the depth is 1.0, the largest depth value.
    result.position = pos.xyww;
```

I Direct3D är djupintervallet efter perspektivdivisionen 0..1 (OpenGL:s är -1..1, som sedan avbildas på 0..1), men
den bortre änden är 1.0 i båda, så tricket fungerar oförändrat.
:::

De resulterande normaliserade enhetskoordinaterna har då alltid ett z-värde lika med `1.0`: det största djupvärdet.
Skyboxen renderas därmed bara där inga föremål syns (bara där klarar den djuptestet, allt annat ligger framför
skyboxen).

Vi måste ändra djupfunktionen lite genom att sätta den till "mindre än eller lika med" i stället för standardvärdet
"mindre än". Djupbuffern fylls med värdet `1.0` för skyboxen, så vi måste se till att skyboxen klarar djuptestet med
värden *mindre än eller lika med* djupbufferns i stället för *mindre än*:

:::opengl
```cpp
        // draw skybox as last
        glDepthFunc(GL_LEQUAL);  // change depth function so depth test passes when values are equal to depth buffer's content
        skyboxShader.use();
        skyboxShader.setMat4("view", glm::mat4(glm::mat3(view))); // remove translation from the view matrix
        skyboxShader.setMat4("projection", projection);
        glBindVertexArray(skyboxVAO);
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
        glDepthFunc(GL_LESS); // set depth function back to default
```

Det här blocket ersätter det gamla skyboxblocket och hamnar efter kuberna. Anropen till `glDepthMask` är borta:
skyboxen får skriva sitt djup nu – den ritas sist, och 1.0 är vad djupbuffern ändå innehöll där.
:::
:::vulkan
I Vulkan är compare op en del av pipelinen, så skyboxens pipeline skapas med `VK_COMPARE_OP_LESS_OR_EQUAL`:

```cpp
        // the skybox only needs the position; drawn last at depth 1.0, it passes the test where the depth buffer still
        // holds 1.0 (LESS_OR_EQUAL), and it never needs to write depth
        createPipeline("shaders/skybox.vert.spv", "shaders/skybox.frag.spv", 1, VK_FALSE, VK_COMPARE_OP_LESS_OR_EQUAL, skyboxPipeline);
```

och dess tre kommandon flyttar från före kuberna till efter dem, direkt före `vkCmdEndRenderPass`:

```cpp
        // draw skybox as last: its pipeline passes the depth test when the depth equals the buffer's content (1.0),
        // so the sky is only drawn where nothing else was
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, skyboxPipeline);
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &skyboxDescriptorSet, 0, nullptr);
        vkCmdDraw(commandBuffer, 36, 1, 36, 0); // the skybox's 36 vertices start at vertex 36
```

Det behövs ingen "återställning av djupfunktionen" efteråt som i OpenGL: compare op hör till `skyboxPipeline`, och
kubernas pipeline behåller `VK_COMPARE_OP_LESS`.
:::
:::d3d12
I Direct3D 12 är djupfunktionen en del av PSO:t, så skyboxens PSO får `D3D12_COMPARISON_FUNC_LESS_EQUAL` – raden med
`DepthWriteMask` blir:

```cpp
        psoDesc.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_LESS_EQUAL;
```

Skyboxen får skriva sitt djup nu – den ritas sist, och 1.0 är vad djupbuffern ändå innehöll där. Dess tre anrop
flyttar från före kuberna till efter dem, före barriären som avslutar bildrutan:

```cpp
    // skybox: drawn last, only where nothing else has been drawn (the depth test with
    // LESS_EQUAL against the cleared 1.0) - the pixels the cubes cover are not shaded twice.
    m_commandList->SetPipelineState(m_skyboxPipelineState.Get());
    m_commandList->SetGraphicsRootDescriptorTable(2, skyboxTexture);
    m_commandList->DrawInstanced(36, 1, 36, 0);
```

`SetPipelineState(m_pipelineState.Get())` behövs inte längre: command listen börjar med `m_pipelineState` (det skickas
till `Reset`), och skyboxen är nu det sista ritanropet. Det behövs heller ingen "återställning av djupfunktionen" som i
OpenGL: den hör till skyboxens PSO.
:::

```quiz
Skyboxen ritas sist med sitt djup tvingat till 1.0. Varför behöver den djupfunktionen "mindre än eller lika med" i stället för "mindre än"?
- [ ] "Mindre än" skulle låta skyboxen skriva över kuberna
- [x] Där inget ritades innehåller djupbuffern fortfarande sitt rensade värde 1.0, och 1.0 < 1.0 är falskt – med "mindre än" skulle himlen aldrig ritas
- [ ] "Mindre än eller lika med" får GPU:n att hoppa över fragment shadern för skyboxen
- [ ] Med "mindre än" skulle skyboxen ritas två gånger
---
Djupbuffern rensas till 1.0 och skyboxens fragment har alla djupet 1.0. Bara "lika med" släpper igenom dem på de tomma pixlarna, medan allt som ligger närmare – kuberna – håller dem borta.
```

Gör nu uppgiften **skybox-last** och tryck på **Build & run**. Ingenting syns ändras – och det är just poängen: bilden
är densamma, men skyboxens fragment shader körs inte längre för de pixlar som kuberna täcker.

## Environment mapping

Nu har vi hela den omgivande miljön i ett enda texturobjekt, och den informationen kan vi använda till mer än bara en
skybox. Med en cube map som innehåller en miljö kan vi ge föremål speglande eller ljusbrytande egenskaper. Tekniker som
använder en sådan miljö-cube map kallas *environment mapping*, och de två mest populära är *reflektion* och
*refraktion*.

### Reflektion

Reflektion är egenskapen att ett föremål (eller en del av ett föremål) speglar sin omgivande miljö, det vill säga att
föremålets färger mer eller mindre är lika med omgivningens, beroende på betraktarens vinkel. En spegel är till exempel
ett speglande föremål: den speglar sin omgivning utifrån betraktarens vinkel.

Grunderna i reflektion är inte så svåra. Vi räknar ut en reflektionsvektor R kring föremålets normalvektor N utifrån
blickriktningsvektorn I – vektorn från kameran till fragmentet. Reflektionsvektorn kan vi räkna ut med
{{shaderLanguage}}s inbyggda funktion `reflect`. Den resulterande vektorn R används sedan som riktningsvektor för att
indexera/sampla cube mapen, vilket ger ett färgvärde från miljön. Effekten blir att föremålet verkar spegla skyboxen.

Eftersom vi redan har en skybox i scenen är det inte så svårt att skapa reflektioner. Vi ändrar kubernas fragment
shader så att kuberna får speglande egenskaper. För att räkna ut reflektionsvektorn behöver vi fragmentets position,
kamerans position och normalen vid fragmentet. Kubens vertexar får alltså normaler i stället för texturkoordinater, och
kamerans position skickas till fragment shadern.

:::opengl
```glsl
#version 330 core
out vec4 FragColor;

in vec3 Normal;
in vec3 Position;

uniform vec3 cameraPos;
uniform samplerCube skybox;

void main()
{
    vec3 I = normalize(Position - cameraPos);
    vec3 R = reflect(I, normalize(Normal));
    FragColor = vec4(texture(skybox, R).rgb, 1.0);
}
```

Vi räknar först ut blick-/kamerariktningsvektorn `I` och använder den för att räkna ut reflektionsvektorn `R`, som vi
sedan använder för att sampla skyboxens cube map. Lägg märke till att vi har fragmentets interpolerade `Normal` och
`Position` igen, så vi behöver justera vertex shadern också:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 Normal;
out vec3 Position;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main()
{
    Normal = mat3(transpose(inverse(model))) * aNormal;
    Position = vec3(model * vec4(aPos, 1.0));
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

Vi använder normalvektorer, så vi vill transformera dem med en normalmatris igen. Utdatavektorn `Position` är en
positionsvektor i världsrymden. Den används för att räkna ut blickriktningsvektorn i fragment shadern.

Eftersom vi använder normaler vill du uppdatera vertexdatan med normaler och även uppdatera attributpekarna.
`cubeVertices` blir learnopengls kub med positioner och normaler:

```cpp
    float cubeVertices[] = {
        // positions          // normals
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        ...
    };
```

och attribut 1 har nu 3 floats, med ett stride på 6:

```cpp
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
```

Se också till att sätta uniformen `cameraPos`, bredvid projektionen i renderloopen:

```cpp
        shader.setVec3("cameraPos", cameraPos);
```

Sedan vill vi också binda cube map-texturen innan kuberna renderas:

```cpp
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture); // the cubes reflect the sky
```

Marmorn behövs inte längre: dess `loadTexture`-anrop och dess `glDeleteTextures` försvinner, och
shaderkonfigurationen sätter den nya samplern, `shader.setInt("skybox", 0);`, i stället för `texture1`.
:::
:::vulkan
I `shaders/cubemaps.frag`:

```glsl
#version 450

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    vec3 cameraPos;
} ubo;

layout(binding = 1) uniform samplerCube skybox;

layout(location = 0) in vec3 fragNormal;
layout(location = 1) in vec3 fragPosition;

layout(location = 0) out vec4 outColor;

void main() {
    vec3 I = normalize(fragPosition - ubo.cameraPos); // from the camera to the fragment
    vec3 R = reflect(I, normalize(fragNormal));       // mirrored at the surface
    outColor = vec4(texture(skybox, R).rgb, 1.0);
}
```

Vi räknar först ut blick-/kamerariktningsvektorn `I` och använder den för att räkna ut reflektionsvektorn `R`, som vi
sedan använder för att sampla skyboxens cube map. Lägg märke till att vi har fragmentets interpolerade normal och
position igen, så vi behöver justera vertex shadern, `shaders/cubemaps.vert`, också:

```glsl
layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;

layout(location = 0) out vec3 fragNormal;
layout(location = 1) out vec3 fragPosition;

void main() {
    fragNormal = mat3(transpose(inverse(pc.model))) * inNormal;
    fragPosition = vec3(pc.model * vec4(inPosition, 1.0));
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

(dess uniform block får samma medlem `vec3 cameraPos;`, så att båda shadrarna beskriver buffern likadant). Vi använder
normalvektorer, så vi vill transformera dem med en normalmatris igen. `fragPosition` är en positionsvektor i
världsrymden, som används för att räkna ut blickriktningsvektorn i fragment shadern.

Eftersom vi använder normaler får `Vertex` medlemmen `glm::vec3 normal;` i stället för `glm::vec2 texCoord;`, och
attribut 1 beskriver den:

```cpp
        attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
        attributeDescriptions[1].offset = offsetof(Vertex, normal);
```

Kubens 36 vertexar blir learnopengls kub med positioner och normaler, till exempel
`{{-0.5f, -0.5f, -0.5f}, { 0.0f,  0.0f, -1.0f}},` (skyboxens vertexar ändras inte – det är nu deras normaler som förblir
noll).

Kamerans position färdas i uniform buffern, efter `proj`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    glm::vec3 cameraPos; // the fragment shader needs it for the view direction
};
```

I uniform blockets std140-layout måste en `vec3` börja på en multipel av 16 bytes; `cameraPos` kommer efter två
matriser, på offset 128, så C++-structen och blocket stämmer överens utan utfyllnad. `updateUniformBuffer()` sätter
den, `ubo.cameraPos = cameraPos;`. Eftersom fragment shadern nu också läser uniform buffern måste dess binding vara
synlig för det steget:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT; // cameraPos for the fragment shader
```

Till sist ritas kuberna med cube mapen: de binder `skyboxDescriptorSet` i stället för `cubeDescriptorSet`. Marmorn
behövs inte längre – dess image, view, minne, `textureSampler` och `cubeDescriptorSet` försvinner, och poolen krymper
tillbaka till ett set.
:::
:::d3d12
I `cubemaps.hlsl`, pixel shadern:

```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // The direction from the camera to the pixel, mirrored at the surface: the cube map
    // is sampled in the reflected direction.
    float3 I = normalize(input.fragPos - cameraPos);
    float3 R = reflect(I, normalize(input.normal));
    return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);
}
```

Vi räknar först ut blick-/kamerariktningsvektorn `I` och använder den för att räkna ut reflektionsvektorn `R`, som vi
sedan använder för att sampla skyboxens cube map. Lägg märke till att vi har pixelns interpolerade normal och position
igen, så vi behöver justera vertex shadern också:

```hlsl
// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float3 fragPos : POSITION;    // the position in world space
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    PSInput result;

    float4 worldPosition = mul(position, model);
    result.position = mul(mul(worldPosition, view), projection);
    result.fragPos = worldPosition.xyz;
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    return result;
}
```

Shaderfilens deklarationer ändras med den: `TextureCube skybox : register(t0);` och
`SamplerState clampSampler : register(s1);` i stället för 2D-texturen och `wrapSampler`, `float4x4 normalMatrix;` i
`ModelConstants` efter `model`, och `float3 cameraPos;` i `SceneConstantBuffer` efter `projection`.

Vi använder normalvektorer, så vi vill transformera dem med en normalmatris igen. Som i ljussättningskapitlen räknas
normalmatrisen ut i C++ och skickas med modellmatrisen i root-konstanterna:

```cpp
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

(med `XMFLOAT4X4 normalMatrix;` i C++-structen `ModelConstants`). `fragPos` är en positionsvektor i världsrymden, som
används för att räkna ut blickriktningsvektorn i pixel shadern.

Eftersom vi använder normaler får `Vertex` medlemmen `XMFLOAT3 normal;` i stället för `XMFLOAT2 texCoord;`, och input
layoutens andra element blir en normal:

```cpp
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
```

Kubens 36 vertexar blir learnopengls kub med positioner och normaler, till exempel
`{ { -0.5f, -0.5f, -0.5f }, {  0.0f,  0.0f, -1.0f } },` – skyboxens `{}` passar lika bra för en normal.

Kamerans position färdas i constant buffern, efter `projection`:

```cpp
        XMFLOAT3 cameraPos;
        float padding;    // the size of a constant buffer is a multiple of 16 bytes
```

`OnUpdate` sparar den med `XMStoreFloat3(&constantBufferData.cameraPos, cameraPos);`. Eftersom pixel shadern nu också
läser constant buffern måste root-parameter 1 vara synlig för alla steg:

```cpp
        rootParameters[1].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_ALL);
```

Till sist ritas kuberna med cube mapen: `SetGraphicsRootDescriptorTable(2, skyboxTexture)` i stället för marmorn.
Marmorn behövs inte längre – `m_cubeTexture` och dess `LoadTexture`-anrop försvinner, cube mapen flyttar till
heap-plats 1 (`LoadCubemap(faces, m_skyboxTexture, skyboxTextureUploadHeap, 1);`, heapen krymper till 2 descriptorer)
och GPU-handtaget `skyboxTexture` pekar på plats 1.
:::

```quiz
Vad är `I` i reflektionsshadern, och varför måste kamerans position vara känd för den?
- [ ] Ljusets infallsriktning; kamerans position behövs för ljusets avtagande
- [ ] Normalen i view-rymden; kamerans position omvandlar den från världsrymden till view-rymden
- [ ] Riktningen från fragmentet till skyboxens mitt
- [x] Blickriktningen, från kameran till fragmentet i världsrymden; `reflect` speglar den kring normalen för att hitta vart spegeln "tittar" på himlen
---
En spegel visar det som ligger i den speglade blickriktningen, så resultatet beror på varifrån du tittar. Därför behövs både kubfragmentets position (i världsrymden) och kamerans position.
```

Gör nu uppgiften **reflection** och tryck på **Build & run**. Marmorn är borta, och kuberna har blivit speglar. När
kameran tittar rakt på dem speglar deras framsidor himlen bakom kameran – som ser ungefär ut som himlen bakom kuberna:
himmel upptill, ett band av berg, marken nedtill. Kuberna försvinner nästan in i bakgrunden; du ser dem bara där den
speglade horisonten, molnen och fälten inte stämmer överens med himlen runt omkring. Flytta kameran för att se
reflektionerna ändras. Tryck på A tills du står rakt framför den vänstra kuben, vid x = -1, och titta rakt på den:
dess framsida speglar nu det som finns bakom dig – det rödvitrandiga tornet som står åt +Z, bakom standardkameran.

När reflektion tillämpas på ett helt föremål (som en kub) ser föremålet ut att vara av ett starkt speglande material
som stål eller krom. Om vi laddade en mer intressant modell skulle den se ut att vara helt gjord av krom. Det ser
ganska häftigt ut, men i verkligheten är de flesta modeller inte helt speglande. Vi skulle till exempel kunna införa
*reflection maps* som ger modellerna ytterligare en detaljnivå. Precis som diffuse- och specular maps är reflection maps
texturbilder som vi kan sampla för att avgöra hur speglande ett fragment är. Med reflection maps kan vi avgöra vilka
delar av modellen som visar reflektion och med vilken styrka.

### Refraktion

En annan form av environment mapping kallas *refraktion* (ljusbrytning) och liknar reflektion. Refraktion är
ljusets riktningsändring när materialet som ljuset färdas genom byts. Refraktion är det vi ofta ser vid vattenliknande
ytor, där ljuset inte går rakt in utan böjs lite. Det är som att titta på armen när den är halvvägs nere i vattnet.

Refraktion beskrivs av Snells lag. Med environment maps fungerar det så här: vi har en blickvektor I, en normalvektor N
och den här gången en resulterande refraktionsvektor R: blickvektorns riktning, lätt böjd där den går in i ytan. Den
resulterande böjda vektorn R används sedan för att sampla cube mapen.

Refraktion är ganska enkel att implementera med {{shaderLanguage}}s inbyggda funktion `refract`, som tar emot en
normalvektor, en blickriktning och ett förhållande mellan de båda materialens brytningsindex.

Brytningsindex avgör hur mycket ljuset förvrängs/böjs i ett material, där varje material har sitt eget brytningsindex.
En lista över de vanligaste brytningsindexen finns i följande tabell:

| Material | Brytningsindex |
| --- | --- |
| Luft | 1.00 |
| Vatten | 1.33 |
| Is | 1.309 |
| Glas | 1.52 |
| Diamant | 2.42 |

Vi använder brytningsindexen för att räkna ut förhållandet mellan de båda material som ljuset passerar. I vårt fall går
ljuset/blickstrålen från luft till glas (om vi antar att föremålet är av glas), så förhållandet blir
1.00 / 1.52 = 0.658.

Vi har redan bundit cube mapen, gett vertexdatan normaler och satt kamerans position som uniform. Det enda vi behöver
ändra är fragment shadern:

:::opengl
```glsl
void main()
{
    float ratio = 1.00 / 1.52; // from air (1.00) into glass (1.52)
    vec3 I = normalize(Position - cameraPos);
    vec3 R = refract(I, normalize(Normal), ratio);
    FragColor = vec4(texture(skybox, R).rgb, 1.0);
}
```
:::
:::vulkan
```glsl
void main() {
    float ratio = 1.00 / 1.52; // from air (1.00) into glass (1.52)
    vec3 I = normalize(fragPosition - ubo.cameraPos); // from the camera to the fragment
    vec3 R = refract(I, normalize(fragNormal), ratio); // bent at the surface
    outColor = vec4(texture(skybox, R).rgb, 1.0);
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    // The direction from the camera to the pixel, bent where it enters the glass: the
    // cube map is sampled in the refracted direction.
    float ratio = 1.00f / 1.52f;    // from air (1.00) into glass (1.52)
    float3 I = normalize(input.fragPos - cameraPos);
    float3 R = refract(I, normalize(input.normal), ratio);
    return float4(skybox.Sample(clampSampler, R).rgb, 1.0f);
}
```
:::

Genom att ändra brytningsindexen kan du skapa helt andra visuella resultat.

```quiz
Shadern använder `ratio = 1.00 / 1.52`. Vad beskriver det talet?
- [ ] Hur mycket av himlen som speglas och hur mycket som bryts
- [x] Förhållandet mellan de två materialens brytningsindex: blickstrålen går från luft (1.00) in i glas (1.52)
- [ ] Glaskubens tjocklek i världsenheter
- [ ] Kubens storlek i förhållande till skyboxen
---
`refract` böjer strålen enligt Snells lag, som beror på förhållandet mellan brytningsindexen på ytans båda sidor. För vatten i stället för glas skulle det vara 1.00 / 1.33.
```

Gör den sista uppgiften, **refraction**, och tryck på **Build & run**. Kuberna ser nu ut som glasblock: du ser himlen
bakom dem genom dem, men böjd – förstorad och förskjuten, så att bergen genom den vänstra kuben ser högre ut än runt
omkring, och dess kontur syns som en lite annorlunda kvadrat mot himlen. Effekten blir mycket tydligare när du flyttar
kameran; prova att gå runt kuberna.

Observera att vi för fysikaliskt korrekta resultat borde bryta ljuset igen när det lämnar föremålet; nu använde vi
bara enkelsidig refraktion, vilket räcker för de flesta ändamål.

### Dynamiska environment maps

Hittills har vi använt en statisk kombination av bilder som skybox, vilket ser bra ut, men den innehåller inte den
faktiska 3D-scenen med eventuella föremål som rör sig. Det har vi inte märkt hittills, eftersom vi bara använde ett
enda föremål. Om vi hade ett spegelliknande föremål med flera föremål runt omkring skulle bara skyboxen synas i spegeln,
som om den vore det enda föremålet i scenen.

Med framebuffers går det att skapa en textur av scenen i alla 6 riktningar från föremålet i fråga och lagra dem i en
cube map varje bildruta. Den (dynamiskt genererade) cube mapen kan vi sedan använda för att skapa realistiska speglande
och ljusbrytande ytor som innehåller alla andra föremål. Det kallas *dynamisk environment mapping*, eftersom vi
dynamiskt skapar en cube map av ett föremåls omgivning och använder den som dess environment map.

:::opengl
I OpenGL kan varje sida av cube mapen kopplas in i en framebuffer som dess färgattachment med
`glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, 0)`, och
scenen ritas sex gånger med ett synfält på 90 grader, en gång längs varje axel.
:::
:::vulkan
I Vulkan får cube map-imagen `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT` bredvid `VK_IMAGE_USAGE_SAMPLED_BIT`, vart och ett
av dess sex lager får en egen 2D-image view och en egen framebuffer, och scenen ritas sex gånger med ett synfält på 90
grader, en gång längs varje axel – förra kapitlets offscreen-render pass, sex gånger.
:::
:::d3d12
I Direct3D 12 får cube map-texturen `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET` och en RTV per sida (en
`D3D12_RTV_DIMENSION_TEXTURE2DARRAY`-vy av en skiva var), och scenen ritas sex gånger med ett synfält på 90 grader, en
gång längs varje axel – förra kapitlets off-screen-render target, sex gånger.
:::

Det ser bra ut, men har en enorm nackdel: vi måste rendera scenen 6 gånger per föremål som använder en environment
map, vilket är ett enormt prestandastraff för programmet. Moderna program försöker använda skyboxen så mycket som
möjligt och förrendera cube maps där de kan, för att ändå på sätt och vis skapa dynamiska environment maps. Även om
dynamisk environment mapping är en utmärkt teknik kräver den många smarta knep och tricks för att fungera i ett riktigt
renderingsprogram utan alltför stora prestandaförluster.
