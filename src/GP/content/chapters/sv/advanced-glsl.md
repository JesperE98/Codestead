# Advanced GLSL

Det här kapitlet visar inga superavancerade, häftiga nya funktioner som ger scenens utseende ett enormt lyft. Kapitlet
går mer eller mindre igenom några intressanta sidor av {{shaderLanguage}} och några trevliga knep som kan hjälpa dig
framöver – i grunden sådant som är *bra att veta* och *funktioner som kan göra livet enklare* när du skriver
{{api}}-program tillsammans med {{shaderLanguage}}.

Vi går igenom några intressanta *inbyggda variabler*, nya sätt att organisera shaderns indata och utdata, och ett
mycket användbart verktyg som kallas *uniform buffer objects*.

:::vulkan
Vulkans shaders skrivs också i GLSL – kompilerad till SPIR-V – så det mesta i learnopengls kapitel gäller direkt. Där
Vulkans GLSL skiljer sig från OpenGL:s säger kapitlet det.
:::
:::d3d12
learnopengls kapitel handlar om GLSL; Direct3D 12:s shaders skrivs i HLSL. Varje idé i kapitlet har en motsvarighet i
HLSL, ofta med ett annat namn och en annan form, och det här kapitlet visar var och en bredvid GLSL-originalet.
:::

:::opengl
Projektet är än en gång scenen från *Depth testing* – två marmorkuber, metallgolvet, kameran på (0, 0, 3) – med kuben
från kapitlet *Face culling*, vars trianglar alla går moturs sett utifrån. Face culling är avstängt, så den ser exakt
ut som learnopengls kub. Den sista uppgiften ersätter scenen med learnopengls uniform buffer-demo; dess shaders
(`uniform_buffer.vs`, `red.fs`, `green.fs`, `blue.fs`, `yellow.fs`) finns redan i projektet.
:::
:::vulkan
Projektet är än en gång scenen från *Depth testing* – två marmorkuber, metallgolvet, kameran på (0, 0, 3) – med kuben
från kapitlet *Face culling*, vars trianglar alla går moturs sett utifrån. Pipelinen cullar ingenting
(`VK_CULL_MODE_NONE`, `VK_FRONT_FACE_CLOCKWISE`), så den ser exakt ut som learnopengls kub. Den sista uppgiften
ersätter scenen med learnopengls uniform buffer-demo; dess shaders (`shaders/uniform_buffer.vert`, `red.frag`,
`green.frag`, `blue.frag`, `yellow.frag`) finns redan i projektet.
:::
:::d3d12
Projektet är än en gång scenen från *Depth testing* – två marmorkuber, metallgolvet, kameran på (0, 0, 3) – med kuben
från kapitlet *Face culling*, vars trianglar alla går moturs sett utifrån, och
`psoDesc.RasterizerState.FrontCounterClockwise = TRUE;`. `CullMode` är fortfarande `D3D12_CULL_MODE_NONE`, så den ser
exakt ut som learnopengls kub. Shadrarna ligger i `advanced_glsl.hlsl`. Den sista uppgiften ersätter scenen med
learnopengls uniform buffer-demo; dess shaders (`uniform_buffer.hlsl`, `red.hlsl`, `green.hlsl`, `blue.hlsl`,
`yellow.hlsl`) finns redan i projektet.
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in. Efter varje uppgift bygger och kör du programmet i din
IDE.

## GLSL's built-in variables

Shaders är extremt uppdelade i en pipeline; behöver vi data från någon annan källa utanför den aktuella shadern måste
vi skicka runt den. Vi har lärt oss att göra det med vertexattribut, uniforms och samplers. Det finns dock några extra
variabler som shaderspråket självt definierar, och som ger oss ytterligare ett sätt att hämta och/eller skriva data.

:::opengl
GLSL definierar flera sådana *inbyggda variabler*, med prefixet `gl_`. Två av dem har vi redan sett i kapitlen hittills:
`gl_Position`, vertex shaderns utdatavektor, och fragment shaderns `gl_FragCoord`, som vi använde i kapitlet *Depth
testing* för att titta på djupvärdena.
:::
:::vulkan
GLSL definierar flera sådana *inbyggda variabler*, med prefixet `gl_`. Två av dem har vi redan sett i kapitlen hittills:
`gl_Position`, vertex shaderns utdatavektor, och fragment shaderns `gl_FragCoord`, som vi använde i kapitlet *Depth
testing* för att titta på djupvärdena. Vulkans GLSL har nästan alla; några har bytt namn.
:::
:::d3d12
HLSL har inga variabler med fasta namn för det här. I stället märks en shaders indata och utdata med
*system-value semantics*, namn som börjar med `SV_`: den variabel eller structmedlem du märker med `SV_POSITION`,
`SV_TARGET`, `SV_IsFrontFace` … kopplas till det inbyggda värdet. Två av dem har vi använt i varje shader hittills:
`SV_POSITION`, clip space-positionen som vertex shadern returnerar (GLSL:s `gl_Position`), och `SV_TARGET`, färgen
som pixel shadern returnerar.
:::

Vi går igenom några intressanta inbyggda in- och utdatavariabler i shaderspråket och förklarar hur de kan vara till
nytta.

### Vertex shader variables

:::opengl
Vi har redan sett `gl_Position`, vertex shaderns positionsvektor i clip space. Att sätta `gl_Position` i vertex
shadern är ett absolut krav om du vill rita något på skärmen. Inget vi inte sett förut.
:::
:::vulkan
Vi har redan sett `gl_Position`, vertex shaderns positionsvektor i clip space. Att sätta `gl_Position` i vertex
shadern är ett absolut krav om du vill rita något på skärmen. Inget vi inte sett förut.
:::
:::d3d12
Vi har redan sett `SV_POSITION`, clip space-positionen som vertex shadern returnerar (i våra shaders medlemmen
`position` i den struct som `VSMain` returnerar). Att skriva den är ett absolut krav om du vill rita något på skärmen.
Inget vi inte sett förut.
:::

#### gl_PointSize

En av de primitiver vi kan välja att rita är punkter; då är varje enskild vertex en primitiv och ritas som en punkt.

:::opengl
Det går att ställa in storleken på punkterna som ritas med OpenGL:s funktion `glPointSize`, men vi kan också påverka
värdet i vertex shadern. En utdatavariabel som GLSL definierar heter `gl_PointSize`, en `float` där du kan sätta
punktens bredd och höjd i pixlar. Genom att sätta punktens storlek i vertex shadern får vi kontroll över punktens mått
per vertex.

Att påverka punktstorleken i vertex shadern är avstängt som standard, men vill du slå på det måste du aktivera OpenGL:s
`GL_PROGRAM_POINT_SIZE`:

```cpp
glEnable(GL_PROGRAM_POINT_SIZE);
```

Ett enkelt exempel är att sätta punktstorleken lika med clip space-positionens z-värde, som är lika med vertexens
avstånd till betraktaren. Punktstorleken ska då öka ju längre bort från vertexarna vi som betraktare befinner oss:

```glsl
void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
    gl_PointSize = gl_Position.z;
}
```
:::
:::vulkan
Vulkan har ingen `glPointSize` och ingen omkopplare som OpenGL:s `GL_PROGRAM_POINT_SIZE`: när pipelinens topologi är
`VK_PRIMITIVE_TOPOLOGY_POINT_LIST` kommer varje punkts storlek från vertex shaderns `gl_PointSize`, en `float` med
punktens bredd och höjd i pixlar. Vertex shadern måste alltså skriva den (om inte enheten har funktionen
`maintenance5` påslagen, som gör 1.0 till standardvärdet). Andra storlekar än 1.0 kräver enhetsfunktionen
`largePoints`, och det tillåtna intervallet är enhetsgränsen `pointSizeRange`.

Ett enkelt exempel är att sätta punktstorleken lika med clip space-positionens z-värde, som är lika med vertexens
avstånd till betraktaren. Punktstorleken ska då öka ju längre bort från vertexarna vi som betraktare befinner oss:

```glsl
void main() {
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
    gl_PointSize = gl_Position.z;
}
```
:::
:::d3d12
Här saknar Direct3D 12 motsvarighet: en punkt (`D3D_PRIMITIVE_TOPOLOGY_POINTLIST`) rastreras alltid som en enda
pixel. HLSL:s semantik `PSIZE` är en kvarleva från Direct3D 9 och har ingen särskild betydelse från Direct3D 10 och framåt. Behöver du större
punkter – till exempel partiklar – ritar du var och en som en liten quad: två trianglar, eller en geometry shader som
gör om varje punkt till en quad.
:::

Du kan föreställa dig att det är intressant att variera punktstorleken per vertex för tekniker som partikelgenerering.

#### gl_VertexID

:::opengl
`gl_Position` och `gl_PointSize` är *utdatavariabler* eftersom deras värden läses som utdata från vertex shadern; vi
kan påverka resultatet genom att skriva till dem. Vertex shadern ger oss också en intressant *indatavariabel*, som vi
bara kan läsa, som heter `gl_VertexID`.

Heltalsvariabeln `gl_VertexID` håller det aktuella ID:t för vertexen vi ritar. Vid *indexerad rendering* (med
`glDrawElements`) håller variabeln det aktuella indexet för vertexen vi ritar. När vi ritar utan index (med
`glDrawArrays`) håller variabeln numret på den vertex som bearbetas, räknat från ritanropets början.
:::
:::vulkan
`gl_Position` och `gl_PointSize` är *utdatavariabler* eftersom deras värden läses som utdata från vertex shadern; vi
kan påverka resultatet genom att skriva till dem. Vertex shadern ger oss också en intressant *indatavariabel*, som vi
bara kan läsa: OpenGL:s `gl_VertexID`, som i Vulkans GLSL heter `gl_VertexIndex`.

Heltalsvariabeln `gl_VertexIndex` håller indexet för vertexen vi ritar. Vid *indexerad rendering*
(`vkCmdDrawIndexed`) är det vertexens index från index buffern plus `vertexOffset`; när vi ritar utan index
(`vkCmdDraw`) räknar den från `firstVertex` – vårt golvs vertexar är 36 till 41. (På samma sätt heter OpenGL:s
`gl_InstanceID` `gl_InstanceIndex` i Vulkan.)
:::
:::d3d12
`SV_POSITION`-utdatan är *utdata* eftersom dess värde läses som utdata från vertex shadern. Vertex shadern får också
intressanta *indata* från systemet som vi bara kan läsa: OpenGL:s `gl_VertexID` är HLSL:s `SV_VertexID`, ett
teckenlöst heltal som du lägger till som parameter till vertex shadern:

```hlsl
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD, uint vertexID : SV_VertexID)
```

Den håller ID:t för vertexen vi ritar: med `DrawIndexedInstanced` vertexens index från index buffern, med
`DrawInstanced` en räknare över ritanropets vertexar. (På samma sätt är `gl_InstanceID` `SV_InstanceID`.)
:::

Även om det inte är särskilt användbart just nu är det bra att veta att vi har tillgång till sådan information.

### Fragment shader variables

I fragment shadern har vi också tillgång till några intressanta variabler.

:::opengl
GLSL ger oss två intressanta indatavariabler som heter `gl_FragCoord` och `gl_FrontFacing`.
:::
:::vulkan
GLSL ger oss två intressanta indatavariabler som heter `gl_FragCoord` och `gl_FrontFacing`.
:::
:::d3d12
HLSL ger pixel shadern samma två intressanta indata: `SV_POSITION` (GLSL:s `gl_FragCoord`) och `SV_IsFrontFace`
(GLSL:s `gl_FrontFacing`).
:::

#### gl_FragCoord

:::opengl
Vi har sett `gl_FragCoord` några gånger tidigare när vi gick igenom djuptestning, eftersom z-komponenten i
`gl_FragCoord` är lika med just det fragmentets djupvärde. Men vi kan också använda vektorns x- och y-komponent för
några intressanta effekter.

`gl_FragCoord`:s x- och y-komponent är fragmentets fönster- eller skärmkoordinater, med origo längst ned till vänster
i fönstret. Vi angav ett renderingsfönster på 800x600 med `glViewport`, så fragmentets skärmkoordinater har x-värden
mellan 0 och 800 och y-värden mellan 0 och 600. Ett fragments koordinater är mitten av dess pixel: pixeln längst ned
till vänster ligger på (0.5, 0.5).
:::
:::vulkan
Vi har sett `gl_FragCoord` några gånger tidigare när vi gick igenom djuptestning, eftersom z-komponenten i
`gl_FragCoord` är lika med just det fragmentets djupvärde. Men vi kan också använda vektorns x- och y-komponent för
några intressanta effekter.

`gl_FragCoord`:s x- och y-komponent är fragmentets framebuffer-koordinater i pixlar. Här skiljer sig Vulkan från
OpenGL: Vulkans GLSL lägger origo **längst upp till vänster** i framebuffern (OpenGL:s ligger längst ned till vänster).
Vårt fönster på 800x600 ger x-värden mellan 0 och 800 och y-värden mellan 0 och 600 – med y räknat nedåt. Ett fragments
koordinater är mitten av dess pixel: pixeln längst upp till vänster ligger på (0.5, 0.5). x är detsamma som i OpenGL.
:::
:::d3d12
Vi har sett en pixels djupvärde förut, i kapitlet om djuptestning. I pixel shadern är indatan med semantiken
`SV_POSITION` inte längre clip space-positionen som vertex shadern skrev: rasteriseraren har gjort om den till pixelns
position i render targeten – GLSL:s `gl_FragCoord`. Dess z-komponent är pixelns djupvärde, och dess x- och
y-komponent kan användas för några intressanta effekter.

Här skiljer sig Direct3D från OpenGL: origo ligger **längst upp till vänster** i render targeten (OpenGL:s ligger
längst ned till vänster). Vårt fönster på 800x600 ger x-värden mellan 0 och 800 och y-värden mellan 0 och 600 – med y
räknat nedåt. En pixels koordinater är dess mitt: pixeln längst upp till vänster ligger på (0.5, 0.5). x är detsamma
som i OpenGL. Eftersom vår struct `PSInput` är både det vertex shadern returnerar och det pixel shadern tar emot,
betyder samma medlem `position` clip space i det ena steget och pixelkoordinater i det andra.
:::

Med fragment shadern kan vi beräkna ett annat färgvärde utifrån fragmentets skärmkoordinat. En vanlig användning av
`gl_FragCoord` är att jämföra den visuella utdatan från olika fragmentberäkningar, som man ofta ser i tekniska demos.
Vi kan till exempel dela skärmen i två genom att visa en utdata på fönstrets vänstra sida och en annan på dess högra.

:::opengl
Gör nu den första uppgiften, **frag-coord**: i `advanced_glsl.fs` ersätter du texturuppslaget med en utdata som
bygger på fragmentets fönsterkoordinater:

```glsl
    if(gl_FragCoord.x < 400) // gl_FragCoord: the fragment's window position in pixels (origin at the bottom-left)
        FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    else
        FragColor = vec4(0.0, 1.0, 0.0, 1.0);
```
:::
:::vulkan
Gör nu den första uppgiften, **frag-coord**: i `shaders/advanced_glsl.frag` ersätter du texturuppslaget med en utdata
som bygger på fragmentets fönsterkoordinater:

```glsl
    if (gl_FragCoord.x < 400) { // gl_FragCoord: the fragment's window position in pixels (in Vulkan from the top-left)
        outColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        outColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
```
:::
:::d3d12
Gör nu den första uppgiften, **frag-coord**: i `PSMain` (`advanced_glsl.hlsl`) ersätter du texturuppslaget med en
utdata som bygger på pixelns fönsterkoordinater:

```hlsl
    // SV_POSITION in the pixel shader: the pixel's position in the window, in pixels
    // (origin at the top-left; GLSL's gl_FragCoord has its origin at the bottom-left).
    if (input.position.x < 400.0f)
        return float4(1.0f, 0.0f, 0.0f, 1.0f);
    else
        return float4(0.0f, 1.0f, 0.0f, 1.0f);
```
:::

Eftersom fönstret är 800 brett måste en pixel vars x-koordinat är mindre än 400 ligga på fönstrets vänstra sida, och då
ger vi fragmentet en annan färg. Bygg och kör: allt som ritas – kuberna och golvet – är rött till vänster om fönstrets
mitt och grönt till höger om den, medan bakgrunden, där inga fragment ritas, förblir mörk.

Nu kan vi beräkna två helt olika resultat i fragment shadern och visa vart och ett på var sin sida av fönstret. Det
är utmärkt för att till exempel prova olika ljussättningstekniker.

:::opengl
```quiz
Vilka är `gl_FragCoord.x` och `gl_FragCoord.y` för fragmentet i pixeln längst upp till vänster i fönstret på 800x600?
- [ ] (0.0, 0.0)
- [ ] (0.5, 0.5)
- [x] (0.5, 599.5)
- [ ] (400.0, 300.0)
---
OpenGL:s fönsterkoordinater börjar längst ned till vänster, och ett fragments koordinater är mitten av dess pixel. Fönstrets översta rad är y = 599.5.
```
:::
:::vulkan
```quiz
Vilka är `gl_FragCoord.x` och `gl_FragCoord.y` för fragmentet i pixeln längst upp till vänster i fönstret på 800x600 i Vulkan?
- [ ] (0.0, 0.0)
- [x] (0.5, 0.5)
- [ ] (0.5, 599.5)
- [ ] (400.0, 300.0)
---
Vulkans framebuffer-koordinater börjar längst upp till vänster, och ett fragments koordinater är mitten av dess pixel. I OpenGL skulle samma pixel vara (0.5, 599.5).
```
:::
:::d3d12
```quiz
Vilka är x och y i pixel shaderns `SV_POSITION`-indata för pixeln längst upp till vänster i fönstret på 800x600?
- [ ] (0.5, 599.5)
- [ ] (0.0, 0.0)
- [ ] (400.0, 300.0)
- [x] (0.5, 0.5)
---
Direct3D:s render target-koordinater börjar längst upp till vänster, och en pixels koordinater är dess mitt. GLSL:s `gl_FragCoord` skulle ge (0.5, 599.5) för samma pixel.
```
:::

#### gl_FrontFacing

:::opengl
En annan intressant indatavariabel i fragment shadern är `gl_FrontFacing`. I kapitlet *Face culling* nämnde vi att
OpenGL kan avgöra om en sida är en framsida eller en baksida utifrån vertexarnas winding order. Variabeln
`gl_FrontFacing` talar om för oss om det aktuella fragmentet hör till en framsida eller en baksida. Vi kan till exempel
välja att ge alla baksidor en annan färg.

Variabeln `gl_FrontFacing` är en `bool` som är `true` om fragmentet hör till en framsida och annars `false`.
:::
:::vulkan
En annan intressant indatavariabel i fragment shadern är `gl_FrontFacing`. I kapitlet *Face culling* såg vi att
Vulkan avgör om en sida är en framsida eller en baksida utifrån vertexarnas winding order på skärmen och pipelinens
`frontFace`. Variabeln `gl_FrontFacing` talar om för oss om det aktuella fragmentet hör till en framsida eller en
baksida. Vi kan till exempel välja att ge alla baksidor en annan färg.

Variabeln `gl_FrontFacing` är en `bool` som är `true` om fragmentet hör till en framsida och annars `false` – enligt
pipelinens `frontFace`, samma regel som culling använder.
:::
:::d3d12
En annan intressant indata till pixel shadern är den med semantiken `SV_IsFrontFace` – GLSL:s `gl_FrontFacing`. I
kapitlet *Face culling* såg vi att Direct3D avgör om en sida är en framsida eller en baksida utifrån vertexarnas
winding order på skärmen och PSO:ts `FrontCounterClockwise`. `SV_IsFrontFace` talar om för oss om den aktuella pixeln
hör till en framsida eller en baksida. Vi kan till exempel välja att ge alla baksidor en annan färg.

Du får den genom att lägga till en `bool`-parameter med den semantiken till pixel shadern: den är `true` om pixeln hör
till en framsida och annars `false` – enligt PSO:ts `FrontCounterClockwise`, samma regel som culling använder.
:::

learnopengls exempel texturerar lådan med en textur på utsidan och en annan på insidan. Men utanför en sluten kub ser
du bara framsidor: för att se insidan måste framsidorna bort. Så vi cullar framsidorna, som i slutet av kapitlet *Face
culling*, och tittar in i kuberna: det som blir kvar är insidorna av de bortre sidorna – baksidor.

:::opengl
Gör nu uppgiften **front-facing**. Vid TODO:n efter `glDepthFunc` cullar du framsidorna (vår kub går moturs sett
utifrån, OpenGL:s standard för framsidor):

```cpp
    glEnable(GL_CULL_FACE);
    glCullFace(GL_FRONT); // only the back faces are drawn: the insides of the cubes (and the floor, which is clockwise seen from above)
```

I `advanced_glsl.fs` blir `texture1` två samplers, och utdatan väljer en av dem med `gl_FrontFacing`:

```glsl
uniform sampler2D frontTexture;
uniform sampler2D backTexture;
```

```glsl
    if(gl_FrontFacing) // true for the front faces (counter-clockwise on screen), false for the back faces
        FragColor = texture(frontTexture, TexCoords);
    else
        FragColor = texture(backTexture, TexCoords);
```

De två samplers läser texturenhet 0 och 1 (`shader.setInt("frontTexture", 0); shader.setInt("backTexture", 1);` i
stället för `texture1`), och före kubernas ritanrop hamnar marmor på enhet 0 och metall på enhet 1:

```cpp
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);  // front faces: marble
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, floorTexture); // back faces: metal
```

Golvets egen `glBindTexture(GL_TEXTURE_2D, floorTexture)` binder nu till enhet 1, som fortfarande är aktiv – det går
bra, eftersom golvet är en baksida.
:::
:::vulkan
Gör nu uppgiften **front-facing**. I `createPipeline()` gör du moturs till framsida (vår kub går moturs sett utifrån –
se kapitlet *Face culling*) och cullar framsidorna:

```cpp
        rasterizer.frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE; // the cube's outside: counter-clockwise on screen (face culling chapter)
```

```cpp
        rasterizer.cullMode = VK_CULL_MODE_FRONT_BIT; // only the back faces are drawn: the insides of the cubes (and the floor, which is clockwise seen from above)
```

Fragment shadern behöver en andra textur. I `shaders/advanced_glsl.frag`:

```glsl
layout(binding = 1) uniform sampler2D frontTexture;
layout(binding = 2) uniform sampler2D backTexture;
```

```glsl
    if (gl_FrontFacing) { // true for the front faces (the pipeline's frontFace: counter-clockwise on screen)
        outColor = texture(frontTexture, fragTexCoord);
    } else {
        outColor = texture(backTexture, fragTexCoord);
    }
```

Det OpenGL gör med en andra texturenhet gör Vulkan med en andra descriptor: descriptor set-layouten får en tredje
binding, `backSamplerLayoutBinding` (binding 2, `VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER`,
`VK_SHADER_STAGE_FRAGMENT_BIT`); `createDescriptorSet` tar en andra image view och skriver den med en andra
`VkDescriptorImageInfo` i `descriptorWrites[2]`; poolen rymmer 4 bild-descriptors (två i varje set). Kubernas set får
marmor för framsidan och metall för baksidan, golvets set metall för båda:

```cpp
        createDescriptorSet(cubeTextureImageView, floorTextureImageView, textureSampler, cubeDescriptorSet);   // front faces marble, back faces metal
        createDescriptorSet(floorTextureImageView, floorTextureImageView, textureSampler, floorDescriptorSet); // metal on both sides
```
:::
:::d3d12
Gör nu uppgiften **front-facing**. Vid TODO:n cullar du framsidorna (`FrontCounterClockwise = TRUE` blir kvar: vår kub
går moturs sett utifrån):

```cpp
        // Cull the front faces: only the back faces are drawn - the insides of the cubes (and
        // the floor, which is clockwise seen from above).
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_FRONT;
```

Pixel shadern behöver en andra textur och indatan `SV_IsFrontFace`. I `advanced_glsl.hlsl`:

```hlsl
Texture2D frontTexture : register(t0);
Texture2D backTexture : register(t1);
```

```hlsl
float4 PSMain(PSInput input, bool isFrontFace : SV_IsFrontFace) : SV_TARGET
{
    if (isFrontFace)
        return frontTexture.Sample(wrapSampler, input.texCoord);
    else
        return backTexture.Sample(wrapSampler, input.texCoord);
}
```

Det OpenGL gör med en andra texturenhet gör Direct3D 12 med en andra descriptor i tabellen för root parameter 2.
Intervallet omfattar nu två SRV:er, t0 och t1:

```cpp
        ranges[1].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0);
```

En descriptor table pekar på descriptors som ligger efter varandra i heapen, och våra ligger redan i rätt ordning:
plats 1 håller marmor, plats 2 metall. Så ett enda GPU-handtag på plats 1 ger t0 = marmor och t1 = metall. I
`PopulateCommandList` ersätter det `cubeTexture` och `floorTexture`:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE faceTextures(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 1, m_cbvSrvDescriptorSize);
```

`SetGraphicsRootDescriptorTable(2, faceTextures)` sätts en gång före kuberna; golvet använder samma tabell (inget anrop
före dess ritanrop) – det är en baksida, så det får metall som förut.
:::

Bygg och kör. Kuberna behåller sina konturer, men nu tittar du in i dem: insidan av den bortre sidan, inramad av
insidorna av sidoytorna – allt i metall. Inte en enda pixel marmor finns kvar, och golvet är oförändrat.

```quiz
Efter uppgiften **front-facing** syns ingen marmor någonstans, fast framsidornas textur är marmor. Varför?
- [ ] Marmortexturen är inte längre bunden
- [x] Framsidorna cullas, så varje fragment som ritas hör till en baksida och läser baksidornas textur
- [ ] Framsidorna ritas, men metallbaksidorna ritas ovanpå dem
- [ ] Kontrollen av framsidor är alltid falsk när culling är påslaget
---
Utanför en sluten kub ser du bara framsidor; när de cullas blir bara insidorna – baksidor – kvar. Golvet är också en baksida (medurs sett ovanifrån), så det behåller sin metall.
```

#### gl_FragDepth

:::opengl
Indatavariabeln `gl_FragCoord` låter oss läsa skärmkoordinater och hämta det aktuella fragmentets djupvärde, men den
är *skrivskyddad*. Vi kan inte påverka fragmentets skärmkoordinater, men det går att sätta fragmentets djupvärde. GLSL
ger oss en utdatavariabel som heter `gl_FragDepth` som vi kan använda för att sätta fragmentets djupvärde manuellt i
shadern.

För att sätta djupvärdet i shadern skriver vi ett värde mellan 0.0 och 1.0 till utdatavariabeln:

```glsl
gl_FragDepth = 0.0; // this fragment now has a depth value of 0.0
```

Om shadern inte skriver något till `gl_FragDepth` tar variabeln automatiskt sitt värde från `gl_FragCoord.z`.
:::
:::vulkan
Indatavariabeln `gl_FragCoord` låter oss läsa skärmkoordinater och hämta det aktuella fragmentets djupvärde, men den
är *skrivskyddad*. Vi kan inte påverka fragmentets skärmkoordinater, men det går att sätta fragmentets djupvärde. GLSL
ger oss en utdatavariabel som heter `gl_FragDepth` som vi kan använda för att sätta fragmentets djupvärde manuellt i
shadern – i Vulkan precis som i OpenGL.

För att sätta djupvärdet i shadern skriver vi ett värde mellan 0.0 och 1.0 till utdatavariabeln:

```glsl
gl_FragDepth = 0.0; // this fragment now has a depth value of 0.0
```

Om shadern inte skriver något till `gl_FragDepth` kommer djupet från `gl_FragCoord.z`.
:::
:::d3d12
Pixel shaderns indata `SV_POSITION` låter oss läsa pixelns position och djup, men att ändra den ändrar ingenting: den
är indata. Det går däremot att sätta pixelns djupvärde, med en *utdata* märkt `SV_Depth` – GLSL:s `gl_FragDepth`.
Pixel shadern returnerar då en struct med färgen och djupet:

```hlsl
struct PSOutput
{
    float4 color : SV_TARGET;
    float depth : SV_Depth;
};

PSOutput PSMain(PSInput input)
{
    PSOutput output;
    output.color = float4(1.0f, 1.0f, 1.0f, 1.0f);
    output.depth = 0.0f; // this pixel now has a depth value of 0.0
    return output;
}
```

Om pixel shadern inte har någon `SV_Depth`-utdata är djupet det som rasteriseraren interpolerade (`SV_POSITION`:s z).
:::

Att sätta djupvärdet manuellt har dock en stor nackdel. GPU:n stänger nämligen oftast av *early depth testing* (som
vi diskuterade i kapitlet om djuptestning) så fort fragment shadern skriver djupet. Det stängs av eftersom GPU:n inte
kan veta vilket djupvärde fragmentet kommer att ha *innan* vi kör fragment shadern, då fragment shadern faktiskt kan
ändra värdet.

När du skriver djupet själv bör du räkna med den prestandaförlusten. Det finns dock ett sätt att behålla en del av
vinsten: *conservative depth*, där du lovar GPU:n åt vilket håll du kommer att ändra djupvärdet.

:::opengl
Från OpenGL 4.2 kan vi ändå medla lite mellan de två sidorna genom att deklarera om variabeln `gl_FragDepth` högst
upp i fragment shadern med ett *djupvillkor*:

```glsl
layout (depth_<condition>) out float gl_FragDepth;
```

`condition` kan ta följande värden:

| Villkor | Beskrivning |
| --- | --- |
| `any` | Standardvärdet. Early depth testing är avstängt. |
| `greater` | Du kan bara göra djupvärdet större jämfört med `gl_FragCoord.z`. |
| `less` | Du kan bara göra djupvärdet mindre jämfört med `gl_FragCoord.z`. |
| `unchanged` | Om du skriver till `gl_FragDepth` skriver du exakt `gl_FragCoord.z`. |

Genom att ange `greater` eller `less` som djupvillkor kan OpenGL anta att du bara skriver djupvärden som är större
eller mindre än fragmentets djupvärde. På så sätt kan OpenGL fortfarande göra early depth testing när värdet i depth
buffern ligger på andra sidan om `gl_FragCoord.z`.

Ett exempel där vi ökar djupvärdet i fragment shadern men ändå vill behålla en del av early depth testing visas i
fragment shadern nedan:

```glsl
#version 420 core // note the GLSL version!
out vec4 FragColor;
layout (depth_greater) out float gl_FragDepth;

void main()
{
    FragColor = vec4(1.0);
    gl_FragDepth = gl_FragCoord.z + 0.1;
}
```

Observera att den här funktionen bara finns från OpenGL version 4.2 och uppåt – inte i vår OpenGL 3.3.
:::
:::vulkan
Vulkans GLSL (`#version 450`) stöder samma *djupvillkor* som OpenGL har från version 4.2: du deklarerar om
`gl_FragDepth` högst upp i fragment shadern:

```glsl
layout (depth_<condition>) out float gl_FragDepth;
```

`condition` kan ta följande värden:

| Villkor | Beskrivning |
| --- | --- |
| `any` | Standardvärdet. Early depth testing är avstängt. |
| `greater` | Du kan bara göra djupvärdet större jämfört med `gl_FragCoord.z`. |
| `less` | Du kan bara göra djupvärdet mindre jämfört med `gl_FragCoord.z`. |
| `unchanged` | Om du skriver till `gl_FragDepth` skriver du exakt `gl_FragCoord.z`. |

Genom att ange `greater` eller `less` kan GPU:n anta att du bara skriver djupvärden som är större eller mindre än
fragmentets djupvärde, och fortfarande testa tidigt när det lagrade djupet ligger på andra sidan:

```glsl
#version 450
layout(location = 0) out vec4 outColor;
layout (depth_greater) out float gl_FragDepth;

void main() {
    outColor = vec4(1.0);
    gl_FragDepth = gl_FragCoord.z + 0.1;
}
```
:::
:::d3d12
HLSL (från shader model 5.0) har ytterligare två djupsemantiker för detta: `SV_DepthGreaterEqual` och
`SV_DepthLessEqual`. De lovar att djupet du skriver är större (eller mindre) än eller lika med det rastrerade, så GPU:n
fortfarande kan testa tidigt när det lagrade djupet ligger på andra sidan:

```hlsl
struct PSOutput
{
    float4 color : SV_TARGET;
    float depth : SV_DepthGreaterEqual; // the depth only ever grows
};

PSOutput PSMain(PSInput input)
{
    PSOutput output;
    output.color = float4(1.0f, 1.0f, 1.0f, 1.0f);
    output.depth = input.position.z + 0.1f;
    return output;
}
```
:::

```quiz
Varför kan det göra renderingen långsammare att skriva djupvärdet i fragment shadern?
- [x] GPU:n kan inte längre köra djuptestet före fragment shadern, eftersom djupet blir känt först efter den
- [ ] För att depth buffern måste rensas igen för varje fragment
- [ ] För att ett skrivet djupvärde lagras med högre precision
- [ ] För att vertex shadern då körs två gånger
---
Early depth testing kastar dolda fragment innan de shadas. Om shadern kan ändra djupet måste testet vänta på shadern – om inte ett löfte om conservative depth (greater/less) låter GPU:n avgöra vissa fall tidigt ändå.
```

## Interface blocks

Hittills har vi, varje gång vi skickat data från vertex shadern till fragment shadern, deklarerat flera matchande in-
och utdatavariabler. Att deklarera dem en i taget är det enklaste sättet att skicka data från en shader till en annan,
men när programmen växer vill du förmodligen skicka mer än några få variabler.

:::opengl
För att hjälpa oss att organisera de här variablerna erbjuder GLSL något som kallas *interface blocks*, som låter oss
gruppera variabler. Deklarationen av ett sådant interface block ser mycket ut som en `struct`-deklaration, förutom att
den nu görs med nyckelordet `in` eller `out` beroende på om blocket är ett indata- eller utdatablock.

Gör nu uppgiften **interface-block**. I `advanced_glsl.vs`:

```glsl
out VS_OUT
{
    vec2 TexCoords;
} vs_out;
```

```glsl
    vs_out.TexCoords = aTexCoords;
```

Den här gången deklarerade vi ett interface block som heter `VS_OUT` och som samlar alla utdatavariabler vi vill skicka
till nästa shader. Det är ett ganska trivialt exempel, men du kan föreställa dig att det hjälper till att organisera
shadrarnas in- och utdata. Det är också användbart när vi vill gruppera shaderns in- och utdata i arrayer, som vi ser i
nästa kapitel om geometry shaders.

Sedan måste vi också deklarera ett indatablock i nästa shader, fragment shadern. *Blocknamnet* (`VS_OUT`) ska vara
detsamma i fragment shadern, men *instansnamnet* (`vs_out` som det används i vertex shadern) kan vara vad vi vill –
helst inte förvirrande namn som `vs_out` för en fragment-struct med indata. I `advanced_glsl.fs`:

```glsl
in VS_OUT
{
    vec2 TexCoords;
} fs_in;
```

```glsl
    if(gl_FrontFacing) // true for the front faces (counter-clockwise on screen), false for the back faces
        FragColor = texture(frontTexture, fs_in.TexCoords);
    else
        FragColor = texture(backTexture, fs_in.TexCoords);
```

Så länge de båda blocknamnen är lika kopplas motsvarande in- och utdata ihop.
:::
:::vulkan
För att hjälpa oss att organisera de här variablerna erbjuder GLSL något som kallas *interface blocks*, som låter oss
gruppera variabler. Deklarationen av ett sådant interface block ser mycket ut som en `struct`-deklaration, förutom att
den nu görs med nyckelordet `in` eller `out` beroende på om blocket är ett indata- eller utdatablock.

Gör nu uppgiften **interface-block**. I `shaders/advanced_glsl.vert`:

```glsl
layout(location = 0) out VS_OUT {
    vec2 texCoord;
} vs_out;
```

```glsl
    vs_out.texCoord = inTexCoord;
```

Den här gången deklarerade vi ett interface block som heter `VS_OUT` och som samlar alla utdatavariabler vi vill skicka
till nästa shader. Det är ett ganska trivialt exempel, men du kan föreställa dig att det hjälper till att organisera
shadrarnas in- och utdata. Det är också användbart när vi vill gruppera shaderns in- och utdata i arrayer, som
learnopengls kapitel om geometry shaders visar.

Sedan måste vi också deklarera ett indatablock i fragment shadern. I `shaders/advanced_glsl.frag`:

```glsl
layout(location = 0) in VS_OUT {
    vec2 texCoord;
} fs_in;
```

```glsl
        outColor = texture(frontTexture, fs_in.texCoord);
    } else {
        outColor = texture(backTexture, fs_in.texCoord);
```

I OpenGL kopplas stegens utdata och indata ihop via namn. Vulkans GLSL kopplar ihop dem via `location`, och därför får
blocket `layout(location = 0)` – dess medlem tar location 0, den location som `fragTexCoord` hade. Behåll samma
blocknamn (`VS_OUT`) i båda shadrarna, som GLSL kräver; *instansnamnen* (`vs_out`, `fs_in`) får skilja sig åt.
:::
:::d3d12
HLSL har inga `in`- eller `out`-block – den behöver dem inte: den struct som vertex shadern returnerar och pixel shadern
tar emot *är* redan ett interface block. GLSL:s

```glsl
out VS_OUT
{
    vec2 TexCoords;
} vs_out;
```

i vertex shadern och `in VS_OUT { … } fs_in;` i fragment shadern är i HLSL en enda struct som båda stegen använder. Gör
nu uppgiften **interface-block**: ge vår struct learnopengls namn – `PSInput` blir `VS_OUT`, vertex shaderns variabel
`vs_out` och pixel shaderns parameter `fs_in`:

```hlsl
struct VS_OUT
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
VS_OUT VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    VS_OUT vs_out;

    // model, then view, then projection (GLSL: projection * view * model * position).
    vs_out.position = mul(mul(mul(position, model), view), projection);
    vs_out.texCoord = texCoord;

    return vs_out;
}
```

```hlsl
float4 PSMain(VS_OUT fs_in, bool isFrontFace : SV_IsFrontFace) : SV_TARGET
{
    if (isFrontFace)
        return frontTexture.Sample(wrapSampler, fs_in.texCoord);
    else
        return backTexture.Sample(wrapSampler, fs_in.texCoord);
}
```

Stegen kopplas ihop via *semantiken* (`SV_POSITION`, `TEXCOORD`), inte via namnen: vertex shaderns `TEXCOORD`-utdata
kommer fram i pixel shaderns `TEXCOORD`-indata. Structen skulle till och med kunna deklareras två gånger, under två
namn, i två filer – så länge semantiken stämmer.
:::

Bygg och kör: ingenting ändras, inte en enda pixel. Blocket organiserar bara shadrarnas in- och utdata.

:::opengl
```quiz
Vertex shadern deklarerar `out VS_OUT { vec2 TexCoords; } vs_out;`. Vad måste fragment shaderns indatablock ha gemensamt med det?
- [ ] Instansnamnet `vs_out`
- [ ] Ingenting: OpenGL kopplar ihop block efter deras ordning i filen
- [x] Blocknamnet `VS_OUT` (och dess medlemmar); instansnamnet får skilja sig
- [ ] Kvalificeraren `layout (std140)`
---
Blocknamnet kopplar ihop de två stegen; instansnamnet (`vs_out`, `fs_in`) är bara hur varje shader refererar till blocket. Därför kan fragment shadern kalla det `fs_in`.
```
:::
:::vulkan
```quiz
Hur kopplar Vulkan ihop vertex shaderns utdatablock `VS_OUT` med fragment shaderns indatablock?
- [x] Via `location`: stegens utdata och indata kopplas ihop via location, och därför får blocket `layout(location = 0)`
- [ ] Via instansnamnen `vs_out` och `fs_in`
- [ ] Via ordningen som pipelinen listar shaderstegen i
- [ ] Genom descriptor setet, som en uniform buffer
---
Vulkans GLSL kopplar ihop gränssnittet mellan stegen via location, inte via namn. Blockets medlem tar location 0 – den location som den vanliga variabeln `fragTexCoord` hade förut.
```
:::
:::d3d12
```quiz
Hur kopplar Direct3D ihop vertex shaderns utdata-struct med pixel shaderns indata?
- [ ] Via structens namn: båda stegen måste använda `VS_OUT`
- [x] Via medlemmarnas semantik (`SV_POSITION`, `TEXCOORD`)
- [ ] Via parameternamnen `vs_out` och `fs_in`
- [ ] Genom PSO:ts input layout
---
HLSL kopplar ihop det ett steg skriver med det nästa läser via semantiken. Structens namn och variabelnamnen är bara till för dig; input layouten handlar om vertex shaderns indata från vertex buffrarna.
```
:::

## Uniform buffer objects

:::opengl
Vi har använt OpenGL ett bra tag nu och lärt oss en del häftiga knep, men också stött på några irritationsmoment. När
vi till exempel använder mer än en shader måste vi hela tiden sätta uniform-variabler, där de flesta är exakt
desamma för varje shader.

OpenGL ger oss ett verktyg som kallas *uniform buffer objects*, som låter oss deklarera en uppsättning *globala*
uniform-variabler som förblir desamma i hur många shaderprogram som helst. Med uniform buffer objects sätter vi de
aktuella uniforms bara **en gång** i fast GPU-minne. Uniforms som är unika per shader måste vi fortfarande sätta för
hand. Att skapa och konfigurera ett uniform buffer object kräver dock lite arbete.

Eftersom ett uniform buffer object är en buffer som vilken annan som helst kan vi skapa ett med `glGenBuffers`, binda
det till buffer target `GL_UNIFORM_BUFFER` och lagra all relevant uniform-data i bufferten. Det finns vissa regler för
hur datan i uniform buffer objects ska lagras, och dem kommer vi till senare. Först tar vi en enkel vertex shader och
lagrar vår `projection`- och `view`-matris i ett så kallat *uniform block*:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;

layout (std140) uniform Matrices
{
    mat4 projection; // offset 0
    mat4 view;       // offset 64 (sizeof(glm::mat4))
};
uniform mat4 model;

void main()
{
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

I de flesta av våra exempel sätter vi en projektions- och en vymatris som uniforms varje frame för varje shader vi
använder. Det är ett perfekt exempel på när uniform buffer objects blir användbara, eftersom vi nu bara behöver lagra
matriserna en gång.

Här deklarerade vi ett uniform block som heter `Matrices` och som lagrar två 4x4-matriser. Variabler i ett uniform
block kan nås direkt, utan blocknamnet som prefix. Sedan lagrar vi matrisvärdena i en buffer någonstans i
OpenGL-koden, och varje shader som deklarerar det här uniform blocket har tillgång till matriserna.

Du undrar säkert vad `layout (std140)` betyder. Det säger att det definierade uniform blocket använder en bestämd
minneslayout för sitt innehåll; uttrycket anger blockets *uniform block layout*.
:::
:::vulkan
I OpenGL introducerar learnopengl *uniform buffer objects* här: i stället för att sätta samma uniforms –
projektions- och vymatrisen – i varje shaderprogram för sig deklarerar du dem i ett *uniform block* och lagrar dem
**en gång** i en buffer som alla programmen läser.

I Vulkan har du gjort så ända sedan vulkan-tutorials kapitel om *Uniform buffers*. Vulkans GLSL har inga lösa
uniform-variabler alls (utom opaka som samplers): varje värde kommer från ett block. Vår vertex shaders

```glsl
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;
```

är ett uniform block, `uniformBuffer` bakom det är uniform buffer objectet, och varje pipeline som använder samma
descriptor set läser samma matriser. Modellmatrisen per objekt kommer från en andra sorts block, push constants
(`layout(push_constant) uniform PushConstants`), som följer med inuti command buffern. Det som återstår att lära av
learnopengls kapitel är *hur* datan ligger i bufferten – reglerna som varje uniform block följer, i Vulkan som i OpenGL.
:::
:::d3d12
I OpenGL introducerar learnopengl *uniform buffer objects* här: i stället för att sätta samma uniforms –
projektions- och vymatrisen – i varje shaderprogram för sig deklarerar du dem i ett *uniform block* och lagrar dem
**en gång** i en buffer som alla programmen läser.

I Direct3D 12 har du gjort så ända sedan kapitlet *Coordinate systems*. HLSL:s *constant buffers* är uniform blocks:

```hlsl
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};
```

deklarerar ett block i register `b1` vars medlemmar används via namn, utan prefix – precis som i ett uniform block i
GLSL. Bufferten bakom det, `m_constantBuffer`, är uniform buffer objectet, och varje pipeline state som läser `b1` med
samma root signature läser samma matriser. Modellmatrisen per objekt kommer från root constants
(`cbuffer ModelConstants : register(b0)`, satta med `SetGraphicsRoot32BitConstants`), som följer med inuti command
listen. Det som återstår att lära av learnopengls kapitel är *hur* datan ligger i bufferten – HLSL har egna regler för
det.
:::

## Uniform block layout

Innehållet i ett uniform block lagras i ett buffer-objekt, som i praktiken inte är något annat än en reserverad bit
globalt GPU-minne. Eftersom den biten minne inte vet vad för slags data den håller måste vi tala om för GPU:n vilka
delar av minnet som motsvarar vilka uniform-variabler i shadern.

:::opengl
Tänk dig följande uniform block i en shader:

```glsl
layout (std140) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
};
```
:::
:::vulkan
Tänk dig följande uniform block i en shader:

```glsl
layout(binding = 0) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
} example;
```
:::
:::d3d12
Tänk dig följande uniform block i GLSL i en shader:

```glsl
layout (std140) uniform ExampleBlock
{
    float value;
    vec3  vector;
    mat4  matrix;
    float values[3];
    bool  boolean;
    int   integer;
};
```
:::

Det vi vill veta är storleken (i byte) och offseten (från blockets början) för var och en av variablerna, så att vi
kan placera dem i bufferten i rätt ordning. Storleken på varje element står tydligt i C++ och motsvarar direkt
C++-variabler; vektorer och matriser är (stora) arrayer av floats. Det som inte står tydligt är *avståndet* mellan
variablerna. Det låter hårdvaran placera eller fylla ut variabler som den finner lämpligt. Hårdvaran kan till exempel
placera en `vec3` direkt intill en `float`. All hårdvara klarar inte det, utan fyller ut `vec3` till en array med 4
floats innan `float` läggs efter. En bra funktion, men opraktisk för oss.

:::opengl
Som standard använder GLSL en minneslayout för uniforms som kallas *shared* – delad eftersom offseten, när hårdvaran
väl har bestämt dem, delas konsekvent mellan flera program. Med en shared layout får GLSL flytta uniform-variablerna
för optimering så länge variablernas ordning består. Eftersom vi inte vet på vilken offset varje uniform-variabel
hamnar vet vi inte hur vi ska fylla vår uniform buffer exakt. Vi kan fråga efter informationen med funktioner som
`glGetUniformIndices`, men det är inte det sätt vi väljer i det här kapitlet.

En shared layout ger oss visserligen vissa utrymmesbesparande optimeringar, men vi skulle behöva fråga efter offseten
för varenda uniform-variabel, vilket blir mycket arbete. Den allmänna praxisen är i stället att inte använda shared
layout, utan layouten *std140*. std140-layouten anger uttryckligen minneslayouten för varje variabeltyp genom att
standardisera deras offset enligt en uppsättning regler. Eftersom den är standardiserad kan vi själva räkna ut
offseten för varje variabel.
:::
:::vulkan
I OpenGL överlåter ett uniform blocks standardlayout, *shared*, offseten åt drivrutinen, och du skulle behöva fråga
efter dem; därför skriver learnopengl `layout (std140)`, en layout vars offset är standardiserade av en uppsättning
regler. I Vulkans GLSL är valet redan gjort åt dig: ett uniform block använder **std140** som standard (layouterna
*shared* och *packed* finns inte där), och ett push constant-block använder den tätare *std430*. Eftersom layouten är
standardiserad kan vi själva räkna ut offseten för varje variabel – och måste, eftersom den C++-struct vi kopierar in i
bufferten måste lägga varje medlem på exakt den offseten.
:::
:::d3d12
GLSL har flera layouter för det här; learnopengl använder *std140*, som standardiserar varje variabels offset enligt
en uppsättning regler. HLSL har en enda uppsättning regler för constant buffers, *packing rules for constant
variables*. De liknar std140 vid första anblick – båda arbetar i enheter om 16 byte – men de packar tätare i ett
viktigt fall. Vi tittar först på std140, sedan på vad HLSL gör annorlunda.
:::

Varje variabel har en *base alignment* som är lika med det utrymme variabeln tar (inklusive utfyllnad) i ett uniform
block enligt std140-reglerna. För varje variabel beräknar vi dess *aligned offset*: variabelns byte-offset från
blockets början. En variabels aligned offset **måste** vara en multipel av dess base alignment.

De exakta layoutreglerna finns i OpenGL:s specifikation för uniform buffers, men vi listar de vanligaste reglerna
nedan. Varje variabeltyp i GLSL som `int`, `float` och `bool` är definierad som en storhet på fyra byte, där varje
enhet på 4 byte betecknas `N`.

| Typ | Layoutregel |
| --- | --- |
| Skalär, t.ex. `int` eller `bool` | Varje skalär har base alignment N. |
| Vektor | Antingen 2N eller 4N. Det betyder att en `vec3` har base alignment 4N. |
| Array av skalärer eller vektorer | Varje element har samma base alignment som en `vec4`. |
| Matriser | Lagras som en stor array av kolumnvektorer, där var och en av vektorerna har base alignment som en `vec4`. |
| Struct | Lika med den beräknade storleken på dess element enligt de tidigare reglerna, men utfylld till en multipel av storleken på en `vec4`. |

Som det mesta i OpenGL:s specifikationer är det lättare att förstå med ett exempel. Vi tar uniform blocket
`ExampleBlock` som vi introducerade tidigare och beräknar aligned offset för var och en av dess medlemmar enligt
std140-layouten:

```glsl
layout (std140) uniform ExampleBlock
{
                     // base alignment  // aligned offset
    float value;     // 4               // 0
    vec3 vector;     // 16              // 16  (offset must be multiple of 16 so 4->16)
    mat4 matrix;     // 16              // 32  (column 0)
                     // 16              // 48  (column 1)
                     // 16              // 64  (column 2)
                     // 16              // 80  (column 3)
    float values[3]; // 16              // 96  (values[0])
                     // 16              // 112 (values[1])
                     // 16              // 128 (values[2])
    bool boolean;    // 4               // 144
    int integer;     // 4               // 148
};
```

Som övning kan du försöka räkna ut offseten själv och jämföra dem med tabellen. Med de här beräknade offseten, baserade
på std140-reglerna, kan vi fylla bufferten med data på rätt offset.
std140-layouten är inte den mest effektiva, men den garanterar att minneslayouten förblir densamma i varje program som
deklarerar det här uniform blocket.

:::opengl
Genom att lägga till `layout (std140)` i definitionen av uniform blocket talar vi om för OpenGL att blocket använder
std140-layouten. Det finns två andra layouter att välja mellan, som kräver att vi frågar efter varje offset innan vi
fyller buffrarna. Layouten `shared` har vi redan sett, och den andra är `packed`. Med layouten `packed` finns ingen
garanti att layouten förblir densamma mellan program (inte delad), eftersom kompilatorn då får optimera bort
uniform-variabler ur blocket, vilket kan skilja sig mellan shaders.

Observera att matriserna lagras som kolumner – och det gör GLM också: `glm::value_ptr` för en `glm::mat4` ger exakt de
fyra kolumner som std140 väntar sig, och därför kan vi kopiera GLM-matriser in i en uniform buffer som de är.
:::
:::vulkan
Samma regler gäller för vår `UniformBufferObject`: två `mat4`, var och en fyra kolumner om 16 byte, `view` på offset 0
och `proj` på offset 64. C++-structen med två `glm::mat4` har exakt den layouten – GLM lagrar också matriser som
kolumner – så `memcpy` av structen lägger varje byte på rätt plats. För ett block som `ExampleBlock` skulle den inte
göra det: en C++-struct skulle lägga `vector` på offset 4, std140 väntar sig den på 16. vulkan-tutorials kapitel
*Descriptor pool and sets* visar lösningen: `alignas(16)` på sådana medlemmar i C++-structen.
:::
:::d3d12
Här är samma block som en constant buffer i HLSL, med HLSL:s offset:

```hlsl
cbuffer ExampleBlock
{
    float    value;     // offset 0
    float3   vector;    // offset 4: fits in the rest of the first 16 bytes
    float4x4 matrix;    // offset 16
    float    values[3]; // offsets 80, 96, 112: every array element starts a new 16 bytes
};
```

HLSL packar variabler i register om 16 byte (fyra komponenter om 4 byte) och flyttar bara en variabel till nästa
register när den skulle *gränsla* en 16-bytesgräns. En `float3` efter en `float` får plats i resten av registret, så
den hamnar på offset 4 – där std140 skulle lägga den på 16. Arrayer är likadana i båda: varje element börjar i ett nytt
register.

Två regler till spelar roll för Direct3D 12. En constant buffer views storlek måste vara en multipel av 256 byte
(`D3D12_CONSTANT_BUFFER_DATA_PLACEMENT_ALIGNMENT`) – det är det som projektets `CalculateConstantBufferByteSize`
avrundar uppåt till – och dess startadress måste också vara justerad till 256 byte. Och HLSL lagrar som standard en
matris i en constant buffer kolumn för kolumn (`column_major`), medan DirectXMath lagrar en `XMMATRIX` rad för rad.
Därför transponerar projektet varje matris (`XMMatrixTranspose`) innan den kopieras: den transponerade matrisens rader
är originalets kolumner, precis det som HLSL väntar sig.
:::

:::opengl
```quiz
I ett uniform block med `layout (std140)` följs `float value;` av `vec3 vector;`. På vilken byte-offset börjar `vector`?
- [ ] 4
- [ ] 12
- [x] 16
- [ ] 32
---
En `vec3` har base alignment 4N = 16 byte, så dess offset måste vara en multipel av 16. Efter floaten på offset 0 är nästa multipel av 16 just 16 – byte 4 till 15 är utfyllnad.
```
:::
:::vulkan
```quiz
I ett uniform block i Vulkans GLSL (std140 som standard) följs `float value;` av `vec3 vector;`. På vilken byte-offset börjar `vector`?
- [ ] 4
- [ ] 12
- [x] 16
- [ ] 32
---
En `vec3` har base alignment 4N = 16 byte, så dess offset måste vara en multipel av 16. Efter floaten på offset 0 är nästa multipel av 16 just 16 – byte 4 till 15 är utfyllnad. En vanlig C++-struct skulle lägga den på 4, därav `alignas(16)`.
```
:::
:::d3d12
```quiz
I en `cbuffer` i HLSL följs `float value;` av `float3 vector;`. På vilken byte-offset börjar `vector`?
- [x] 4
- [ ] 12
- [ ] 16
- [ ] 32
---
HLSL flyttar bara en variabel till nästa register om den skulle gränsla en 16-bytesgräns. float3 behöver 12 byte, och 12 finns kvar i det första registret efter floaten – så den börjar på 4, där GLSL:s std140 skulle lägga den på 16.
```
:::

## Using uniform buffers

:::opengl
Vi har definierat uniform blocks och angett deras minneslayout, men vi har inte gått igenom hur man faktiskt använder
dem än.

Först måste vi skapa ett uniform buffer object, vilket görs med välbekanta `glGenBuffers`. När vi har ett
buffer-objekt binder vi det till target `GL_UNIFORM_BUFFER` och allokerar tillräckligt med minne med `glBufferData`:

```cpp
unsigned int uboExampleBlock;
glGenBuffers(1, &uboExampleBlock);
glBindBuffer(GL_UNIFORM_BUFFER, uboExampleBlock);
glBufferData(GL_UNIFORM_BUFFER, 152, NULL, GL_STATIC_DRAW); // allocate 152 bytes of memory
glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Så fort vi vill uppdatera eller lägga in data i bufferten binder vi `uboExampleBlock` och uppdaterar dess minne med
`glBufferSubData`. Vi behöver bara uppdatera den här uniform buffern en gång, och alla shaders som använder bufferten
använder då den uppdaterade datan. Men hur vet OpenGL vilka uniform buffers som hör till vilka uniform blocks?

I OpenGL-kontexten finns ett antal *binding points* definierade som vi kan koppla en uniform buffer till. När vi har
skapat en uniform buffer kopplar vi den till en av de här binding points, och vi kopplar också uniform blocket i
shadern till samma binding point, vilket i praktiken kopplar ihop dem: en shaders uniform block pekar på, säg, binding
point 2, och binding point 2 pekar på bufferten. Flera shaders block kan peka på samma binding point, och det är så de
delar datan.

För att koppla en shaders uniform block till en viss binding point anropar vi `glUniformBlockBinding`, som tar ett
programobjekt, ett uniform block-index och den binding point som blocket ska kopplas till. *Uniform block-indexet* är
ett platsindex för det definierade uniform blocket i shadern. Det hämtas med ett anrop till `glGetUniformBlockIndex`,
som tar ett programobjekt och uniform blockets namn. Vi kan koppla uniform blocket `Lights` i en shader till binding
point 2 så här:

```cpp
unsigned int lights_index = glGetUniformBlockIndex(shaderA.ID, "Lights");
glUniformBlockBinding(shaderA.ID, lights_index, 2);
```

Observera att vi måste upprepa detta för **varje** shader.

Från OpenGL version 4.2 går det också att ange ett uniform blocks binding point uttryckligen i shadern med ytterligare
en layout-specificerare, vilket besparar oss anropen till `glGetUniformBlockIndex` och `glUniformBlockBinding`.
Följande kod anger uttryckligen binding point för uniform blocket `Lights`:

```glsl
layout(std140, binding = 2) uniform Lights { ... };
```

Sedan måste vi också binda uniform buffer objectet till samma binding point, och det görs med antingen
`glBindBufferBase` eller `glBindBufferRange`.

```cpp
glBindBufferBase(GL_UNIFORM_BUFFER, 2, uboExampleBlock);
// or
glBindBufferRange(GL_UNIFORM_BUFFER, 2, uboExampleBlock, 0, 152);
```

Funktionen `glBindBufferBase` tar ett target, ett binding point-index och ett uniform buffer object. Den kopplar
`uboExampleBlock` till binding point 2; från och med nu är båda sidorna av binding pointen ihopkopplade. Du kan också
använda `glBindBufferRange`, som tar en extra offset- och storleksparameter – så kan du binda bara ett visst intervall
av uniform buffern till en binding point. Med `glBindBufferRange` kan du koppla flera olika uniform blocks till ett och
samma uniform buffer object (offseten måste då vara multiplar av `GL_UNIFORM_BUFFER_OFFSET_ALIGNMENT`).

Nu när allt är förberett kan vi börja lägga in data i uniform buffern. Vi kan lägga in all data som en enda bytearray,
eller uppdatera delar av bufferten när vi vill med `glBufferSubData`. För att uppdatera uniform-variabeln `boolean`
kan vi uppdatera uniform buffer objectet så här:

```cpp
glBindBuffer(GL_UNIFORM_BUFFER, uboExampleBlock);
int b = true; // bools in GLSL are represented as 4 bytes, so we store it in an integer
glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b);
glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Och samma procedur gäller för alla andra uniform-variabler i uniform blocket, men med andra intervallargument.
:::
:::vulkan
Allt som OpenGL gör med binding points gör Vulkan med descriptors – delarna känner du igen från vulkan-tutorial:

- **Binding pointen** är blockets `layout(binding = 0)` (i descriptor set 0, standardvärdet för `set`), deklarerad i
  shadern – som OpenGL 4.2:s `layout(std140, binding = 2)`. Det finns inget `glUniformBlockBinding` att anropa.
- **Bindningens typ** deklareras i descriptor set-layouten: `uboLayoutBinding` med `binding = 0`,
  `VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER` och `stageFlags = VK_SHADER_STAGE_VERTEX_BIT`.
- **`glBindBufferRange`** är descriptorns `VkDescriptorBufferInfo` – bufferten, en offset och ett intervall:

```cpp
        VkDescriptorBufferInfo bufferInfo{};
        bufferInfo.buffer = uniformBuffer;
        bufferInfo.offset = 0;
        bufferInfo.range = sizeof(UniformBufferObject);
```

  inskriven i setet med `vkUpdateDescriptorSets`. Som i OpenGL kan flera block använda intervall av en och samma buffer;
  offseten måste då vara multiplar av enhetsgränsen `minUniformBufferOffsetAlignment`.
- **Att binda bufferten för ritning** är `vkCmdBindDescriptorSets`.
- **Att uppdatera datan** är det förra kapitlet visade: skriv till det mappade minnet (`memcpy` till
  `uniformBufferMapped`, som `updateUniformBuffer()` gör varje frame) eller spela in `vkCmdUpdateBuffer`. Att
  uppdatera en medlem betyder att skriva dess byte på dess std140-offset – OpenGL:s
  `glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b)`.
:::
:::d3d12
Allt som OpenGL gör med binding points gör Direct3D 12 med register, root signaturen och vyer – delarna känner du igen
från kapitlet *Coordinate systems*:

- **Binding pointen** är registret i shadern: `cbuffer SceneConstantBuffer : register(b1)` – som OpenGL 4.2:s
  `layout(std140, binding = 2)`. Det finns inget `glUniformBlockBinding` att anropa.
- **Vilken buffer som matar registret** avgörs av root signaturen: root parameter 1 är en descriptor table med ett
  CBV-intervall för register `b1` (`ranges[0].Init(D3D12_DESCRIPTOR_RANGE_TYPE_CBV, 1, 1)`).
- **`glBindBufferRange`** är constant buffer viewn: `D3D12_CONSTANT_BUFFER_VIEW_DESC` med en `BufferLocation`
  (bufferns GPU-adress plus en offset) och en `SizeInBytes` – båda multiplar av 256. `CreateConstantBufferView` lägger
  vyn i descriptor heapen, och `SetGraphicsRootDescriptorTable(1, …)` pekar root parameter 1 på den.
- **Att uppdatera datan** är en `memcpy` till den ständigt mappade upload buffern, som `OnUpdate` gör varje frame. Att
  uppdatera en medlem betyder att skriva dess byte på dess offset – OpenGL:s
  `glBufferSubData(GL_UNIFORM_BUFFER, 144, 4, &b)`.
:::

## A simple example

Låt oss då visa ett riktigt exempel på uniform buffer objects. Om vi ser tillbaka på alla tidigare kodexempel har vi
hela tiden använt 3 matriser: projektions-, vy- och modellmatrisen. Av dem är det bara modellmatrisen som ändras ofta.
Om vi har flera shaders som använder samma uppsättning matriser gör vi nog bäst i att använda uniform buffer objects.

Vi lagrar projektions- och vymatrisen i ett uniform block som heter `Matrices`. Modellmatrisen lagrar vi inte där,
eftersom den brukar ändras ofta mellan shaders, så vi skulle inte riktigt ha nytta av uniform buffer objects för den.

learnopengls demo ritar fyra kuber, var och en med eget shaderprogram och egen färg: röd uppe till vänster, grön uppe
till höger, gul nere till vänster, blå nere till höger – alla delar på en buffer med projektionen och vyn.

:::opengl
Gör nu den sista uppgiften, **uniform-buffer**. Den ersätter scenen: golvet, texturerna och face culling försvinner. I
`uniform_buffer.vs` blir de två vanliga uniforms ett uniform block (`model` förblir en vanlig uniform):

```glsl
layout (std140) uniform Matrices
{
    mat4 projection; // offset 0
    mat4 view;       // offset 64 (sizeof(glm::mat4))
};
```

I `main.cpp` ersätter fyra shaderprogram `shader`, alla med samma vertex shader:

```cpp
    Shader shaderRed("uniform_buffer.vs", "red.fs");
    Shader shaderGreen("uniform_buffer.vs", "green.fs");
    Shader shaderBlue("uniform_buffer.vs", "blue.fs");
    Shader shaderYellow("uniform_buffer.vs", "yellow.fs");
```

Det första vi vill göra är att koppla vertex shadrarnas uniform block till binding point 0. Observera att vi måste
göra det för varje shader:

```cpp
    unsigned int uniformBlockIndexRed = glGetUniformBlockIndex(shaderRed.ID, "Matrices");
    unsigned int uniformBlockIndexGreen = glGetUniformBlockIndex(shaderGreen.ID, "Matrices");
    unsigned int uniformBlockIndexBlue = glGetUniformBlockIndex(shaderBlue.ID, "Matrices");
    unsigned int uniformBlockIndexYellow = glGetUniformBlockIndex(shaderYellow.ID, "Matrices");
    // then we link each shader's uniform block to this uniform binding point
    glUniformBlockBinding(shaderRed.ID, uniformBlockIndexRed, 0);
    glUniformBlockBinding(shaderGreen.ID, uniformBlockIndexGreen, 0);
    glUniformBlockBinding(shaderBlue.ID, uniformBlockIndexBlue, 0);
    glUniformBlockBinding(shaderYellow.ID, uniformBlockIndexYellow, 0);
```

Sedan skapar vi själva uniform buffer objectet och binder bufferten till binding point 0:

```cpp
    unsigned int uboMatrices;
    glGenBuffers(1, &uboMatrices);
    glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
    glBufferData(GL_UNIFORM_BUFFER, 2 * sizeof(glm::mat4), NULL, GL_STATIC_DRAW);
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
    // define the range of the buffer that links to a uniform binding point
    glBindBufferRange(GL_UNIFORM_BUFFER, 0, uboMatrices, 0, 2 * sizeof(glm::mat4));
```

Först allokerar vi tillräckligt med minne för bufferten, vilket är 2 gånger storleken på `glm::mat4`. Storleken på
GLM:s matristyper motsvarar direkt `mat4` i GLSL. Sedan kopplar vi ett visst intervall av bufferten, i det här fallet
hela bufferten, till binding point 0.

Nu återstår bara att fylla bufferten. Om vi håller projektionsmatrisens synfält konstant (alltså ingen kamerazoom
längre) behöver vi bara uppdatera den en gång i programmet – och då behöver vi också bara lägga in den i bufferten en
gång. Eftersom vi redan har allokerat tillräckligt med minne i buffer-objektet kan vi använda `glBufferSubData` för att
lagra projektionsmatrisen innan vi går in i renderingsloopen:

```cpp
    glm::mat4 projection = glm::perspective(glm::radians(fov), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
    glBufferSubData(GL_UNIFORM_BUFFER, 0, sizeof(glm::mat4), glm::value_ptr(projection));
    glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Här lagrar vi projektionsmatrisen i uniform bufferns första halva. Sedan, innan vi ritar objekten varje frame,
uppdaterar vi bufferns andra halva med vymatrisen:

```cpp
        glm::mat4 view = glm::lookAt(cameraPos, cameraPos + cameraFront, cameraUp);
        glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
        glBufferSubData(GL_UNIFORM_BUFFER, sizeof(glm::mat4), sizeof(glm::mat4), glm::value_ptr(view));
        glBindBuffer(GL_UNIFORM_BUFFER, 0);
```

Och det var allt för uniform buffer objects. Varje vertex shader som innehåller ett `Matrices`-uniform block innehåller
nu datan som lagras i `uboMatrices`. Om vi nu ritar 4 kuber med 4 olika shaders ska alltså deras projektions- och
vymatris vara desamma:

```cpp
        glBindVertexArray(cubeVAO);
        shaderRed.use();
        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-0.75f, 0.75f, 0.0f)); // move top-left
        shaderRed.setMat4("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // ... draw Green Cube
        // ... draw Blue Cube
        // ... draw Yellow Cube
```

Den gröna kuben hamnar på (0.75, 0.75, 0), den gula på (-0.75, -0.75, 0) och den blå på (0.75, -0.75, 0). Den enda
uniform vi fortfarande måste sätta är `model`. Ta bort `planeVertices`, golvets VAO, de två `loadTexture`-anropen,
shaderkonfigurationen och face culling, och radera `uboMatrices` i slutet.
:::
:::vulkan
Gör nu den sista uppgiften, **uniform-buffer**. Den ersätter scenen med learnopengls demo. I
`shaders/uniform_buffer.vert` deklarerar du samma uniform block som i `advanced_glsl.vert` – samma block på samma
binding – och använder det:

```glsl
// one uniform buffer for all four pipelines (learnopengl's Matrices block): the same block, at the same binding
layout(binding = 0) uniform UniformBufferObject {
    mat4 view;
    mat4 proj;
} ubo;
```

```glsl
    gl_Position = ubo.proj * ubo.view * pc.model * vec4(inPosition, 1.0);
```

OpenGL:s fyra shaderprogram är fyra pipelines i Vulkan – en pipeline håller sina shaders. `graphicsPipeline` blir
`redPipeline`, `greenPipeline`, `bluePipeline` och `yellowPipeline`. Färgshadrarna läser bara positionen, så
`createPipeline` får en parameter `attributeCount` (`vertexAttributeDescriptionCount = attributeCount`) och de fyra
pipelinerna skickar 1:

```cpp
        // the shaders only read the position (1 attribute of a Vertex)
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/red.frag.spv", 1, redPipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/green.frag.spv", 1, greenPipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/blue.frag.spv", 1, bluePipeline);
        createPipeline("shaders/uniform_buffer.vert.spv", "shaders/yellow.frag.spv", 1, yellowPipeline);
```

Culling stängs av igen (`VK_CULL_MODE_NONE`), och golvets descriptor set behövs inte längre (poolen: 1 set, 1
uniform buffer-descriptor, 2 bild-descriptors). Förstör de fyra pipelinerna i `cleanup()`.

Nu kommer den del som OpenGL behöver `glUniformBlockBinding` och `glBindBufferRange` till. I Vulkan behövs inget extra:
alla fyra pipelines skapas med samma pipeline layout, och ett descriptor set som bundits med `vkCmdBindDescriptorSets`
förblir bundet när du byter till en annan pipeline med kompatibel layout. Så `recordCommandBuffer()` binder
`cubeDescriptorSet` – som håller uniform buffern på binding 0 – en gång, och byter sedan bara pipeline och skickar
modellmatriser:

```cpp
        // the set with the uniform buffer (binding 0), shared by the four pipelines (the colour shaders read no texture)
        vkCmdBindDescriptorSets(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipelineLayout, 0, 1, &cubeDescriptorSet, 0, nullptr);

        // RED
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, redPipeline);
        model = glm::translate(model, glm::vec3(-0.75f, 0.75f, 0.0f)); // move top-left
        constants.model = model;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
        vkCmdDraw(commandBuffer, 36, 1, 0, 0);
        // ... GREEN, YELLOW, BLUE
```

Den gröna kuben hamnar på (0.75, 0.75, 0), den gula på (-0.75, -0.75, 0) och den blå på (0.75, -0.75, 0), var och en
med sin egen pipeline. Ta bort det gamla `vkCmdBindPipeline` för `graphicsPipeline` efter `vkCmdBeginRenderPass`.
`updateUniformBuffer()` får vara som den är: den skriver vy och projektion en gång per frame, och alla fyra pipelines
läser dem.
:::
:::d3d12
Gör nu den sista uppgiften, **uniform-buffer**. Den ersätter scenen med learnopengls demo. `uniform_buffer.hlsl` är
färdig: den deklarerar `cbuffer SceneConstantBuffer : register(b1)` som `advanced_glsl.hlsl`, och dess `VSMain` läser
bara positionen:

```hlsl
float4 VSMain(float4 position : POSITION) : SV_POSITION
{
    return mul(mul(mul(position, model), view), projection);
}
```

OpenGL:s fyra shaderprogram är fyra pipeline states i Direct3D 12 – ett PSO håller sina shaders. Lägg till
medlemmarna `m_redPipelineState`, `m_greenPipelineState`, `m_bluePipelineState` och `m_yellowPipelineState`. Vid
TODO:n i `LoadAssets` kompilerar du vertex shadern en gång och återanvänder `psoDesc` för varje färg, där bara pixel
shadern byts:

```cpp
        ComPtr<ID3DBlob> uboVertexShader;
        ThrowIfFailed(D3DCompileFromFile(L"uniform_buffer.hlsl", nullptr, nullptr, "VSMain", "vs_5_0", compileFlags, 0, &uboVertexShader, nullptr));
        psoDesc.VS = CD3DX12_SHADER_BYTECODE(uboVertexShader.Get());
        psoDesc.RasterizerState.CullMode = D3D12_CULL_MODE_NONE;    // no face culling, like learnopengl's demo

        ComPtr<ID3DBlob> redPixelShader;
        ThrowIfFailed(D3DCompileFromFile(L"red.hlsl", nullptr, nullptr, "PSMain", "ps_5_0", compileFlags, 0, &redPixelShader, nullptr));
        psoDesc.PS = CD3DX12_SHADER_BYTECODE(redPixelShader.Get());
        ThrowIfFailed(m_device->CreateGraphicsPipelineState(&psoDesc, IID_PPV_ARGS(&m_redPipelineState)));

        // ... the same for green.hlsl, blue.hlsl and yellow.hlsl
```

Nu kommer den del som OpenGL behöver `glUniformBlockBinding` och `glBindBufferRange` till. I Direct3D 12 behövs inget
extra: alla fyra PSO:er använder samma root signature, och root-argument – som descriptor tablen för root parameter 1
med CBV:n – förblir satta när du byter PSO med `SetPipelineState`. Varje shader som deklarerar `register(b1)` läser den
enda constant buffern, som `OnUpdate` skriver en gång per frame. I `PopulateCommandList` ersätter de fyra kuberna
scenen:

```cpp
    // RED
    m_commandList->SetPipelineState(m_redPipelineState.Get());
    XMMATRIX model = XMMatrixTranslation(-0.75f, 0.75f, 0.0f);    // move top-left
    XMStoreFloat4x4(&modelConstants.model, XMMatrixTranspose(model));
    m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(ModelConstants) / 4, &modelConstants, 0);
    m_commandList->DrawInstanced(36, 1, 0, 0);
    // ... GREEN, YELLOW, BLUE
```

Den gröna kuben hamnar på (0.75, 0.75, 0), den gula på (-0.75, -0.75, 0) och den blå på (0.75, -0.75, 0), var och en
med sitt eget PSO. Scenens PSO förblir command listens starttillstånd, och texturtabellen förblir satt, fast de här
shadrarna inte läser någon textur.
:::

Bygg och kör: fyra enfärgade kuber – röd, grön, gul och blå – på den mörka bakgrunden, var och en ritad av en annan
shader, alla med samma vy och projektion.

```quiz
Hur ofta per frame skriver programmet vymatrisen i demot med fyra kuber?
- [ ] Fyra gånger: en gång för varje shader (eller pipeline)
- [x] En gång: varje shader läser den från samma buffer
- [ ] Aldrig: vymatrisen ligger i vertex shaderns kod
- [ ] En gång per vertex, i vertex shadern
---
Det är hela poängen med en delad uniform buffer: data som är densamma för varje shader skrivs en gång, och varje shader vars block är kopplat till bufferten ser den. Bara modellmatrisen sätts fortfarande per ritanrop.
```

Uniform buffer objects har flera fördelar jämfört med enskilda uniforms. För det första är det snabbare att sätta
många uniforms på en gång än att sätta flera uniforms en i taget. För det andra är det mycket enklare att ändra en
uniform en gång i en uniform buffer om du vill ändra samma uniform i flera shaders. En sista fördel, som inte syns
direkt, är att du kan använda betydligt fler uniforms i shaders med uniform buffer objects. OpenGL har en gräns för hur
mycket uniform-data det kan hantera, som kan efterfrågas med `GL_MAX_VERTEX_UNIFORM_COMPONENTS`. Med uniform buffer
objects är den gränsen mycket högre. Så när du når taket för antalet uniforms (till exempel vid skelettanimation)
finns alltid uniform buffer objects.

:::vulkan
I Vulkan avgör samma resonemang valet mellan de två sorters block du har: push constants är små (det garanterade
minimivärdet för `maxPushConstantsSize` är 128 byte) och passar för data per ritanrop som modellmatrisen; uniform
buffers rymmer mycket mer och delas mellan ritanrop.
:::
:::d3d12
I Direct3D 12 avgör samma resonemang valet mellan root constants och constant buffers: root signaturen är begränsad
till 64 DWORD totalt, så root constants passar för små data per ritanrop som modellmatrisen, medan en constant buffer
rymmer upp till 4096 `float4`-register och delas mellan ritanrop.
:::

## Additional resources

:::opengl
- [Interface Block (GLSL)](https://www.khronos.org/opengl/wiki/Interface_Block_(GLSL)): OpenGL-wikin om interface
  blocks, uniform blocks och deras layouter.
- [glUniformBlockBinding](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glUniformBlockBinding.xhtml) och
  [glBindBufferRange](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBindBufferRange.xhtml): de två sidorna
  av en binding point.
:::
:::vulkan
- [GL_KHR_vulkan_glsl](https://github.com/KhronosGroup/GLSL/blob/main/extensions/khr/GL_KHR_vulkan_glsl.txt): hur
  Vulkans GLSL skiljer sig från OpenGL:s (`gl_VertexIndex`, blocklayouter, locations).
- [Shader memory layout](https://docs.vulkan.org/guide/latest/shader_memory_layout.html): Vulkan Guide om std140,
  std430 och justering.
:::
:::d3d12
- [Semantics](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-semantics): HLSL:s
  system-value semantics (`SV_Position`, `SV_IsFrontFace`, `SV_Depth`, `SV_VertexID` …).
- [Packing rules for constant variables](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-packing-rules):
  hur HLSL lägger upp en constant buffer.
:::
