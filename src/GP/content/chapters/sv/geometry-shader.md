# Geometry shader

Mellan vertex shadern och fragment shadern finns ett valfritt shadersteg som kallas *geometry shader*. En geometry
shader tar som indata en uppsättning vertices som bildar en enda primitiv, till exempel en punkt eller en triangel.
Geometry shadern kan sedan transformera dessa vertices som den vill innan den skickar dem vidare till nästa
shadersteg. Det som gör geometry shadern intressant är att den kan göra om den ursprungliga primitiven (uppsättningen
vertices) till helt andra primitiver, och kanske skapa fler vertices än den fick från början.

:::opengl
I OpenGL ingår geometry shadern i core-profilen sedan version 3.2, så vår 3.3-kontext har den alltid. Du skriver den i
GLSL precis som de två andra stegen, kompilerar den som en `GL_GEOMETRY_SHADER` och länkar in den i samma program.
:::
:::vulkan
I Vulkan är geometry shadern en *valfri device-funktion* (feature), `geometryShader`: de flesta GPU:er för datorer har
den, men många mobila GPU:er saknar den (och Apples Metal, som MoltenVK översätter Vulkan till, har inga geometry
shaders alls). Som varje valfri funktion måste den slås på när den logiska devicen skapas innan en pipeline får
innehålla ett geometry-steg. Själva shadern är GLSL, kompilerad till SPIR-V som de andra (`shaders/<namn>.geom` blir
`shaders/<namn>.geom.spv`), och den blir ytterligare en `VkPipelineShaderStageCreateInfo` i pipelinen.
:::
:::d3d12
I Direct3D 12 finns geometry shader-steget alltid: varje Direct3D 12-device stöder minst feature level 11_0, som
innehåller det. En geometry shader är en HLSL-funktion med en indataprimitiv och en utdataström, kompilerad med
målet `gs_5_0`, och som varje shader är den en del av ett pipeline state object: `psoDesc.GS`, mellan `VS` och `PS`.
:::

Tekniken är densamma i alla API:er – kapitlet visar den för {{api}} och följer learnopengls tre exempel: punkter som
växer till hus, en modell som exploderar och en modell vars normalvektorer ritas som linjer.

:::opengl
Projektet börjar med learnopengls första exempel före geometry shadern: ingen kamera, inga matriser, rensningsfärgen
(0.1, 0.1, 0.1) och fyra punkter – en 2D-position och en färg var – ritade med `glDrawArrays(GL_POINTS, 0, 4)` av
`geometry_shader.vs` och `geometry_shader.fs`. Projektet innehåller redan Model-kapitlets `mesh.h` och `model.h` och
planeten (`models/planet.obj` med sina texturer) för andra halvan, och shaderfilerna för de senare uppgifterna:
`explode.vs/.fs/.gs`, `default.vs/.fs` och `normal_visualization.vs/.fs/.gs`. `geometry_shader.gs` och
`normal_visualization.gs` är fortfarande tomma förutom en TODO, och `explode.gs` släpper igenom varje triangel
oförändrad.
:::
:::vulkan
Projektet börjar med learnopengls första exempel före geometry shadern: ingen kamera, inga matriser, rensningsfärgen
(0.1, 0.1, 0.1) och learnopengls fyra punkter (`struct PointVertex { glm::vec2 pos; glm::vec3 color; }` i en egen
vertexbuffer, `pointsVertexBuffer`), ritade av `graphicsPipeline` med topologin `VK_PRIMITIVE_TOPOLOGY_POINT_LIST` och
`vkCmdDraw(commandBuffer, static_cast<uint32_t>(points.size()), 1, 0, 0)`. Vulkans y-axel pekar nedåt, så punkternas
y-värden är negerade – learnopengls övre vänstra punkt (-0.5, 0.5) är (-0.5, -0.5) här, och bilden blir densamma.
`createPipeline(vertFile, fragFile, topology, bindingDescription, attributeDescriptions, pipeline)` tar topologin och
vertexindatan som parametrar, eftersom punkterna och modellen skiljer sig i båda. Model-kapitlets kod (tinyobjloader,
planetens vertex- och indexbuffer, dess två diffuse maps, uniform buffern med `view` och `proj`, descriptor seten,
modellmatrisen som push constant) skapas redan i `initVulkan()` men används inte förrän i uppgiften `planet`. Varje
`.geom`-fil kompileras som de andra shadrarna; `geometry_shader.geom` och `normal_visualization.geom` har bara sina
layout-rader och en tom `main`, och `explode.geom` släpper igenom varje triangel oförändrad.

:::ide clion vscode
Din `CMakeLists.txt` kompilerar dem – dess rad `file(GLOB …)` tar med `shaders/*.geom` – till
`shaders/<namn>.geom.spv`.
:::
:::ide vs rider
Pre-build-händelsen i ditt projekt kompilerar dem – dess loop tar med `shaders\*.geom` – till
`shaders\<namn>.geom.spv`.
:::
:::
:::d3d12
Projektet börjar med learnopengls första exempel före geometry shadern: ingen kamera, inga matriser, rensningsfärgen
(0.1, 0.1, 0.1) och learnopengls fyra punkter (`struct PointVertex { XMFLOAT2 position; XMFLOAT3 color; }`) i en
vertexbuffer i en upload heap, ritade med `PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`,
`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_POINTLIST)` och `DrawInstanced(4, 1, 0, 0)`. Shadrarna ligger i
`geometry_shader.hlsl`. Förberett för andra halvan (används inte av punkterna): Model-kapitlets klass `Model`, root
signaturen (root constants `ModelConstants` på b0, en tabell med CBV:n på b1 – synlig för **alla** steg, eftersom
geometry shadrarna läser den – och en tabell med en meshs texturer), constant buffern `SceneConstantBuffer` och
medlemmen `Model m_model;`. `explode.hlsl` (vars geometry shader släpper igenom varje triangel), `default.hlsl` och
`normal_visualization.hlsl` finns där för de senare uppgifterna. Alla pipeline states använder
`CullMode = D3D12_CULL_MODE_NONE`, som learnopengl, som ritar utan face culling.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE. Just nu visar den fyra enstaka pixlar: röd uppe till vänster, grön uppe till höger, gul nere till vänster och blå
nere till höger.

## Använda geometry shaders

Vi börjar med ett exempel på en geometry shader:

:::opengl
```glsl
#version 330 core
layout (points) in;
layout (line_strip, max_vertices = 2) out;

void main() {
    gl_Position = gl_in[0].gl_Position + vec4(-0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    gl_Position = gl_in[0].gl_Position + vec4( 0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    EndPrimitive();
}
```

I början av en geometry shader måste vi deklarera vilken typ av primitiv vi tar emot från vertex shadern. Det gör vi
med en layout-specifikation framför nyckelordet `in`. Den här layout-kvalificeraren för indata kan ta något av
följande värden:

| Indatakvalificerare | Ritlägen | Vertices per primitiv |
|---|---|---|
| `points` | `GL_POINTS` | 1 |
| `lines` | `GL_LINES`, `GL_LINE_STRIP` | 2 |
| `lines_adjacency` | `GL_LINES_ADJACENCY`, `GL_LINE_STRIP_ADJACENCY` | 4 |
| `triangles` | `GL_TRIANGLES`, `GL_TRIANGLE_STRIP`, `GL_TRIANGLE_FAN` | 3 |
| `triangles_adjacency` | `GL_TRIANGLES_ADJACENCY`, `GL_TRIANGLE_STRIP_ADJACENCY` | 6 |

Det är nästan alla primitiver vi kan ge till ritanrop som `glDrawArrays`. Om vi hade valt att rita vertices som
`GL_TRIANGLES` skulle vi sätta indatakvalificeraren till `triangles`. Talet i sista kolumnen är det minsta antalet
vertices som bildar en primitiv.

Vi måste också ange vilken primitivtyp geometry shadern ska ge som utdata, och det gör vi med en layout-specifikation
framför nyckelordet `out`. Precis som för indata kan utdatakvalificeraren ta flera värden: `points`, `line_strip` och
`triangle_strip`. Med bara de här tre kan vi skapa nästan vilken form som helst av indataprimitiverna. För att till
exempel skapa en enda triangel anger vi `triangle_strip` som utdata och ger ut 3 vertices.

Geometry shadern vill också att vi anger det största antalet vertices den ger ut (överskrider du det ritar OpenGL inte
de extra vertices), vilket vi också gör i layout-kvalificeraren för `out`. I just det här fallet ger vi ut en
`line_strip` med högst 2 vertices.

Om du undrar vad en line strip är: en line strip binder ihop en uppsättning punkter till en sammanhängande linje
mellan dem, med minst 2 punkter. Varje extra punkt ger en ny linje mellan den nya punkten och den föregående.

För att kunna göra något meningsfullt behöver vi ett sätt att hämta utdata från föregående shadersteg. GLSL ger oss
en inbyggd variabel som heter `gl_in`, som internt (förmodligen) ser ut ungefär så här:

```glsl
in gl_PerVertex
{
    vec4  gl_Position;
    float gl_PointSize;
    float gl_ClipDistance[];
} gl_in[];
```

Här är den deklarerad som ett interface block (som vi gick igenom i förra kapitlet) med några intressanta variabler,
av vilka den intressantaste är `gl_Position`, som innehåller vektorn vi satte som vertex shaderns utdata. Observera att
den är deklarerad som en array, eftersom de flesta primitiver består av mer än 1 vertex. Geometry shadern får *alla*
vertices i en primitiv som indata.

Med vertexdatan från vertex shadern kan vi skapa ny data med två funktioner i geometry shadern, `EmitVertex` och
`EndPrimitive`. Geometry shadern förväntar sig att du skapar minst en av de primitiver du angav som utdata. Varje gång
vi anropar `EmitVertex` läggs vektorn som just då står i `gl_Position` till utdataprimitiven. När `EndPrimitive`
anropas kombineras alla vertices som getts ut för den här primitiven till den angivna utdataprimitiven. Genom att
anropa `EndPrimitive` flera gånger, efter ett eller flera anrop till `EmitVertex`, kan flera primitiver skapas.
:::
:::vulkan
```glsl
#version 450

layout(points) in;
layout(line_strip, max_vertices = 2) out;

void main() {
    gl_Position = gl_in[0].gl_Position + vec4(-0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    gl_Position = gl_in[0].gl_Position + vec4( 0.1, 0.0, 0.0, 0.0);
    EmitVertex();

    EndPrimitive();
}
```

I början av en geometry shader måste vi deklarera vilken typ av primitiv vi tar emot från vertex shadern. Det gör vi
med en layout-specifikation framför nyckelordet `in`. Den här layout-kvalificeraren för indata kan ta något av
följande värden:

| Indatakvalificerare | Pipelinetopologier | Vertices per primitiv |
|---|---|---|
| `points` | `VK_PRIMITIVE_TOPOLOGY_POINT_LIST` | 1 |
| `lines` | `..._LINE_LIST`, `..._LINE_STRIP` | 2 |
| `lines_adjacency` | `..._LINE_LIST_WITH_ADJACENCY`, `..._LINE_STRIP_WITH_ADJACENCY` | 4 |
| `triangles` | `..._TRIANGLE_LIST`, `..._TRIANGLE_STRIP`, `..._TRIANGLE_FAN` | 3 |
| `triangles_adjacency` | `..._TRIANGLE_LIST_WITH_ADJACENCY`, `..._TRIANGLE_STRIP_WITH_ADJACENCY` | 6 |

I OpenGL är det ritanropet som anger primitiven; i Vulkan är det pipelinens `inputAssembly.topology`, och den måste
passa geometry shaderns indatakvalificerare: en point list för `points`, en triangle list för `triangles`. Talet i
sista kolumnen är antalet vertices som bildar en primitiv.

Vi måste också ange vilken primitivtyp geometry shadern ska ge som utdata, och det gör vi med en layout-specifikation
framför nyckelordet `out`. Utdatakvalificeraren kan ta tre värden: `points`, `line_strip` och `triangle_strip`. Med
bara de här tre kan vi skapa nästan vilken form som helst av indataprimitiverna. För att till exempel skapa en enda
triangel anger vi `triangle_strip` som utdata och ger ut 3 vertices.

Geometry shadern vill också att vi anger det största antalet vertices den ger ut, `max_vertices`, i samma
layout-kvalificerare (vertices därutöver ritas inte; device-gränsen `maxGeometryOutputVertices` är minst 256). I just
det här fallet ger vi ut en `line_strip` med högst 2 vertices.

Om du undrar vad en line strip är: en line strip binder ihop en uppsättning punkter till en sammanhängande linje
mellan dem, med minst 2 punkter. Varje extra punkt ger en ny linje mellan den nya punkten och den föregående.

För att kunna göra något meningsfullt behöver vi ett sätt att hämta utdata från föregående shadersteg. GLSL ger oss
en inbyggd array som heter `gl_in`, ett element per vertex i indataprimitiven:

```glsl
in gl_PerVertex
{
    vec4  gl_Position;
    float gl_PointSize;
    float gl_ClipDistance[];
} gl_in[];
```

Dess intressantaste medlem är `gl_Position`, vektorn som vertex shadern skrev. Den är en array eftersom de flesta
primitiver består av mer än en vertex: geometry shadern får *alla* vertices i en primitiv.

Med vertexdatan från vertex shadern kan vi skapa ny data med två funktioner i geometry shadern, `EmitVertex` och
`EndPrimitive`. Varje gång vi anropar `EmitVertex` läggs vektorn som just då står i `gl_Position` (och de övriga
utdatavariablernas aktuella värden) till utdataprimitiven. När `EndPrimitive` anropas kombineras alla vertices som
getts ut för den här primitiven till den angivna utdataprimitiven. Genom att anropa `EndPrimitive` flera gånger,
efter ett eller flera anrop till `EmitVertex`, kan flera primitiver skapas.
:::
:::d3d12
```hlsl
[maxvertexcount(2)]
void GSMain(point VSOutput input[1], inout LineStream<GSOutput> lineStream)
{
    GSOutput output;
    output.position = input[0].position + float4(-0.1f, 0.0f, 0.0f, 0.0f);
    lineStream.Append(output);

    output.position = input[0].position + float4( 0.1f, 0.0f, 0.0f, 0.0f);
    lineStream.Append(output);

    lineStream.RestartStrip();
}
```

En geometry shader är en funktion (vi kallar den `GSMain`) vars första parameter deklarerar vilken typ av primitiv den
tar emot, som en array av vertex shaderns utdatastruktur. Primitivtypen framför den kan vara någon av dessa:

| Primitivtyp | Topologier (`IASetPrimitiveTopology`) | Arraystorlek |
|---|---|---|
| `point` | `D3D_PRIMITIVE_TOPOLOGY_POINTLIST` | 1 |
| `line` | `..._LINELIST`, `..._LINESTRIP` | 2 |
| `lineadj` | `..._LINELIST_ADJ`, `..._LINESTRIP_ADJ` | 4 |
| `triangle` | `..._TRIANGLELIST`, `..._TRIANGLESTRIP` | 3 |
| `triangleadj` | `..._TRIANGLELIST_ADJ`, `..._TRIANGLESTRIP_ADJ` | 6 |

Topologin som sätts med `IASetPrimitiveTopology` måste passa den, och det måste även pipeline statens
`PrimitiveTopologyType` (`D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`, `_LINE` eller `_TRIANGLE`): med en geometry shader
beskriver den primitiven som geometry shadern tar som indata, inte det som når rastreraren. Arraystorleken är antalet
vertices som bildar en primitiv.

Den andra parametern är utdatan: ett `inout` *stream-output object*, vars typ avgör vilken primitiv geometry shadern
ger ut – `PointStream`, `LineStream` eller `TriangleStream` – och vars mallargument är strukturen för en
utdatavertex. Med bara de här tre sorternas strömmar kan vi skapa nästan vilken form som helst av indataprimitiverna.
För att till exempel skapa en enda triangel använder vi en `TriangleStream` och ger ut 3 vertices.

Geometry shadern måste också deklarera det största antalet vertices den ger ut, med attributet `[maxvertexcount(n)]`
framför funktionen (den totala utdatan från ett anrop är begränsad till 1024 skalärer). I just det här fallet ger vi
ut en line strip med högst 2 vertices.

Om du undrar vad en line strip är: en line strip binder ihop en uppsättning punkter till en sammanhängande linje
mellan dem, med minst 2 punkter. Varje extra punkt ger en ny linje mellan den nya punkten och den föregående.

Indataarrayen innehåller vad vertex shadern returnerade för varje vertex i primitiven – här en, `input[0]` – så det
finns ingen inbyggd variabel som GLSL:s `gl_in`: positionen är medlemmen med semantiken `SV_POSITION`. Nya vertices
skapas med strömmens två metoder: `Append(output)` lägger en kopia av utdatastrukturen, som den är just då, till den
aktuella stripen (GLSL:s `EmitVertex`), och `RestartStrip()` avslutar stripen så att nästa `Append` börjar en ny
primitiv (GLSL:s `EndPrimitive`). Genom att anropa `RestartStrip` flera gånger, efter ett eller flera anrop till
`Append`, kan flera primitiver skapas.
:::

I det här fallet ger vi ut två vertices som är förskjutna en liten bit från den ursprungliga vertexpositionen och
avslutar sedan primitiven, så att de två vertices bildar en line strip med 2 vertices. Varje punkt som går in kommer ut
som en liten vågrät linje.

Nu när du (någorlunda) vet hur geometry shaders fungerar kan du förmodligen gissa vad den här gör. Den tar en punkt
som indata och skapar en vågrät linje med indatapunkten i mitten. Det är en ganska enkel geometry shader, men den
visar hur en geometry shader kan skapa nya former dynamiskt, i farten.

```quiz
En geometry shader deklarerar trianglar som indata. Programmet ritar 12 vertices som en triangle list. Hur många gånger körs geometry shadern?
- [ ] 12 gånger: en gång per vertex, som vertex shadern
- [x] 4 gånger: en gång per triangel, med triangelns tre vertices som indata
- [ ] 3 gånger: en gång per vertex i en triangel
- [ ] En gång för hela ritanropet
---
Vertex shadern körs per vertex; geometry shadern körs per primitiv och får alla primitivens vertices på en gång (en array med 3 för trianglar). 12 vertices i en triangle list är 4 trianglar.
```

### En geometry shader som släpper igenom allt

För att visa hur en geometry shader används ritar vi en riktigt enkel scen med 4 punkter i z-planet i normaliserade
enhetskoordinater – punkterna du ser i fönstret nu. Varje punkt har en position och en färg.

:::opengl
```cpp
float points[] = {
    -0.5f,  0.5f, 1.0f, 0.0f, 0.0f, // top-left
     0.5f,  0.5f, 0.0f, 1.0f, 0.0f, // top-right
     0.5f, -0.5f, 0.0f, 0.0f, 1.0f, // bottom-right
    -0.5f, -0.5f, 1.0f, 1.0f, 0.0f  // bottom-left
};
```

Vertex shadern ska rita punkterna i z-planet, så den är enkel, och fragment shadern ger ut färgen som vertex shadern
skickar vidare. Punkterna ritas med `glDrawArrays(GL_POINTS, 0, 4);`.
:::
:::vulkan
```cpp
// learnopengl's four points, in Vulkan's normalized device coordinates: y points down, so -0.5 is the upper row
const std::vector<PointVertex> points = {
    {{-0.5f, -0.5f}, {1.0f, 0.0f, 0.0f}}, // top-left: red
    {{ 0.5f, -0.5f}, {0.0f, 1.0f, 0.0f}}, // top-right: green
    {{ 0.5f,  0.5f}, {0.0f, 0.0f, 1.0f}}, // bottom-right: blue
    {{-0.5f,  0.5f}, {1.0f, 1.0f, 0.0f}}  // bottom-left: yellow
};
```

Vertex shadern lägger punkterna i z-planet och skriver `gl_PointSize = 1.0;` – Vulkan ritar en point list bara om det
sista shadersteget före rastreraren sätter punkternas storlek (kapitlet *Advanced GLSL* har detaljerna). Fragment
shadern ger ut färgen som vertex shadern skickar vidare.
:::
:::d3d12
```cpp
        PointVertex points[] =
        {
            { { -0.5f,  0.5f }, { 1.0f, 0.0f, 0.0f } },    // top-left
            { {  0.5f,  0.5f }, { 0.0f, 1.0f, 0.0f } },    // top-right
            { {  0.5f, -0.5f }, { 0.0f, 0.0f, 1.0f } },    // bottom-right
            { { -0.5f, -0.5f }, { 1.0f, 1.0f, 0.0f } }     // bottom-left
        };
```

`VSMain` lägger punkterna i z-planet, och `PSMain` returnerar färgen som vertex shadern skickar vidare. En punkt
rastreras alltid som en enda pixel i Direct3D.
:::

Nu lägger vi till en geometry shader som inte gör något ännu: den tar en punkt och skickar den vidare oförändrad,
färgen också. Färgen är det enda nya. Utan geometry shader går vertex shaderns utdata direkt till rastreraren och
fragment shadern; med en geometry shader tar den emot vertex shaderns utdata och måste själv skriva det som fragment
shadern läser, för varje vertex den ger ut.

:::opengl
Gör nu den första uppgiften, **pass-through**. Först måste klassen `Shader` lära sig en tredje shaderfil. I
`shader_m.h` får konstruktorn en valfri parameter:

```cpp
    Shader(const char* vertexPath, const char* fragmentPath, const char* geometryPath = nullptr)
```

När fragment shadern är kompilerad läser och kompilerar du geometry shadern på samma sätt, om en fil är angiven:

```cpp
        // if a geometry shader file is given, read and compile it too
        unsigned int geometry = 0;
        if (geometryPath != nullptr)
        {
            std::string geometryCode;
            std::ifstream gShaderFile;
            gShaderFile.exceptions (std::ifstream::failbit | std::ifstream::badbit);
            try
            {
                gShaderFile.open(geometryPath);
                std::stringstream gShaderStream;
                gShaderStream << gShaderFile.rdbuf();
                gShaderFile.close();
                geometryCode = gShaderStream.str();
            }
            catch (std::ifstream::failure& e)
            {
                std::cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " << e.what() << std::endl;
            }
            const char * gShaderCode = geometryCode.c_str();
            geometry = glCreateShader(GL_GEOMETRY_SHADER);
            glShaderSource(geometry, 1, &gShaderCode, NULL);
            glCompileShader(geometry);
            checkCompileErrors(geometry, "GEOMETRY");
        }
```

Fäst den vid programmet bredvid de två andra, och ta bort den efter länkningen:

```cpp
        glAttachShader(ID, fragment);
        if (geometryPath != nullptr)
            glAttachShader(ID, geometry);
```

```cpp
        glDeleteShader(fragment);
        if (geometryPath != nullptr)
            glDeleteShader(geometry);
```

I `main.cpp` får shadern sin tredje fil: `Shader shader("geometry_shader.vs", "geometry_shader.fs",
"geometry_shader.gs");`.

Vertex shadern skriver nu sin färg i ett interface block till geometry shadern i stället för direkt till fragment
shadern. I `geometry_shader.vs`:

```glsl
out VS_OUT {
    vec3 color;
} vs_out;

void main()
{
    vs_out.color = aColor;
```

Och `geometry_shader.gs` släpper igenom punkten:

```glsl
#version 330 core
layout (points) in;
layout (points, max_vertices = 1) out;

in VS_OUT {
    vec3 color;
} gs_in[];

out vec3 fColor;

void main()
{
    fColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = gl_in[0].gl_Position;
    EmitVertex();
    EndPrimitive();
}
```

Geometry shadern tar emot vertex shaderns utdata som en array, `gs_in[]`, precis som `gl_in[]`: ett element per
indatavertex – även för punkter, där det bara finns ett. Det behöver inte vara ett interface block (`in vec3
outColor[];` fungerar också), men block är smidigare att arbeta med i shaders som geometry shadern. Dess egen utdata,
`fColor`, är det som `geometry_shader.fs` redan läser som `in vec3 fColor;` – namnen på fragment shaderns indata måste
nu stämma med geometry shaderns utdata.
:::
:::vulkan
Gör nu den första uppgiften, **pass-through**. Geometry shaders är en valfri funktion, så `createLogicalDevice()` slår
på den (och `isDeviceSuitable()` godtar bara en GPU som har den, med `&& supportedFeatures.geometryShader` sist i sin
`return`):

```cpp
        deviceFeatures.samplerAnisotropy = VK_TRUE;
        deviceFeatures.geometryShader = VK_TRUE; // geometry shaders are an optional feature: turn it on
```

En pipeline med ett geometry-steg på en device där funktionen inte är påslagen är ogiltig – validation layern
rapporterar det så fort du skapar pipelinen.

Sedan får `createPipeline()` en tredje, valfri shaderfil. Signaturen får en `geomShaderFile` efter `fragShaderFile`
(`""` betyder ingen), och den fasta arrayen med två steg blir en vector som geometry-steget läggs till i:

```cpp
        std::vector<VkPipelineShaderStageCreateInfo> shaderStages = {vertShaderStageInfo, fragShaderStageInfo};

        // the geometry shader, if there is one: it runs between the vertex and the fragment shader
        VkShaderModule geomShaderModule = VK_NULL_HANDLE;
        if (!geomShaderFile.empty()) {
            auto geomShaderCode = readFile(geomShaderFile);
            geomShaderModule = createShaderModule(geomShaderCode);

            VkPipelineShaderStageCreateInfo geomShaderStageInfo{};
            geomShaderStageInfo.sType = VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
            geomShaderStageInfo.stage = VK_SHADER_STAGE_GEOMETRY_BIT;
            geomShaderStageInfo.module = geomShaderModule;
            geomShaderStageInfo.pName = "main";
            shaderStages.push_back(geomShaderStageInfo);
        }
```

```cpp
        pipelineInfo.stageCount = static_cast<uint32_t>(shaderStages.size());
        pipelineInfo.pStages = shaderStages.data();
```

Ordningen på stegen i arrayen spelar ingen roll – vart och ett säger vilket steg det är. Efter
`vkCreateGraphicsPipelines` förstörs geometry-modulen som de två andra (`if (geomShaderModule != VK_NULL_HANDLE)`), och
punkternas pipeline skapas med `"shaders/geometry_shader.geom.spv"` som tredje fil.

Vertex shadern skriver nu sin färg i ett interface block till geometry shadern i stället för direkt till fragment
shadern. I `shaders/geometry_shader.vert`:

```glsl
// the outputs for the geometry shader, in an interface block
layout(location = 0) out VS_OUT {
    vec3 color;
} vs_out;

void main() {
    vs_out.color = inColor;
```

Och `shaders/geometry_shader.geom` släpper igenom punkten:

```glsl
layout(points) in;
layout(points, max_vertices = 1) out;

layout(location = 0) in VS_OUT {
    vec3 color;
} gs_in[];

layout(location = 0) out vec3 fragColor;

void main() {
    fragColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = gl_in[0].gl_Position;
    EmitVertex();
    EndPrimitive();
}
```

Geometry shadern tar emot vertex shaderns utdata som en array, `gs_in[]`, precis som `gl_in[]`: ett element per
indatavertex – även för punkter, där det bara finns ett. Som alltid i Vulkan matchas stegen med `location`: blocket på
location 0 i vertex shadern matar `gs_in` på location 0, och geometry shaderns `fragColor` på location 0 matar
fragment shaderns `fragColor`. Geometry shadern skriver inte `gl_PointSize`: utan den valfria funktionen
`shaderTessellationAndGeometryPointSize` är punkter från en geometry shader alltid 1 pixel, och vertex shaderns storlek
spelar inte längre någon roll.
:::
:::d3d12
Gör nu den första uppgiften, **pass-through**. I `geometry_shader.hlsl` får vertex shaderns och geometry shaderns
utdata var sin struktur – `PSInput` blir `VSOutput`, och pixel shadern tar `GSOutput`:

```hlsl
// What the vertex shader hands on to the geometry shader.
struct VSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct GSOutput
{
    float4 position : SV_POSITION;
    float3 color : COLOR;
};
```

`VSMain` returnerar nu en `VSOutput`, och `PSMain` blir `float4 PSMain(GSOutput input) : SV_TARGET`. Mellan dem kommer
geometry shadern:

```hlsl
[maxvertexcount(1)]
void GSMain(point VSOutput input[1], inout PointStream<GSOutput> outputStream)
{
    GSOutput output;
    output.color = input[0].color;    // input[0] since there's only one input vertex
    output.position = input[0].position;
    outputStream.Append(output);
    outputStream.RestartStrip();
}
```

De två strukturerna har samma medlemmar, så en hade räckt; två namn gör det tydligt vilket steg som lämnar vad till
vilket. Det som spelar roll är att semantikerna i geometry shaderns utdata stämmer med pixel shaderns indata
(`SV_POSITION`, `COLOR`).

I `main.cpp` kompilerar du `GSMain` med geometry shader-målet, mellan vertex och pixel shadern:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"geometry_shader.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
```

(med `ComPtr<ID3DBlob> geometryShader;` bredvid de två andra blobbarna), och lägger in den i pipeline staten:

```cpp
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());
```

`PrimitiveTopologyType` förblir `D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`: det är geometry shaderns indata.
:::

Bygg och kör. Om allt gick bra ser du ingen skillnad alls: samma fyra punkter på en pixel, i samma färger och på samma
platser. Det är just poängen – geometry shadern släpper igenom allt. Det kan verka som mycket arbete för ingenting, men
nu är allt på plats för att ändra det som kommer ut.

:::opengl
```quiz
Geometry shadern deklarerar `layout (triangles) in;`, men programmet ritar fortfarande med `glDrawArrays(GL_POINTS, 0, 4)`. Vad händer?
- [ ] OpenGL gör om varje punkt till en degenererad triangel
- [ ] Geometry shadern körs en gång för var tredje punkt
- [x] Ritanropet misslyckas med `GL_INVALID_OPERATION`: ritläget måste passa geometry shaderns indata
- [ ] Geometry shadern hoppas över och punkterna ritas som förut
---
Indatakvalificeraren och ritanropets primitivläge måste passa ihop (`points` för `GL_POINTS`, `triangles` för `GL_TRIANGLES`, …). Annars ritas ingenting och `glGetError` rapporterar `GL_INVALID_OPERATION`.
```
:::
:::vulkan
```quiz
Varför sätter `createLogicalDevice()` `deviceFeatures.geometryShader = VK_TRUE`?
- [x] Geometry shaders är en valfri funktion: en pipeline får bara innehålla ett geometry-steg om funktionen är påslagen på den logiska devicen
- [ ] Den gör vertex shaderns utdata tillgänglig för fragment shadern
- [ ] Den gör om point listen till trianglar
- [ ] Den behövs för varje pipeline med fler än två shadersteg
---
Valfria funktioner är avstängda om du inte begär dem i `VkDeviceCreateInfo::pEnabledFeatures`. `isDeviceSuitable()` kontrollerar `supportedFeatures.geometryShader` först, eftersom `vkCreateDevice` misslyckas om man begär en funktion som GPU:n saknar.
```
:::
:::d3d12
```quiz
Med geometry shadern på plats, vad beskriver `psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_POINT`?
- [ ] Primitiverna som geometry shadern ger ut
- [ ] Primitiverna som rastreraren får
- [ ] Ingenting: med en geometry shader ignoreras fältet
- [x] Primitiverna som geometry shadern tar som indata: den måste passa `point VSOutput input[1]`
---
Med en geometry shader beskriver topologitypen input assemblerns primitiver, som geometry shadern tar emot. Vad den ger ut – punkter, linjer eller trianglar – avgörs av dess strömtyp (`PointStream`, `LineStream`, `TriangleStream`).
```
:::

## Vi bygger hus

Att rita punkter och linjer är inte särskilt spännande, så vi blir lite kreativa och låter geometry shadern rita ett
hus åt oss på varje punkts plats. Det gör vi genom att sätta geometry shaderns utdata till `triangle_strip` och rita
tre trianglar sammanlagt: två för det fyrkantiga huset och en för taket.

En triangle strip är ett effektivare sätt att rita trianglar med färre vertices. Efter den första triangeln bildar
varje följande vertex en ny triangel bredvid den förra: var tredje intilliggande vertices bildar en triangel. Har vi
sammanlagt 6 vertices i en triangle strip får vi trianglarna (1,2,3), (2,3,4), (3,4,5) och (4,5,6); sammanlagt 4
trianglar. En triangle strip behöver minst 3 vertices och ger N-2 trianglar; med 6 vertices fick vi 6-2 = 4
trianglar. (Alla API:er har triangle strips, och de fungerar likadant.)

Med en triangle strip som geometry shaderns utdata kan vi lätt skapa husformen vi vill ha genom att skapa 3
intilliggande trianglar i rätt ordning: nere till vänster, nere till höger, uppe till vänster, uppe till höger och
sist takets topp. De tre första vertices bildar väggens vänstra halva, de tre nästa den högra halvan och de tre sista
taket.

:::opengl
Gör nu uppgiften **houses**. I `geometry_shader.gs` blir utdatan en triangle strip med högst 5 vertices:

```glsl
layout (triangle_strip, max_vertices = 5) out;
```

och `main` lämnar punktens position till en funktion som ger ut huset runt den:

```glsl
void build_house(vec4 position)
{
    fColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = position + vec4(-0.2, -0.2, 0.0, 0.0); // 1:bottom-left
    EmitVertex();
    gl_Position = position + vec4( 0.2, -0.2, 0.0, 0.0); // 2:bottom-right
    EmitVertex();
    gl_Position = position + vec4(-0.2,  0.2, 0.0, 0.0); // 3:top-left
    EmitVertex();
    gl_Position = position + vec4( 0.2,  0.2, 0.0, 0.0); // 4:top-right
    EmitVertex();
    gl_Position = position + vec4( 0.0,  0.4, 0.0, 0.0); // 5:top
    EmitVertex();
    EndPrimitive();
}

void main()
{
    build_house(gl_in[0].gl_Position);
}
```
:::
:::vulkan
Gör nu uppgiften **houses**. I `shaders/geometry_shader.geom` blir utdatan en triangle strip med högst 5 vertices:

```glsl
layout(triangle_strip, max_vertices = 5) out;
```

och `main` lämnar punktens position till en funktion som ger ut huset runt den. En sak skiljer sig från learnopengls
shader: Vulkans y-axel pekar nedåt, så husets botten ligger på +0.2 och takets topp på -0.4 – y-förskjutningarna är
negerade, precis som punkternas positioner, och bilden blir densamma:

```glsl
// Vulkan's y points down: the house's bottom is at +0.2, its roof's top at -0.4
void build_house(vec4 position) {
    fragColor = gs_in[0].color; // gs_in[0] since there's only one input vertex
    gl_Position = position + vec4(-0.2,  0.2, 0.0, 0.0); // 1:bottom-left
    EmitVertex();
    gl_Position = position + vec4( 0.2,  0.2, 0.0, 0.0); // 2:bottom-right
    EmitVertex();
    gl_Position = position + vec4(-0.2, -0.2, 0.0, 0.0); // 3:top-left
    EmitVertex();
    gl_Position = position + vec4( 0.2, -0.2, 0.0, 0.0); // 4:top-right
    EmitVertex();
    gl_Position = position + vec4( 0.0, -0.4, 0.0, 0.0); // 5:top
    EmitVertex();
    EndPrimitive();
}

void main() {
    build_house(gl_in[0].gl_Position);
}
```

Pipelinen har fortfarande topologin point list – det är geometry shaderns indata – och den cullar ingenting, så
stripens trianglars ordning (winding) spelar ingen roll.
:::
:::d3d12
Gör nu uppgiften **houses**. I `geometry_shader.hlsl` ger geometry shadern nu ut en `TriangleStream` med högst 5
vertices. HLSL har inga globala utdatavariabler som GLSL:s `gl_Position`, så hjälpfunktionen får positionen, färgen och
strömmen som parametrar:

```hlsl
void build_house(float4 position, float3 color, inout TriangleStream<GSOutput> triStream)
{
    GSOutput output;
    output.color = color;
    output.position = position + float4(-0.2f, -0.2f, 0.0f, 0.0f);    // 1:bottom-left
    triStream.Append(output);
    output.position = position + float4( 0.2f, -0.2f, 0.0f, 0.0f);    // 2:bottom-right
    triStream.Append(output);
    output.position = position + float4(-0.2f,  0.2f, 0.0f, 0.0f);    // 3:top-left
    triStream.Append(output);
    output.position = position + float4( 0.2f,  0.2f, 0.0f, 0.0f);    // 4:top-right
    triStream.Append(output);
    output.position = position + float4( 0.0f,  0.4f, 0.0f, 0.0f);    // 5:top
    triStream.Append(output);
    triStream.RestartStrip();
}

[maxvertexcount(5)]
void GSMain(point VSOutput input[1], inout TriangleStream<GSOutput> triStream)
{
    build_house(input[0].position, input[0].color, triStream);    // input[0] since there's only one input vertex
}
```

Strömmen skickas vidare som `inout`, som i `GSMain`s egen signatur. `PrimitiveTopologyType` förblir `POINT`: geometry
shadern tar fortfarande punkter; att den ger ut trianglar sägs av `TriangleStream` ensam.
:::

Den här geometry shadern skapar 5 vertices, där varje vertex är punktens position plus en förskjutning, så att de
bildar en stor triangle strip. Primitiven rastreras sedan och fragment shadern körs över hela stripen, vilket ger ett
färgat hus för varje punkt vi har ritat.

Bygg och kör: fyra hus, vart och ett i sin punkts färg – en vägg 160 pixlar bred och 120 hög med ett 60 pixlar högt tak
ovanpå, där de enstaka pixlarna var förut. Du ser att varje hus verkligen består av 3 trianglar – alla ritade utifrån en
enda punkt i rummet.

```quiz
Husets fem vertices ges ut som en triangle strip: 1 nere till vänster, 2 nere till höger, 3 uppe till vänster, 4 uppe till höger, 5 toppen. Vilka vertices bildar taket?
- [ ] 1, 2 och 5
- [ ] 1, 3 och 5
- [ ] 2, 4 och 5
- [x] 3, 4 och 5
---
I en strip bildar varje vertex en triangel med de två före den: (1,2,3) och (2,3,4) är väggen, (3,4,5) är taket. Därför ges vertices ut i den här sicksackordningen och inte runt konturen.
```

Husen ser lite tråkiga ut med en enda färg, så vi ger varje hus lite extra genom att lägga snö på taket: vi ger den
sista vertexen – takets topp – en egen färg, vit.

:::opengl
Gör nu uppgiften **roof-white**: i `build_house`, sätt färgen precis innan den femte vertexen ges ut:

```glsl
    gl_Position = position + vec4( 0.0,  0.4, 0.0, 0.0); // 5:top
    fColor = vec3(1.0, 1.0, 1.0); // the roof's tip is white: snow
    EmitVertex();
```

Eftersom shaderns utdata `fColor` är ett värde per vertex sparar varje `EmitVertex` det värde den har just då
tillsammans med vertexen: de fyra första vertices behåller husets färg, och bara den sista är vit.
:::
:::vulkan
Gör nu uppgiften **roof-white**: i `build_house`, sätt färgen precis innan den femte vertexen ges ut:

```glsl
    gl_Position = position + vec4( 0.0, -0.4, 0.0, 0.0); // 5:top
    fragColor = vec3(1.0, 1.0, 1.0); // the roof's tip is white: snow
    EmitVertex();
```

Eftersom shaderns utdata `fragColor` är ett värde per vertex sparar varje `EmitVertex` det värde den har just då
tillsammans med vertexen: de fyra första vertices behåller husets färg, och bara den sista är vit.
:::
:::d3d12
Gör nu uppgiften **roof-white**: i `build_house`, sätt färgen precis innan den femte vertexen läggs till:

```hlsl
    output.position = position + float4( 0.0f,  0.4f, 0.0f, 0.0f);    // 5:top
    output.color = float3(1.0f, 1.0f, 1.0f);    // the roof's tip is white: snow
    triStream.Append(output);
```

`Append` kopierar utdatastrukturen som den är just då: de fyra första vertices behåller husets färg, och bara den
sista är vit.
:::

Bygg och kör. Väggarna är oförändrade, men varje tak tonar nu från husets färg vid takfoten till vitt i toppen, som om
det vore täckt av snö.

```quiz
Bara takets översta vertex är vit, ändå blir hela taket ljusare uppåt. Varför?
- [x] Färgen är utdata per vertex: rastreraren interpolerar den över taktriangeln mellan dess tre vertices
- [ ] Geometry shadern körs en gång per fragment och räknar ut övergången
- [ ] Vitt blandas över taket med alpha blending
- [ ] Vertices i en triangle strip delar alltid färg med nästa strip
---
Som med all utdata per vertex får fragment shadern ett värde som interpolerats mellan triangelns vertices – här två i husets färg (takfoten) och en vit (toppen). Väggens trianglar har ingen vit vertex, så de behåller en enda färg.
```

Du ser att man kan vara ganska kreativ med geometry shaders, även med de enklaste primitiverna. Eftersom formerna
skapas dynamiskt på GPU:ns supersnabba hårdvara kan det vara mycket kraftfullare än att själv definiera formerna i
vertexbuffrar. Geometry shaders är ett utmärkt verktyg för enkla (ofta upprepade) former, som kuber i en voxelvärld
eller grässtrån på en stor äng.

## Exploderande objekt

Att rita hus är kul, men inte något vi kommer att använda särskilt ofta. Därför tar vi det ett steg längre och
spränger objekt! Det kommer vi förmodligen inte heller att använda särskilt mycket, men det är definitivt roligt!

När vi säger att vi spränger ett objekt tänker vi inte faktiskt spränga våra dyrbara vertices, utan vi flyttar varje
triangel i riktning mot dess normalvektor under en kort tid. Effekten är att hela objektets trianglar verkar
explodera. Det ser ut ungefär som att modellen faller sönder i sina delar och sedan sätts ihop igen.

Först behöver vi en modell. learnopengl använder ryggsäcken från sitt modelladdningskapitel; vi använder planeten
från vårt *Model*-kapitel, med sin ring.

:::opengl
Gör nu uppgiften **planet**: ersätt punkterna med Model-kapitlets scen. Lägg till kamerans globala variabler efter
`SCR_HEIGHT`:

```cpp
// camera: at (0, 0, 3) looking down -z
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

I stället för punkternas data, deras VBO och VAO tar shadern `explode`-filerna, och modellen laddas:

```cpp
    Shader shader("explode.vs", "explode.fs", "explode.gs");

    // load models
    // -----------
    // (aiProcess_FlipUVs in model.h turns the texture coordinates the right way up: no stbi_set_flip_vertically_on_load)
    Model ourModel("models/planet.obj");
```

I renderloopen ritas planeten med learnopengls matriser i stället för punkterna (ta också bort städningen av VAO och
VBO i slutet):

```cpp
        // configure transformation matrices
        glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        shader.use();
        shader.setMat4("projection", projection);
        shader.setMat4("view", view);
        shader.setMat4("model", model);

        // draw model
        ourModel.Draw(shader);
```

`explode.vs` transformerar vertices med `projection * view * model` och skickar texturkoordinaterna vidare i ett
interface block `VS_OUT { vec2 texCoords; }`. `explode.gs` tar `layout (triangles) in;` – `Mesh::Draw` ritar
`GL_TRIANGLES` – och ger hittills ut triangelns tre vertices igen, var och en med sina `TexCoords`.
:::
:::vulkan
Gör nu uppgiften **planet**: ersätt punkterna med Model-kapitlets scen. Lägg till kamerans globala variabler efter
`HEIGHT`:

```cpp
// camera: at (0, 0, 3) looking down -z
glm::vec3 cameraPos   = glm::vec3(0.0f, 0.0f,  3.0f);
glm::vec3 cameraFront = glm::vec3(0.0f, 0.0f, -1.0f);
glm::vec3 cameraUp    = glm::vec3(0.0f, 1.0f,  0.0f);
```

Ta bort allt som hör till punkterna: `struct PointVertex`, `points` och `pointsVertexBuffer` med sitt minne
(medlemmen, när den skapas och städningen). Pipelinen ritar nu modellen med `explode`-shadrarna:

```cpp
        // the model: a triangle list, each vertex a Vertex; the geometry shader gets one triangle at a time
        createPipeline("shaders/explode.vert.spv", "shaders/explode.frag.spv", "shaders/explode.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), graphicsPipeline);
```

`updateUniformBuffer()` skriver view och projektion:

```cpp
        ubo.view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        ubo.proj = glm::perspective(glm::radians(45.0f), swapChainExtent.width / (float) swapChainExtent.height, 0.1f, 100.0f);
        // GLM is made for OpenGL, where clip space y points up: flip it for Vulkan
        ubo.proj[1][1] *= -1;
```

Och `recordCommandBuffer()` ritar modellen som i Model-kapitlet, i stället för punkterna:

```cpp
        // the model's vertices and indices, and the descriptor set with its textures
        VkBuffer vertexBuffers[] = {vertexBuffer};
        VkDeviceSize offsets[] = {0};
        vkCmdBindVertexBuffers(commandBuffer, 0, 1, vertexBuffers, offsets);

        // the indices are uint32_t: a model can have more than 65536 vertices
        vkCmdBindIndexBuffer(commandBuffer, indexBuffer, 0, VK_INDEX_TYPE_UINT32);

        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &descriptorSet, 0, nullptr);

        // configure the model matrix
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f)); // centre of the scene
        model = glm::rotate(model, glm::radians(25.0f), glm::vec3(1.0f, 0.0f, 0.0f)); // tilt it so the ring shows
        model = glm::scale(model, glm::vec3(0.5f));                 // planet radius 0.5, ring up to 1.0
        PushConstants constants{};
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        // draw model
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

`explode.vert` transformerar vertices med `ubo.proj * ubo.view * pc.model` och skickar texturkoordinaten och
materialindexet vidare i ett interface block `VS_OUT { vec2 texCoord; flat uint materialIndex; }`. `explode.geom` tar
`layout(triangles) in;` och ger hittills ut triangelns tre vertices igen, var och en med sina `fragTexCoord` och
`fragMaterialIndex` till fragment shadern.
:::
:::d3d12
Gör nu uppgiften **planet**: ersätt punkterna med Model-kapitlets scen. Lägg till kamerans globala variabler före
`struct Vertex`:

```cpp
// camera: at (0, 0, 3) looking down -z, at the model in the centre of the scene
XMVECTOR cameraPos   = XMVectorSet(0.0f, 0.0f,  3.0f, 0.0f);
XMVECTOR cameraFront = XMVectorSet(0.0f, 0.0f, -1.0f, 0.0f);
XMVECTOR cameraUp    = XMVectorSet(0.0f, 1.0f,  0.0f, 0.0f);
```

Ta bort allt som hör till punkterna: `struct PointVertex`, `m_vertexBuffer`, `m_vertexBufferView` och blocket som
skapar punkternas vertexbuffer. Pipeline staten tar nu de tre shadrarna i `explode.hlsl`, meshens input layout och
trianglar:

```cpp
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &vertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"explode.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &pixelShader, nullptr));

        // Define the vertex input layout: a vertex of a mesh is a position, a normal and
        // texture coordinates (3 + 3 + 2 floats, at byte offsets 0, 12 and 24).
        D3D12_INPUT_ELEMENT_DESC inputElementDescs[] =
        {
            { "POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 0, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "NORMAL", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 },
            { "TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT, 0, 24, D3D12_INPUT_CLASSIFICATION_PER_VERTEX_DATA, 0 }
        };
```

```cpp
        psoDesc.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE;
```

I `LoadAssets` laddas modellen där punkternas buffer var, med sina texturvyer från heap-plats 1 och framåt, och
`m_model.uploadHeaps.clear();` kommer efter `WaitForPreviousFrame()` i slutet:

```cpp
    m_model.Load("models/planet.obj", m_device.Get(), m_commandList.Get(), m_cbvSrvHeap.Get(), 1);
```

`OnUpdate` skriver view och projektion i constant buffern:

```cpp
    XMMATRIX view = XMMatrixLookAtRH(cameraPos, cameraPos + cameraFront, cameraUp);
    XMMATRIX projection = XMMatrixPerspectiveFovRH(XMConvertToRadians(45.0f), static_cast<float>(m_width) / static_cast<float>(m_height), 0.1f, 100.0f);

    SceneConstantBuffer constantBufferData = {};
    XMStoreFloat4x4(&constantBufferData.view, XMMatrixTranspose(view));
    XMStoreFloat4x4(&constantBufferData.projection, XMMatrixTranspose(projection));
    memcpy(m_pCbvDataBegin, &constantBufferData, sizeof(constantBufferData));
```

Och `PopulateCommandList` ritar modellen i stället för punkterna:

```cpp
    m_commandList->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);

    // The model matrix (root parameter 0): scale, then tilt, then move - learnopengl's
    // translate * rotate * scale, written in the order DirectXMath applies it.
    XMMATRIX model = XMMatrixScaling(0.5f, 0.5f, 0.5f)                                            // planet radius 0.5, ring up to 1.0
        * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f), XMConvertToRadians(25.0f))   // tilt it so the ring shows
        * XMMatrixTranslation(0.0f, 0.0f, 0.0f);                                                  // centre of the scene
    ModelConstants modelConstants = {};
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);

    // draw model: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());
```

`explode.hlsl`s `VSMain` transformerar vertices med model, view och projektion; dess `GSMain` tar
`triangle VSOutput input[3]` och lägger, med `[maxvertexcount(3)]`, hittills till triangelns tre vertices i en
`TriangleStream` igen, var och en med sina texturkoordinater.
:::

Bygg och kör: den texturerade planeten med sin ring, lutad mot dig, på den mörka bakgrunden – bilden från
Model-kapitlet, utan ljussättning. Den går nu genom en geometry shader som inte ändrar något ännu.

Det vi ska göra är att flytta varje vertex i en triangel i riktning mot triangelns normalvektor. Det betyder att vi
först måste räkna ut normalvektorn. Vi behöver en vektor som är vinkelrät mot triangelns yta, och vi har bara de 3
vertices att tillgå. Du minns kanske från kapitlet om transformationer att vi kan få en vektor som är vinkelrät mot
två andra vektorer med kryssprodukten. Om vi tar fram två vektorer `a` och `b` som är parallella med triangelns yta
kan vi få dess normalvektor genom en kryssprodukt av dem.

:::opengl
Följande funktion i geometry shadern gör precis det för att få normalvektorn från 3 vertexkoordinater:

```glsl
vec3 GetNormal()
{
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    return normalize(cross(a, b));
}
```

Här tar vi fram två vektorer `a` och `b` som är parallella med triangelns yta med hjälp av vektorsubtraktion. Att
subtrahera två vektorer ger en vektor som är skillnaden mellan dem. Eftersom alla 3 punkterna ligger i triangelns plan
ger varje sådan subtraktion en vektor parallell med planet. Observera att om vi bytte plats på `a` och `b` i
`cross`-funktionen skulle vi få en normalvektor som pekar åt motsatt håll – ordningen är viktig här!
:::
:::vulkan
learnopengls funktion i geometry shadern gör precis det för att få normalvektorn från 3 vertexkoordinater – med en
ändring för Vulkan:

```glsl
vec3 GetNormal() {
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    // learnopengl returns cross(a, b); Vulkan's projection flips y (proj[1][1] *= -1), which mirrors clip space and
    // turns that vector around: b x a points out of the model here
    return normalize(cross(b, a));
}
```

Här tar vi fram två vektorer `a` och `b` som är parallella med triangelns yta med hjälp av vektorsubtraktion.
Eftersom alla 3 punkterna ligger i triangelns plan ger varje sådan subtraktion en vektor parallell med planet.
Ordningen på `a` och `b` i `cross`-funktionen avgör om normalen pekar ut ur modellen eller in i den – ordningen är
viktig här! Positionerna ligger i clip space, och vår projektionsmatris negerar y för att passa Vulkans nedåtpekande
y-axel. En sådan spegling vänder kryssproduktens riktning: i clip space pekar learnopengls `cross(a, b)` här *in i*
planeten (prova – bitarna flyger inåt och planeten krymper till en liten fläck), och `cross(b, a)` pekar ut ur den.
:::
:::d3d12
Följande funktion gör precis det för att få normalvektorn från 3 vertexkoordinater. HLSL har ingen `gl_in` som alla
funktioner kan läsa, så den får triangelns tre positioner som parametrar:

```hlsl
// The normal of a triangle: the cross product of two of its sides.
float3 GetNormal(float4 position0, float4 position1, float4 position2)
{
    float3 a = position0.xyz - position1.xyz;
    float3 b = position2.xyz - position1.xyz;
    return normalize(cross(a, b));
}
```

Här tar vi fram två vektorer `a` och `b` som är parallella med triangelns yta med hjälp av vektorsubtraktion. Att
subtrahera två vektorer ger en vektor som är skillnaden mellan dem. Eftersom alla 3 punkterna ligger i triangelns plan
ger varje sådan subtraktion en vektor parallell med planet. Observera att om vi bytte plats på `a` och `b` i
`cross`-funktionen skulle vi få en normalvektor som pekar åt motsatt håll – ordningen är viktig här!
:::

Nu när vi vet hur man räknar ut en normalvektor kan vi skriva en funktion `explode` som tar normalvektorn och en
vertexposition. Funktionen returnerar en ny vektor som flyttar positionen i normalvektorns riktning. Funktionen `sin`
får en variabel `time` som argument och ger, beroende på tiden, ett värde mellan -1.0 och 1.0. Eftersom vi inte vill
att objektet ska *implodera* omvandlar vi sinusvärdet till intervallet [0,1]. Värdet skalar sedan normalvektorn, och
den resulterande riktningsvektorn läggs till positionen.

:::opengl
Gör nu uppgiften **explode**. I `explode.gs`, vid TODO:n, lägg till uniformen `time` och de två funktionerna:

```glsl
uniform float time;

vec4 explode(vec4 position, vec3 normal)
{
    float magnitude = 2.0;
    vec3 direction = normal * ((sin(time) + 1.0) / 2.0) * magnitude; // 0 .. 2 and back, following sin(time)
    return position + vec4(direction, 0.0);
}

vec3 GetNormal()
{
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    return normalize(cross(a, b));
}
```

`main` räknar ut triangelns normal en gång och flyttar var och en av dess tre vertices längs den:

```glsl
void main() {
    vec3 normal = GetNormal();

    gl_Position = explode(gl_in[0].gl_Position, normal);
    TexCoords = gs_in[0].texCoords;
    EmitVertex();
    gl_Position = explode(gl_in[1].gl_Position, normal);
    TexCoords = gs_in[1].texCoords;
    EmitVertex();
    gl_Position = explode(gl_in[2].gl_Position, normal);
    TexCoords = gs_in[2].texCoords;
    EmitVertex();
    EndPrimitive();
}
```

Observera att vi också ger ut rätt texturkoordinater innan varje vertex ges ut. Glöm inte att faktiskt sätta uniformen
`time` i OpenGL-koden, efter modellmatrisen:

```cpp
        // add time component to geometry shader in the form of a uniform
        shader.setFloat("time", static_cast<float>(glfwGetTime()));
```
:::
:::vulkan
Gör nu uppgiften **explode**. Vulkan har inga enskilda uniforms, så tiden hamnar i uniform buffern: en ny medlem
`float time` efter `proj`, både i C++ och i shaderns block. I `main.cpp`:

```cpp
struct UniformBufferObject {
    glm::mat4 view;
    glm::mat4 proj;
    float time; // for the geometry shader
};
```

`updateUniformBuffer()` fyller i den efter projektionen:

```cpp
        // add time component to geometry shader in the form of a uniform
        ubo.time = static_cast<float>(glfwGetTime());
```

Hittills har bara vertex shadern läst uniform buffern; nu läser geometry shadern den också, och en descriptor är bara
synlig för de steg som dess binding nämner. I `createDescriptorSetLayout()`:

```cpp
        uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_GEOMETRY_BIT; // the geometry shader reads it too
```

I `shaders/explode.geom`, vid TODO:n, deklarera blocket och lägg till de två funktionerna:

```glsl
// the time in seconds: a new member of the uniform buffer (the matrices before it are not used here)
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
    float time;
} ubo;

vec4 explode(vec4 position, vec3 normal) {
    float magnitude = 2.0;
    vec3 direction = normal * ((sin(ubo.time) + 1.0) / 2.0) * magnitude; // 0 .. 2 and back, following sin(time)
    return position + vec4(direction, 0.0);
}
```

plus `GetNormal()` från ovan, med `cross(b, a)`. `main` räknar ut triangelns normal en gång och flyttar var och en av
dess tre vertices längs den:

```glsl
void main() {
    vec3 normal = GetNormal();

    gl_Position = explode(gl_in[0].gl_Position, normal);
    fragTexCoord = gs_in[0].texCoord;
    fragMaterialIndex = gs_in[0].materialIndex;
    EmitVertex();
```

och likadant med `explode(gl_in[1].gl_Position, normal)` och `explode(gl_in[2].gl_Position, normal)` för de två
andra vertices. Observera att vi också ger ut rätt texturkoordinat och materialindex innan varje vertex ges ut.
:::
:::d3d12
Gör nu uppgiften **explode**. Tiden hamnar i constant buffern: en ny medlem `float time` efter `projection`, både i
HLSL-blocket `cbuffer SceneConstantBuffer` i `explode.hlsl` och i C++-strukturen `struct SceneConstantBuffer`:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float time;    // seconds since the first frame
};
```

`OnUpdate` fyller i den med `std::chrono`, som i kapitlet *Transformations*, före `memcpy`:

```cpp
    // The time in seconds since the first frame, for the geometry shader.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    constantBufferData.time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();
```

Root signaturens tabell med CBV:n är redan synlig för alla steg (`D3D12_SHADER_VISIBILITY_ALL`), så geometry shadern
kan läsa den. I `explode.hlsl`, vid TODO:n, lägg till `GetNormal` från ovan och funktionen `explode`:

```hlsl
// Moves a position along a direction: 0 .. 2 units and back, following sin(time).
float4 explode(float4 position, float3 normal)
{
    float magnitude = 2.0f;
    float3 direction = normal * ((sin(time) + 1.0f) / 2.0f) * magnitude;
    return position + float4(direction, 0.0f);
}
```

`GSMain` räknar ut triangelns normal en gång och flyttar var och en av dess tre vertices längs den:

```hlsl
    GSOutput output;
    float3 normal = GetNormal(input[0].position, input[1].position, input[2].position);

    output.position = explode(input[0].position, normal);
    output.texCoords = input[0].texCoords;
    triStream.Append(output);
```

och likadant med `explode(input[1].position, normal)` och `explode(input[2].position, normal)` för de två andra
vertices. Observera att vi också ger ut rätt texturkoordinater innan varje vertex läggs till.
:::

Bygg och kör. Resultatet är en planet som verkar spränga sina trianglar om och om igen och sedan återgå till det
normala: med `sin(time)` flyger bitarna isär och kommer tillbaka med en period på 2π sekunder – längst isär efter
ungefär 1,6 sekunder, hel igen efter ungefär 4,7 sekunder. Det är kanske inte superanvändbart, men det visar en mer
avancerad användning av geometry shadern.

Lägg märke till *var* det här händer: vertex shadern har redan multiplicerat positionerna med projektionsmatrisen, så
geometry shadern arbetar i clip space, och både normalen och förflyttningen är vektorer i clip space – som hos
learnopengl. Därför exploderar planeten inte till en prydlig sfär runt sig själv, utan sträcks ut mot betraktaren och
mot fönstrets kanter. Det betyder också att bilden skiljer sig lite mellan API:erna: OpenGL:s z i clip space går från
-w till w, Vulkans och Direct3D:s från 0 till w, vilket ger normalerna något olika riktningar.

:::opengl
```quiz
Vad händer i `GetNormal` om du skriver `cross(b, a)` i stället för `cross(a, b)`?
- [ ] Ingenting: kryssprodukten är kommutativ
- [x] Normalen pekar åt andra hållet, så trianglarna flyttas in i planeten i stället för ut ur den
- [ ] Normalen blir dubbelt så lång
- [ ] Normalen hamnar i triangelns plan i stället för vinkelrätt mot det
---
Kryssprodukten är antikommutativ: b × a = -(a × b). Båda är vinkelräta mot triangeln, men bara en pekar utåt – ordningen är viktig här.
```
:::
:::vulkan
```quiz
Varför returnerar Vulkan-projektets `GetNormal` `cross(b, a)` i stället för learnopengls `cross(a, b)`?
- [ ] Vulkans GLSL definierar `cross` med motsatt tecken
- [ ] Vulkans z i clip space går från 0 till 1
- [x] Projektionsmatrisen vänder y (`proj[1][1] *= -1`), vilket speglar clip space – och en spegling vänder kryssprodukten
- [ ] Planetens trianglar går medurs i OBJ-filen
---
I ett speglat rum pekar a × b åt andra hållet än den speglade versionen av den ursprungliga normalen. Med `cross(a, b)` skulle bitarna flyga in i planeten; `cross(b, a)` pekar utåt igen.
```
:::
:::d3d12
```quiz
Vad händer i `GetNormal` om du skriver `cross(b, a)` i stället för `cross(a, b)`?
- [ ] Ingenting: kryssprodukten är kommutativ
- [x] Normalen pekar åt andra hållet, så trianglarna flyttas in i planeten i stället för ut ur den
- [ ] Normalen blir dubbelt så lång
- [ ] Normalen hamnar i triangelns plan i stället för vinkelrätt mot det
---
Kryssprodukten är antikommutativ: b × a = -(a × b). Båda är vinkelräta mot triangeln, men bara en pekar utåt – ordningen är viktig här.
```
:::

## Visualisera normalvektorer

För att skaka om lite går vi nu igenom ett exempel på en geometry shader som faktiskt är användbart: att visualisera
normalvektorerna för ett objekt. När du programmerar ljusshaders kommer du förr eller senare att få konstiga resultat
vars orsak är svår att hitta. En vanlig orsak till ljusfel är felaktiga normalvektorer – antingen på grund av att
vertexdatan laddats fel, att de angetts fel som vertexattribut eller att de hanterats fel i shadrarna. Vi vill ha ett
sätt att se om normalvektorerna vi gav är rätt. Ett utmärkt sätt är att visualisera dem, och geometry shadern råkar
vara ett ytterst användbart verktyg för det.

Idén är följande: först ritar vi scenen som vanligt utan geometry shader, och sedan ritar vi scenen en gång till, men
den här gången visar vi bara normalvektorer som vi skapar i en geometry shader. Geometry shadern tar en triangel som
indata och skapar 3 linjer i normalernas riktning – en normalvektor för varje vertex.

Den här gången använder geometry shadern vertexnormalerna som modellen har i stället för att räkna ut dem själv. För
att ta hänsyn till skalning och rotation (från view- och modellmatrisen) transformerar vi normalerna med en
normalmatris. Geometry shadern får sina positioner i view space, så vi transformerar normalvektorerna till samma rum.
Projektionen läggs på i geometry shadern, efter att normalen har lagts till: i view space betyder en längd på 0.2
samma sak i alla riktningar, medan den efter projektionen skulle förvrängas av perspektivet.

En liten skillnad mot learnopengl: vår planet är skalad med 0.5. Normalmatrisen för en skalad modell gör normalerna
längre (dubbelt så långa här), så vår vertex shader normaliserar den transformerade normalen – annars skulle linjerna
bli 0.4 långa i stället för 0.2. learnopengls modell är inte skalad, så den behöver inte det.

:::opengl
`normal_visualization.vs` är färdig:

```glsl
void main()
{
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(view * model)));
    vs_out.normal = normalize(normalMatrix * aNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = view * model * vec4(aPos, 1.0);
}
```

Gör nu den sista uppgiften, **normals**. Skriv `normal_visualization.gs`:

```glsl
#version 330 core
layout (triangles) in;
layout (line_strip, max_vertices = 6) out;

in VS_OUT {
    vec3 normal;
} gs_in[];

const float MAGNITUDE = 0.2;

uniform mat4 projection;

void GenerateLine(int index)
{
    gl_Position = projection * gl_in[index].gl_Position;
    EmitVertex();
    gl_Position = projection * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    EmitVertex();
    EndPrimitive();
}

void main()
{
    GenerateLine(0); // first vertex normal
    GenerateLine(1); // second vertex normal
    GenerateLine(2); // third vertex normal
}
```

Innehållet i sådana här geometry shaders borde vara självförklarande vid det här laget. Observera att vi multiplicerar
normalvektorn med `MAGNITUDE` för att begränsa storleken på de visade normalvektorerna (annars blir de lite för
stora). Eftersom visualiserade normaler mest används för felsökning kan vi visa dem som enfärgade linjer (eller
superfina linjer om du känner för det) med hjälp av fragment shadern `normal_visualization.fs`, som ger ut gult.

I `main.cpp` blir den första shadern den vanliga (utan geometry shader), och en andra ritar normalerna:

```cpp
    Shader shader("default.vs", "default.fs");
    Shader normalShader("normal_visualization.vs", "normal_visualization.fs", "normal_visualization.gs");
```

Ta bort raden `setFloat("time", …)`. Rendera sedan modellen två gånger – först som vanligt, sedan med normalshadern:

```cpp
        // draw model as usual
        ourModel.Draw(shader);

        // then draw model with normal visualizing geometry shader
        normalShader.use();
        normalShader.setMat4("projection", projection);
        normalShader.setMat4("view", view);
        normalShader.setMat4("model", model);

        ourModel.Draw(normalShader);
```
:::
:::vulkan
`shaders/normal_visualization.vert` är färdig:

```glsl
void main() {
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(ubo.view * pc.model)));
    vs_out.normal = normalize(normalMatrix * inNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = ubo.view * pc.model * vec4(inPosition, 1.0);
}
```

Gör nu den sista uppgiften, **normals**. Skriv resten av `shaders/normal_visualization.geom`. Den läser projektionen
ur uniform buffern, så den deklarerar blocket (bindingens stage flags behåller geometry-biten från förra uppgiften):

```glsl
layout(triangles) in;
layout(line_strip, max_vertices = 6) out;

layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;

layout(location = 0) in VS_OUT {
    vec3 normal;
} gs_in[];

const float MAGNITUDE = 0.2;

void GenerateLine(int index) {
    gl_Position = ubo.proj * gl_in[index].gl_Position;
    EmitVertex();
    gl_Position = ubo.proj * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    EmitVertex();
    EndPrimitive();
}

void main() {
    GenerateLine(0); // first vertex normal
    GenerateLine(1); // second vertex normal
    GenerateLine(2); // third vertex normal
}
```

Innehållet i sådana här geometry shaders borde vara självförklarande vid det här laget. Observera att vi multiplicerar
normalvektorn med `MAGNITUDE` för att begränsa storleken på de visade normalvektorerna. Eftersom visualiserade normaler
mest används för felsökning visar vi dem som enfärgade linjer: `normal_visualization.frag` ger ut gult.

Tiden behövs inte längre: ta bort `float time` ur `UniformBufferObject` och raden med `ubo.time`. I OpenGL byter man
shaderprogram mellan de två ritningarna; i Vulkan hör shadrarna till pipelinen, så vi behöver en till. Lägg till en
medlem `VkPipeline normalPipeline;` (förstörd i `cleanup()` bredvid `graphicsPipeline`), och skapa båda:

```cpp
        // the model: a triangle list, each vertex a Vertex - drawn as usual, then its normals with a geometry shader
        createPipeline("shaders/default.vert.spv", "shaders/default.frag.spv", "", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), graphicsPipeline);
        createPipeline("shaders/normal_visualization.vert.spv", "shaders/normal_visualization.frag.spv", "shaders/normal_visualization.geom.spv", VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, Vertex::getBindingDescription(), Vertex::getAttributeDescriptions(), normalPipeline);
```

Den första får `""`: ingen geometry shader. Rendera sedan modellen två gånger i `recordCommandBuffer()`:

```cpp
        // draw model as usual
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);

        // then draw model with normal visualizing geometry shader (the same buffers, descriptor set and push constants)
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, normalPipeline);
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

Båda pipelinerna delar pipeline layout, så vertex- och indexbuffrarna, descriptor seten och push constants som
bundits för den första ritningen gäller fortfarande för den andra.
:::
:::d3d12
Vertex shadern i `normal_visualization.hlsl` är färdig. Den behöver normalmatrisen, som root constants levererar (mer
om det nedan):

```hlsl
VSOutput VSMain(float4 position : POSITION, float3 normal : NORMAL)
{
    VSOutput result;

    // The geometry shader works in view space: the position only gets the model and the
    // view matrix (the geometry shader applies the projection).
    result.position = mul(mul(position, model), view);
    // The normal: into world space with the normal matrix, then into view space with the
    // view matrix (it only turns and moves the scene, so it turns normals like positions).
    // Normalized: the model is scaled, the lines must still be 0.2 long.
    float3 worldNormal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.normal = normalize(mul(float4(worldNormal, 0.0f), view).xyz);

    return result;
}
```

Gör nu den sista uppgiften, **normals**. Skriv geometry shadern i `normal_visualization.hlsl`:

```hlsl
static const float MAGNITUDE = 0.2f;

// A line from a vertex along its normal, as a strip of 2 vertices.
void GenerateLine(VSOutput vertex, inout LineStream<GSOutput> lineStream)
{
    GSOutput output;
    output.position = mul(vertex.position, projection);
    lineStream.Append(output);
    output.position = mul(vertex.position + float4(vertex.normal, 0.0f) * MAGNITUDE, projection);
    lineStream.Append(output);
    lineStream.RestartStrip();
}

// The geometry shader: runs once per triangle and outputs three lines (6 vertices).
[maxvertexcount(6)]
void GSMain(triangle VSOutput input[3], inout LineStream<GSOutput> lineStream)
{
    GenerateLine(input[0], lineStream);    // first vertex normal
    GenerateLine(input[1], lineStream);    // second vertex normal
    GenerateLine(input[2], lineStream);    // third vertex normal
}
```

Innehållet i sådana här geometry shaders borde vara självförklarande vid det här laget. Observera att vi multiplicerar
normalvektorn med `MAGNITUDE` för att begränsa storleken på de visade normalvektorerna. Eftersom visualiserade normaler
mest används för felsökning visar vi dem som enfärgade linjer: `PSMain` returnerar gult.

I `main.cpp` får root constants normalmatrisen bredvid modellmatrisen – 32 floats nu:

```cpp
    struct ModelConstants
    {
        XMFLOAT4X4 model;
        XMFLOAT4X4 normalMatrix;
    };
```

`PopulateCommandList` räknar ut den som i ljuskapitlen, transponerad en gång till för HLSL som alla matriser:

```cpp
    XMMATRIX normalMatrix = XMMatrixTranspose(XMMatrixInverse(nullptr, model));
    XMStoreFloat4x4(&modelConstants.normalMatrix, XMMatrixTranspose(normalMatrix));
```

Tiden behövs inte längre: ta bort `float time` ur `SceneConstantBuffer` och dess rader i `OnUpdate`. I OpenGL byter man
shaderprogram mellan de två ritningarna; i Direct3D 12 hör shadrarna till pipeline staten, så vi behöver en till,
`ComPtr<ID3D12PipelineState> m_normalPipelineState;`. `m_pipelineState` använder nu `default.hlsl`s `VSMain` och
`PSMain` – och ingen geometry shader, så raden `psoDesc.GS = …` försvinner. När den är skapad blir samma beskrivning
normalernas pipeline state:

```cpp
        ComPtr<ID3DBlob> normalVertexShader;
        ComPtr<ID3DBlob> normalPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &normalVertexShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "GSMain", "gs_5_0", compileFlags, 0, &geometryShader, nullptr));
        ThrowIfFailed(D3DCompileFromFile(L"normal_visualization.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &normalPixelShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(normalVertexShader.Get());
        psoDesc.GS = CD3DX12_SHADER_BYTECODE(geometryShader.Get());
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(normalPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_normalPipelineState)));
```

Dess `PrimitiveTopologyType` förblir `TRIANGLE`: geometry shadern tar trianglar och ger ut linjer. Rendera sedan
modellen två gånger:

```cpp
    // draw model as usual: each mesh binds its textures and draws itself
    m_model.Draw(m_commandList.Get());

    // then draw model with normal visualizing geometry shader
    m_commandList->SetPipelineState(m_normalPipelineState.Get());
    m_model.Draw(m_commandList.Get());
```

Båda pipeline states använder samma root signatur, så root constants och CBV-tabellen som satts för den första
ritningen gäller fortfarande för den andra.
:::

Bygg och kör: planeten som i uppgiften `planet`, oexploderad, med gula strån som sticker ut ur klotet och upp från
ringen – ett per vertex. Av bilden att döma verkar normalerna verkligen vara rätt: de pekar rakt ut från ytan överallt.
Förutom att visualisera normaler används en sådan här geometry shader ofta för att ge objekt päls.

```quiz
Varför låter normalvisualiseringens vertex shader bli att projicera och lämnar det till geometry shadern?
- [ ] Vertex shadern kan inte läsa projektionsmatrisen
- [ ] Positioner i clip space kan inte skickas mellan shadersteg
- [x] Linjens ändpunkt räknas ut genom att lägga till normalen i view space, där en längd på 0.2 betyder samma sak i alla riktningar; projektionen kommer efteråt
- [ ] Projektionen behövs bara för trianglar, inte för linjer
---
Att lägga en riktning till en position är bara meningsfullt i ett rum utan perspektivförvrängning. Därför stannar vertex shadern i view space, geometry shadern lägger till `normal * MAGNITUDE` där och projicerar först sedan linjens båda ändar.
```

Geometry shaders är ett kraftfullt men lite speciellt verktyg: på viss hårdvara är de långsamma när de ger ut många
vertices, och därför använder moderna motorer ofta compute shaders eller (där de finns) mesh shaders för tung
geometrigenerering. För enkla uppgifter som de i det här kapitlet, och för felsökning, är de perfekta.

## Mer att läsa

:::opengl
- [Geometry Shader](https://www.khronos.org/opengl/wiki/Geometry_Shader): OpenGL-wikin om in- och utdataprimitiver,
  `gl_in` och gränserna.
- learnopengls källkod för de tre exemplen, t.ex.
  [geometry_shader_houses.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/4.advanced_opengl/9.1.geometry_shader_houses/geometry_shader_houses.cpp).
:::
:::vulkan
- [Geometry Shading](https://docs.vulkan.org/spec/latest/chapters/geometry.html): kapitlet i Vulkans specifikation om
  geometry shaders, deras in- och utdataprimitiver och punktstorlekar.
- [GL_KHR_vulkan_glsl](https://github.com/KhronosGroup/GLSL/blob/main/extensions/khr/GL_KHR_vulkan_glsl.txt): hur
  Vulkans GLSL skiljer sig från OpenGL:s.
:::
:::d3d12
- [Geometry-Shader Object](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-geometry-shader):
  `[maxvertexcount]` och indataprimitivernas typer.
- [Stream-Output Object](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-so-type):
  `PointStream`, `LineStream`, `TriangleStream`, `Append` och `RestartStrip`.
- [Geometry Shader Stage](https://learn.microsoft.com/en-us/windows/win32/direct3d11/geometry-shader-stage): vad steget
  tar emot och ger ut (skrivet för Direct3D 11; steget är detsamma i Direct3D 12).
:::

I nästa kapitel ritar vi inte en modell utan hundratals kopior av den – med ett enda ritanrop: *instancing*.
