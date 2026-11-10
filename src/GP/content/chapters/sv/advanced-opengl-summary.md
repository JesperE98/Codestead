# Sammanfattning: Avancerad OpenGL

Grattis, du har nått slutet av delen *Avancerad OpenGL*. Du började med två marmorkuber på ett metallgolv och tittade
på djupbufferten bakom dem; sedan dess har du ritat konturer med stencilbufferten, gräs och fönster med alfa, hoppat
över ytorna som ingen ser, renderat scenen till en egen textur och efterbehandlat den, lagt en himmel runt den, fyllt
buffertar på nya sätt, delat uniforms mellan shaders, skapat geometri i en shader, ritat ett asteroidfält med ett enda
draw-anrop och jämnat ut taggiga kanter med multisampling. Den här sidan är en ordlista över delens viktigaste begrepp,
kapitel för kapitel, som de genomgångar learnopengl.com har i slutet av sina delar. Använd den för att slå upp saker,
och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet den kommer från.

Delen behåller learnopengls namn, men varje teknik i den finns i alla API:er. Begreppen utanför rutorna är desamma
överallt; rutorna visar hur {{api}} gör. En skillnad går genom hela delen: OpenGL håller inställningar som
djupfunktionen, stenciltestet, blending och culling i en global **tillståndsmaskin** som du ändrar med anrop som
`glEnable`, medan Vulkan och DirectX 12 bakar in dem i ett **pipeline-objekt** som du skapar i förväg och binder före
ritandet – en annan inställning betyder en annan pipeline. När du är klar kontrollerar provet i slutet av delen vad du
har lärt dig.

## Djuptestning

- **Djupbuffert** (z-buffert): en buffert lika stor som färgbufferten som lagrar ett djupvärde per pixel, oftast med
  24 eller 32 bitar.
- **Djuptest**: GPU:n jämför ett fragments djup med det lagrade; om testet lyckas ritas fragmentet och dess djup
  lagras, annars kastas det. Det körs efter fragment shadern och efter stenciltestet.
- **Tidig djuptestning** (early depth testing): en hårdvarufunktion som kör testet *före* fragment shadern, så att
  dolda fragment aldrig skuggas. Den fungerar bara om shadern inte skriver sitt eget djup.
- **Djupfunktion**: jämförelsen som testet använder – ALWAYS, NEVER, LESS (den vanliga: närmare än det lagrade
  djupet), EQUAL, LESS_OR_EQUAL, GREATER, NOT_EQUAL, GREATER_OR_EQUAL. Med ALWAYS vinner det fragment som ritas sist,
  som utan djuptest.
- **Skrivskyddad djupbuffert**: testet körs, men inget skrivs – djupets skrivmask.
- **Djupvärdenas precision**: projektionen gör det lagrade djupet proportionellt mot `1/z`:
  `F_depth = (1/z - 1/near) / (1/far - 1/near)`. Det mesta av intervallet går åt nära det främre planet: med
  near = 0.1 och far = 100 ligger ett djup på 0.5 bara 0.2 enheter från kameran.
- **Visualisera djupbufferten**: djupet som en gråton visar scenen nästan vit; att **linjärisera** det (invertera
  projektionens djupekvation) ger avståndet från kameran, delat med `far` för att visas.
- **Z-fighting**: två ytor så nära varandra att djupbufferten inte kan avgöra vilken som ligger framför – de flimrar.
  Förebyggande: låt aldrig ytor ligga tätt över varandra (en liten förskjutning), flytta ut det främre planet så långt
  som möjligt, använd fler djupbitar.

:::opengl
- **Tillstånd**: `glEnable(GL_DEPTH_TEST)`, `glDepthFunc(GL_LESS)` (standardvärdet), `glDepthMask(GL_FALSE)` för en
  skrivskyddad djupbuffert, `glClear(… | GL_DEPTH_BUFFER_BIT)` varje bildruta.
- **Djupbufferten**: skapas av GLFW tillsammans med fönstret, 24 bitar som standard (`GLFW_DEPTH_BITS`).
- **`gl_FragCoord`**: x och y är fönsterpositionen (origo nere till vänster), z är djupvärdet.
- **`LinearizeDepth`**: börjar med `depth * 2.0 - 1.0`, eftersom OpenGL:s NDC-z går från -1 till 1 och viewporten
  avbildar det på 0..1.
:::
:::vulkan
- **Tillstånd**: `VkPipelineDepthStencilStateCreateInfo` i varje pipeline: `depthTestEnable`, `depthWriteEnable`,
  `depthCompareOp = VK_COMPARE_OP_LESS`. En annan djupfunktion betyder en annan pipeline (eller dynamiskt tillstånd).
- **Djupbufferten**: din egen image, `VK_FORMAT_D32_SFLOAT`, render passens andra attachment; den rensas av sin
  `loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR` med `clearValues[1].depthStencil = {1.0f, 0}`.
- **`gl_FragCoord`**: origo uppe till vänster; z är djupvärdet.
- **Djup 0..1**: `GLM_FORCE_DEPTH_ZERO_TO_ONE` får NDC-z att gå från 0 till 1, så djupvärdet *är* NDC-z och
  `LinearizeDepth` är `near * far / (far - depth * (far - near))`, utan learnopengls `depth * 2.0 - 1.0`.
- **Omvänt z** (reversed z): med en flyttalsdjupbuffert sprider det precisionen nästan jämnt att avbilda near på 1
  och far på 0 (rensad till 0, funktionen GREATER).
:::
:::d3d12
- **Tillstånd**: PSO:ts `DepthStencilState`, med `CD3DX12_DEPTH_STENCIL_DESC(D3D12_DEFAULT)` som start (djuptest på,
  skrivning på, `D3D12_COMPARISON_FUNC_LESS`); `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO` för en skrivskyddad
  djupbuffert. En annan djupfunktion betyder ett annat PSO.
- **Djupbufferten**: din egen resurs, `m_depthStencil` (`DXGI_FORMAT_D32_FLOAT`), med en DSV som binds av
  `OMSetRenderTargets` och rensas med `ClearDepthStencilView`.
- **`SV_POSITION` i pixel shadern**: pixelns fönsterposition (origo uppe till vänster) och dess djup i z – GLSL:s
  `gl_FragCoord`.
- **Djup 0..1**: Direct3D:s NDC-z går från 0 till 1, så `LinearizeDepth` är `near * far / (far - depth * (far -
  near))`; `near` och `far` är `static const` (utan `static` vore de värden i en constant buffer).
- **Omvänt z** (reversed z): med en flyttalsdjupbuffert sprider det precisionen nästan jämnt att avbilda near på 1
  och far på 0 (rensad till 0, funktionen GREATER).
:::

## Stenciltestning

- **Stencilbuffert**: oftast 8 bitar per pixel (256 värden) som du skriver medan du ritar och testar mot senare.
- **Stenciltest**: körs efter fragment shadern och före djuptestet. Det jämför ett **referensvärde** med det lagrade
  värdet, båda först AND:ade med en **jämförelsemask**, med en testfunktion (samma åtta som djuptestets).
- **Stenciloperationer**: vad som händer med det lagrade värdet när stenciltestet misslyckas, när det lyckas men
  djuptestet misslyckas, och när båda lyckas – KEEP, ZERO, REPLACE (med referensvärdet), öka och minska (begränsat
  eller med wrap), INVERT.
- **Skrivmask**: AND:as med varje värde som skrivs; `0xFF` skriver som det är, `0x00` stänger av stencilskrivning.
- **Konturer runt föremål**: rita föremålen med funktionen ALWAYS, operationen REPLACE (referens 1) och skrivning på,
  så att stencilbufferten innehåller 1 där de syns; rita dem sedan uppskalade med 1.1 i en enda färg, med funktionen
  NOT_EQUAL 1, stencilskrivning av och djuptestet av – bara ringen utanför originalen klarar sig. Golvet ritas först
  och får inte skriva till stencilbufferten.

:::opengl
- **Tillstånd**: `glEnable(GL_STENCIL_TEST)`, `glStencilFunc(func, ref, mask)`, `glStencilOp(sfail, dpfail, dppass)` –
  här `GL_KEEP, GL_KEEP, GL_REPLACE` – och `glStencilMask(0xFF / 0x00)`.
- **Stencilbufferten**: GLFW:s standardfönster har 8 stencilbitar (`GLFW_STENCIL_BITS`); den rensas med
  `GL_STENCIL_BUFFER_BIT`.
- **Återställa tillstånd**: loopen slutar med `glStencilMask(0xFF)`, `glStencilFunc(GL_ALWAYS, 0, 0xFF)` och
  `glEnable(GL_DEPTH_TEST)`, eftersom tillståndet ligger kvar till nästa bildruta – och `glClear` lyder stencilmasken.
:::
:::vulkan
- **Stencilbufferten**: en del av djup-imagen – `VK_FORMAT_D32_SFLOAT_S8_UINT` eller `VK_FORMAT_D24_UNORM_S8_UINT`,
  en vy med `VK_IMAGE_ASPECT_DEPTH_BIT | VK_IMAGE_ASPECT_STENCIL_BIT`, rensad av `stencilLoadOp = CLEAR`.
- **Tillstånd**: `stencilTestEnable` och två `VkStencilOpState`, `front` och `back`, med `failOp`, `depthFailOp`,
  `passOp`, `compareOp`, `compareMask`, `writeMask` och `reference` – allt fast i pipelinen.
- **Tre pipelines**: `floorPipeline` (skrivmask 0x00), `graphicsPipeline` (ALWAYS, 0xFF) och `outlinePipeline`
  (NOT_EQUAL, 0x00, djuptest av). Inget behöver återställas: varje pipeline bär hela sitt tillstånd.
:::
:::d3d12
- **Stencilbufferten**: en del av djupbufferten – `DXGI_FORMAT_D24_UNORM_S8_UINT` i resursen, DSV:n, clear-värdet och
  PSO:ts `DSVFormat`; rensas med `D3D12_CLEAR_FLAG_STENCIL`.
- **Tillstånd**: `StencilEnable`, `StencilReadMask`, `StencilWriteMask` och två `D3D12_DEPTH_STENCILOP_DESC`,
  `FrontFace` och `BackFace` (`StencilFailOp`, `StencilDepthFailOp`, `StencilPassOp`, `StencilFunc`).
- **Referensvärdet** ligger inte i PSO:t: `OMSetStencilRef(1)` sätter det på command listen.
- **Tre PSO:er**: `m_floorPipelineState`, `m_pipelineState` och `m_singleColorPipelineState`. Inget behöver
  återställas: varje PSO bär hela sitt tillstånd, `ClearDepthStencilView` bryr sig inte om skrivmasken, och `Reset`
  sätter tillbaka referensvärdet till 0.
:::

## Blending

- **Alfa**: färgens fjärde komponent, dess opacitet: 1.0 ogenomskinlig, 0.0 helt genomskinlig.
- **Kasta fragment**: för texturer som antingen är helt ogenomskinliga eller helt genomskinliga (gräset) kastar
  shadern fragment vars alfa ligger under en tröskel (`if (texColor.a < 0.1) discard;`). Ett kastat fragment skriver
  varken färg eller djup.
- **Clamp to edge**: genomskinliga texturer samplas med clamping, eftersom filtret vid överkanten med repeat blandar in
  den motsatta (ogenomskinliga) kanten och ritar en halvgenomskinlig linje.
- **Blending**: efter fragment shadern och testerna kombineras **källfärgen** (shaderns utdata) med **målfärgen** (den
  som redan finns i färgbufferten): `C_result = C_source * F_source + C_destination * F_destination`.
- **Alfablending**: `F_source` = källans alfa, `F_destination` = 1 − källans alfa. Ogenomskinliga ytor (alfa 1)
  behåller sin egen färg.
- **Blendoperation**: hur de två delarna kombineras – addera (det vanliga), subtrahera, omvänd subtraktion, min, max.
- **Genomskinlighet och djuptestet**: djuptestet vet inget om genomskinlighet; ett fönster som ritas först lagrar sitt
  djup, och fönster bakom det avvisas innan de kan blendas.
- **Bryt inte ordningen**: rita alla ogenomskinliga föremål först, sortera sedan de genomskinliga efter avståndet till
  kameran (en `std::map` med avståndet som nyckel) och rita dem från det bortersta till det närmaste (en omvänd
  iterator).

:::opengl
- **Tillstånd**: `glEnable(GL_BLEND)`, `glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)`; `glBlendFuncSeparate` för
  separata alfafaktorer, `glBlendEquation(GL_FUNC_ADD)` för operationen, `glBlendColor` för den konstanta färgen.
  Globalt: det gäller även de ogenomskinliga föremålen, vilket inte ändrar något för alfa 1.
- **Wrapping**: hör till texturen; `loadTexture` använder `GL_CLAMP_TO_EDGE` för RGBA-bilder.
:::
:::vulkan
- **Tillstånd**: pipelinens `VkPipelineColorBlendAttachmentState`: `blendEnable = VK_TRUE`,
  `srcColorBlendFactor = VK_BLEND_FACTOR_SRC_ALPHA`, `dstColorBlendFactor = VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA`,
  `colorBlendOp = VK_BLEND_OP_ADD`, och separata faktorer för alfa (alltid). Projektet ritar allt med en enda
  pipeline med blending.
- **Wrapping**: hör till samplern; gräset och fönstren använder `transparentSampler`
  (`VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE`).
:::
:::d3d12
- **Tillstånd**: PSO:ts `BlendState.RenderTarget[0]`: `BlendEnable = TRUE`, `SrcBlend = D3D12_BLEND_SRC_ALPHA`,
  `DestBlend = D3D12_BLEND_INV_SRC_ALPHA` ("ett minus" heter *INV*), `BlendOp = D3D12_BLEND_OP_ADD`, och samma för
  alfa. Den konstanta faktorn sätts med `OMSetBlendFactor`.
- **Ett andra PSO**: `m_transparentPipelineState` med pixel shadern `PSTransparent` (som kastar) och blending; kuberna
  och golvet behåller `m_pipelineState`.
- **Wrapping**: hör till samplern; en andra statisk sampler på `s1` clampar (`clampSampler`).
:::

## Face culling

- **Winding order**: ordningen som en triangels hörn går runt i – medurs eller moturs – sett på skärmen. Sett från
  andra sidan går samma hörn runt åt andra hållet.
- **Fram- och baksidor**: enligt konvention är en sluten modells trianglar moturs sett utifrån; rastreraren avgör
  efter vertex shadern, utifrån windingen på skärmen, om en triangel vänder sig mot kameran.
- **Face culling**: baksidor kastas före rastreringen, så fragment shadern körs aldrig för dem – mer än hälften av
  fragmentarbetet för ett slutet föremål sparas, med samma bild. Kastar man i stället framsidorna syns kubernas insidor.
- **Inte för öppna ytor**: enstaka quads som gräset måste synas från båda sidor, så de ritas utan culling.
  learnopengls golv fick ordnas om: det var medurs sett ovanifrån.
- **Kontroll med kryssprodukt**: (b − a) × (c − a) pekar ut ur modellen när a → b → c går moturs sett utifrån.

:::opengl
- **Tillstånd**: `glEnable(GL_CULL_FACE)`, `glCullFace(GL_BACK)` (eller `GL_FRONT`, `GL_FRONT_AND_BACK`),
  `glFrontFace(GL_CCW)` (eller `GL_CW`).
:::
:::vulkan
- **Tillstånd**: pipelinens rasteriseringstillstånd: `cullMode = VK_CULL_MODE_BACK_BIT` (eller `FRONT_BIT`, `NONE`,
  `FRONT_AND_BACK`) och `frontFace = VK_FRONT_FACE_COUNTER_CLOCKWISE`.
- **Varför moturs**: Vulkan bedömer windingen på den färdiga bilden; `proj[1][1] *= -1` håller den bilden rättvänd,
  så att trianglarna har OpenGL:s orientering.
:::
:::d3d12
- **Tillstånd**: PSO:ts rasterizer state: `CullMode = D3D12_CULL_MODE_BACK` (eller `FRONT`, `NONE` – det finns inget
  "båda") och `FrontCounterClockwise = TRUE`.
- **Varför moturs**: Direct3D:s standard är medurs, men de högerhänta `XMMatrixLookAtRH` och
  `XMMatrixPerspectiveFovRH` lägger varje triangel på skärmen som OpenGL gör.
:::

## Framebuffers

- **Framebuffer**: färg-, djup- och stencilbufferten som det ritas i, tillsammans. Fram till det här kapitlet var
  det alltid fönstrets.
- **Off-screen-rendering**: att rita i en egen framebuffer; inget syns i fönstret förrän du visar det.
- **Attachment**: en minnesplats (en bild) i en framebuffer. Om en shader ska läsa den senare är den en textur; om den
  bara skrivs och testas (oftast djup och stencil) kan den lagras på det sätt som är snabbast – OpenGL:s
  **renderbuffer**.
- **Rendera till en textur**: rita scenen i en egen färgtextur, byt tillbaka till fönstret och rita en **skärmquad** –
  två trianglar angivna i NDC, inga matriser, inget djuptest – texturerad med den.
- **Post-processing**: effekter på den färdiga bilden i skärmquadens shader: **invertering** (`1.0 - färg`),
  **gråskala** (viktad: 0.2126 rött, 0.7152 grönt, 0.0722 blått).
- **Kernel** (faltningsmatris): ett 3×3-rutnät med vikter för en pixel och dess åtta grannar, samplade med
  `offset = 1.0 / 300.0`. Skärpning (vikterna summerar till 1), oskärpa (`1 2 1 / 2 4 2 / 1 2 1`, delat med 16),
  kantdetektering (summa 0: enfärgade ytor blir svarta). Vid kanten avgör samplerns wrapping vilka grannarna är.

:::opengl
- **Framebuffer object**: `glGenFramebuffers`, `glBindFramebuffer(GL_FRAMEBUFFER, framebuffer)`; att binda `0` går
  tillbaka till fönstrets **default framebuffer**. `GL_READ_FRAMEBUFFER` och `GL_DRAW_FRAMEBUFFER` binder den för en
  riktning.
- **Attachments**: `glTexImage2D(…, NULL)` och `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
  GL_TEXTURE_2D, textureColorbuffer, 0)`; en renderbuffer med `glRenderbufferStorage(GL_RENDERBUFFER,
  GL_DEPTH24_STENCIL8, …)` och `glFramebufferRenderbuffer(…, GL_DEPTH_STENCIL_ATTACHMENT, …)`.
- **Fullständighet**: `glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE`.
- **Loopen**: bind framebuffern och `glEnable(GL_DEPTH_TEST)`, rita scenen, bind 0, `glDisable(GL_DEPTH_TEST)`, rita
  quaden med `screenShader`.
:::
:::vulkan
- **Tre delar**: images (attachments), en render pass som beskriver dem, och en `VkFramebuffer` som namnger vyerna för
  den – `offscreenRenderPass` och `offscreenFramebuffer`.
- **Usage-flaggor**: färg-imagen är `VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT`; en djup-image
  med bara `DEPTH_STENCIL_ATTACHMENT` motsvarar renderbuffern.
- **Läsbar efteråt**: färg-attachmentens `finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL`, och ett subpass
  dependency till `VK_SUBPASS_EXTERNAL` får nästa fragment shaders att vänta på färgskrivningarna.
- **Pipelines per render pass**: en pipeline görs för en render pass (eller en kompatibel), så skärmquaden får
  `screenPipeline` för fönstrets `renderPass`, utan djuptest. Två render passes i en command buffer ersätter "bind en
  framebuffer, rita, bind standard-framebuffern, rita".
:::
:::d3d12
- **Inget framebuffer object**: en textur skapad med `D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET`, en RTV för att rita i
  den och en SRV för att läsa den; `OMSetRenderTargets` är det som ligger närmast `glBindFramebuffer`.
- **Resurstillstånd**: en transition barrier gör `m_offscreenTarget` till `RENDER_TARGET` från `PIXEL_SHADER_RESOURCE`
  för scenen och tillbaka för skärmquaden – och får läsningarna att vänta på skrivningarna.
- **Format**: texturen har back bufferns format, så scenens PSO kan rita i den; quadens PSO har
  `DSVFormat = DXGI_FORMAT_UNKNOWN` och `DepthEnable = FALSE`, eftersom dess pass inte binder någon djupbuffert.
- **Renderbuffer**: den befintliga djupbufferten, som saknar SRV, spelar den rollen.
:::

## Cubemaps

- **Cube map**: sex kvadratiska 2D-texturer som bildar en kubs sidor, samplade med en **riktning** från kubens mitt;
  riktningens längd spelar ingen roll. Sidorna kommer i ordningen +X, -X, +Y, -Y, +Z, -Z.
- **Clamp to edge**: cube maps samplas med clamping, så att riktningar mellan två sidor ändå får kantvärden.
- **Skybox**: en kub runt kameran med en cube map av omgivningen; dess vertexpositioner är riktningarna den samplas
  med.
- **View utan translation**: skyboxen använder bara rotationen i view-matrisen (`mat4(mat3(view))`), så att kameran kan
  vrida sig men aldrig kommer närmare himlen.
- **Ritad först**: med djupskrivning av, så att allt som ritas senare täcker den.
- **En optimering – ritad sist**: vertex shadern sätter `gl_Position = pos.xyww`, så att djupet efter
  perspektivdivisionen blir 1.0; med djupfunktionen LESS_OR_EQUAL klarar sig himlen bara där inget har ritats, och
  tidig djuptestning hoppar över dess fragment shader överallt annars.
- **Environment mapping**: **reflektion** samplar cube mapen med `R = reflect(I, normalize(Normal))`, där `I` är
  riktningen från kameran till fragmentet i world space; **refraktion** använder `refract(I, N, 1.00 / 1.52)`,
  förhållandet mellan brytningsindexen (luft till glas).
- **Dynamisk environment map**: en cube map som renderas varje bildruta från föremålets position, sex gånger med 90°
  synfält, så att reflektionen även visar de andra föremålen.

:::opengl
- **Skapa den**: `glBindTexture(GL_TEXTURE_CUBE_MAP, …)` och `glTexImage2D` sex gånger med targets
  `GL_TEXTURE_CUBE_MAP_POSITIVE_X + i`; `GL_TEXTURE_WRAP_S/T/R` satta till `GL_CLAMP_TO_EDGE`.
- **Ladda sidorna**: `stbi_set_flip_vertically_on_load(false)` – cube map-sidor börjar med sin översta rad.
- **I GLSL**: `samplerCube` samplad med en `vec3`.
- **Skyboxens tillstånd**: ritad först mellan `glDepthMask(GL_FALSE)` och `glDepthMask(GL_TRUE)`; ritad sist mellan
  `glDepthFunc(GL_LEQUAL)` och `glDepthFunc(GL_LESS)`.
:::
:::vulkan
- **Skapa den**: en 2D-image med 6 array layers och `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, läst via en vy av typen
  `VK_IMAGE_VIEW_TYPE_CUBE`; layer i är sida i. Descriptorn är fortfarande en combined image sampler.
- **I GLSL**: `samplerCube` samplad med en `vec3`.
- **Skyboxens tillstånd**: en egen `skyboxPipeline` – först med `depthWriteEnable = VK_FALSE`, sedan med
  `VK_COMPARE_OP_LESS_OR_EQUAL` och ritad sist; kubernas pipeline behåller LESS. Vertex shadern tar själv bort
  translationen, `mat4(mat3(ubo.view))`.
- **Reflektion**: `cameraPos` följer `proj` i uniform buffern (offset 128), som nu även är synlig för fragmentsteget.
:::
:::d3d12
- **Skapa den**: en 2D-textur med `DepthOrArraySize = 6` och en SRV med `D3D12_SRV_DIMENSION_TEXTURECUBE`; slice i är
  sida i. En andra statisk sampler på `s1` clampar.
- **I HLSL**: `TextureCube`, vars `Sample` tar en `float3`.
- **Skyboxens tillstånd**: ett eget `m_skyboxPipelineState` – först med `DepthWriteMask = D3D12_DEPTH_WRITE_MASK_ZERO`,
  sedan med `D3D12_COMPARISON_FUNC_LESS_EQUAL` och ritad sist. Vertex shadern tar bort translationen med
  `(float3x3)view` och returnerar `pos.xyww`.
- **Reflektion**: normalmatrisen beräknas på CPU:n och skickas med model-matrisen; `cameraPos` följer `projection` i
  constant buffern, som nu är synlig för alla steg.
:::

## Advanced Data

- **Buffert**: en bit GPU-minne; vad den används till avgörs av hur du binder eller beskriver den.
- **Fylla i delar**: reservera minnet först och skriv sedan ett intervall vid en offset, eller hämta en pekare till
  minnet och skriv genom den (**mappning**).
- **Interleaved eller batchat**: interleaved lägger alla attribut för en vertex tillsammans (123123…), batchat lägger varje
  attributs array i ett eget block (111…222…). Batchat är ett attributs **stride** dess egen storlek och dess
  **offset** platsen där blocket börjar – för 36 positioner med 3 floats börjar texturkoordinaterna på byte 432.
- **Kopiera buffertar**: en kopia från en buffert till en annan körs på GPU:n; datan kommer aldrig tillbaka till
  programmet.
- **Staging**: CPU:n skriver i minne den kan nå, GPU:n kopierar det till minne som är snabbast för GPU:n att läsa.
- **Bilden ändras aldrig**: kapitlets uppgifter ändrar bara hur datan kommer in i buffertarna.

:::opengl
- **Fylla**: `glBufferData(…, NULL, …)` reserverar minne; `glBufferSubData(target, offset, size, data)` fyller ett
  intervall; `glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY)` returnerar en pekare, `glUnmapBuffer` avslutar den.
- **Batchade attribut**: `glVertexAttribPointer` med stride för ett attribut (`2 * sizeof(float)`) och blockets offset
  (`(void*)(sizeof(cubePositions))`).
- **Kopiera**: `glCopyBufferSubData(readtarget, writetarget, readoffset, writeoffset, size)`, med targets
  `GL_COPY_READ_BUFFER` och `GL_COPY_WRITE_BUFFER` så att två buffertar kan vara bundna samtidigt.
:::
:::vulkan
- **Fylla**: `vkMapMemory` mappar ett intervall (offset och storlek) av host-visible minne; en mappning åt gången; med
  `HOST_COHERENT`-minne behövs ingen flush. `vkCmdUpdateBuffer` spelar in en liten uppdatering (högst 65536 byte,
  utanför en render pass, i en `TRANSFER_DST`-buffert), följd av en barrier.
- **Batchade attribut**: en binding har en enda stride, så två block behöver två bindings; `vkCmdBindVertexBuffers`
  ger varje binding offseten för sitt block.
- **Kopiera**: `vkCmdCopyBuffer` med `VkBufferCopy`-regioner (källoffset, måloffset, storlek): staging buffern kopieras
  till en device-local vertex buffer.
:::
:::d3d12
- **Heaps**: en upload heap kan mappas av CPU:n, en default heap är bara för GPU:n och snabbast för den.
- **Fylla**: `Map` (ett läsintervall på `(0, 0)` lovar att inte läsa), `memcpy`, `Unmap`.
- **Batchade attribut**: en vertex buffer view har en enda stride, så två block behöver två input slots med var sin
  vy.
- **Kopiera**: `CopyBufferRegion(dst, dstOffset, src, srcOffset, numBytes)`; kopieringen befordrar målet från `COMMON`
  till `COPY_DEST`, och en barrier gör det till `VERTEX_AND_CONSTANT_BUFFER`. Vertex buffern flyttar in i en default
  heap, fylld från en upload-buffert.
:::

## Advanced GLSL

- **Inbyggda variabler**: värden som shaderspråket tillhandahåller: vertex shaderns positionsutdata,
  **punktstorleken**, **vertex-ID:t**, fragmentets fönsterkoordinater och djup (`gl_FragCoord`), om det hör till en
  **framsida**, och dess skrivbara **djup**.
- **Fönsterkoordinater**: ett fragments x och y är pixelns mitt, t.ex. 0.5 för första kolumnen; att jämföra x med 400
  delar det 800 pixlar breda fönstret i två.
- **Framsida eller baksida**: talar om för fragment shadern om dess triangel är en fram- eller baksida – enligt samma
  regel som culling; med framsidorna bortkastade ritas bara baksidor (kubernas insidor).
- **Skriva djupet**: stänger av tidig djuptestning; *conservative depth* (ett löfte att bara göra djupet större eller
  mindre) behåller en del av den.
- **Interface blocks**: ett stegs utdata och nästa stegs indata grupperade som en struct.
- **Uniform buffer objects**: uniforms som många shaders delar – projektionen och view – lagrade en gång i en
  buffert.
- **std140-layout**: standardiserade offsets: skalärer 4 byte, en `vec3` eller `vec4` justerad till 16, varje
  arrayelement och varje matriskolumn 16 byte, structar utfyllda till 16. En `vec3` efter en `float` börjar på byte 16.
- **Exemplet**: fyra kuber med fyra shaderprogram (röd, grön, gul, blå) delar en buffert med projektionen och view;
  bara model-matrisen sätts per kub.

:::opengl
- **Inbyggda**: `gl_PointSize` (med `glEnable(GL_PROGRAM_POINT_SIZE)`), `gl_VertexID`, `gl_FragCoord` (origo nere till
  vänster: pixeln uppe till vänster är (0.5, 599.5)), `gl_FrontFacing`, `gl_FragDepth`; `layout (depth_greater)` kräver
  OpenGL 4.2.
- **Interface blocks**: `out VS_OUT { vec2 TexCoords; } vs_out;` och `in VS_OUT { … } fs_in;` – matchas på
  blocknamnet.
- **Uniform blocks**: `layout (std140) uniform Matrices { … };` (standardlayouterna *shared* och *packed* måste
  frågas efter); `glUniformBlockBinding` med `glGetUniformBlockIndex` kopplar ett block till en binding point,
  `glBindBufferBase` / `glBindBufferRange` kopplar bufferten; `glBufferSubData` skriver projektionen en gång och view
  varje bildruta.
:::
:::vulkan
- **Inbyggda**: `gl_PointSize` måste skrivas för en point list; `gl_VertexIndex` och `gl_InstanceIndex` (OpenGL:s
  `gl_VertexID`, `gl_InstanceID`); `gl_FragCoord` med origo uppe till vänster; `gl_FrontFacing`, `gl_FragDepth` och
  djupvillkoren.
- **Interface blocks**: matchas på `location`, så blocket får `layout(location = 0)`.
- **Uniform blocks**: varje uniform ligger i ett block – std140 som standard, push constants std430. Binding pointen är
  `layout(binding = 0)`, buffertintervallet en `VkDescriptorBufferInfo`, bindningen `vkCmdBindDescriptorSets`;
  C++-medlemmar kan behöva `alignas(16)`.
- **Fyra pipelines**: med samma pipeline layout förblir descriptor seten bunden när pipelinen byts.
:::
:::d3d12
- **System-value-semantik**: `SV_VertexID`, `SV_InstanceID`, `SV_POSITION` (i pixel shadern: origo uppe till
  vänster), `SV_IsFrontFace`, `SV_Depth`, och `SV_DepthGreaterEqual` / `SV_DepthLessEqual` för conservative depth. Det
  finns ingen punktstorlek: en punkt är alltid en pixel.
- **Interface blocks**: structen som vertex shadern returnerar och pixel shadern tar emot; stegen matchas på semantik.
- **Constant buffers**: `cbuffer … : register(b1)` är ett uniform block. HLSL packar i register om 16 byte och flyttar
  bara en variabel som skulle gå över en gräns, så en `float3` efter en `float` börjar på byte 4. En CBV är en multipel
  av 256 byte, och matriser transponeras eftersom HLSL läser dem kolumn för kolumn.
- **Fyra PSO:er**: med samma root signature ligger root-argumenten kvar när PSO:t byts.
:::

## Geometry Shader

- **Geometry shader**: ett valfritt steg mellan vertex och fragment shadern. Den får en hel primitiv – en punkt, en
  linje eller en triangel, med alla dess vertices – och skickar ut nya primitiver: punkter, line strips eller triangle
  strips, upp till ett deklarerat högsta antal vertices.
- **Skicka ut**: varje utgående vertex får sin position (och utdata som en färg) och skickas ut; att avsluta
  primitiven börjar en ny strip.
- **Hus**: varje punkt blir en triangle strip med 5 vertices – 3 trianglar, två för väggarna och en för taket. Att ge
  den sista vertexen färgen vit får taket att tona över till vitt i toppen: utdata interpoleras.
- **Exploderande föremål**: varje triangel flyttas längs sin ytnormal (den normaliserade kryssprodukten av två kanter)
  med `(sin(time) + 1) / 2 * 2.0`. learnopengl gör det i clip space.
- **Visualisera normalvektorer**: rita modellen som vanligt, och sedan en gång till med en geometry shader som skickar
  ut en kort linje (längd 0.2) längs varje vertex normal – ett bra sätt att kontrollera normaler.

:::opengl
- **Program**: Shader-klassen tar en valfri tredje fil, kompilerad som `GL_GEOMETRY_SHADER` och fäst före länkningen.
- **GLSL**: `layout (points) in;`, `layout (triangle_strip, max_vertices = 5) out;`, de inkommande vertices i
  `gl_in[]`, `EmitVertex()` och `EndPrimitive()`; vertex shaderns utdata kommer som en array av interface blocks,
  `in VS_OUT { vec3 color; } gs_in[];`.
:::
:::vulkan
- **Pipeline**: device-funktionen `geometryShader` måste slås på, och `.geom`-modulen är ett shadersteg till,
  `VK_SHADER_STAGE_GEOMETRY_BIT` (valfritt per pipeline).
- **GLSL**: som i OpenGL (`gl_in[]`, `EmitVertex()`, `EndPrimitive()`), med `layout(location = …)` på interface
  blocks; uniform bufferns binding får geometristeget i sina `stageFlags`.
- **Vulkans y pekar nedåt**: y-förskjutningarna är negerade, så att husen ser likadana ut, och ytnormalen är
  `cross(b, a)`, eftersom projektionens y-vändning speglar clip space.
- **Punkter**: en point list kräver `gl_PointSize` i vertex shadern.
:::
:::d3d12
- **HLSL**: `[maxvertexcount(5)]`, den inkommande primitiven som parameter (`point VSOutput input[1]`,
  `triangle VSOutput input[3]`) och en utdataström (`inout PointStream<…>`, `LineStream<…>`,
  `TriangleStream<…>`) med `Append` och `RestartStrip` – GLSL:s `EmitVertex` och `EndPrimitive`.
- **PSO**: kompilerad med target `gs_5_0` och satt som `psoDesc.GS`; `PrimitiveTopologyType` anger geometry shaderns
  inkommande primitiv. CBV:ns root-parameter är synlig för alla steg.
:::

## Instancing

- **Instancing**: att rita många kopior (instanser) av samma mesh med ett enda draw-anrop; vertex shadern får
  instansens nummer och väljer den instansens data.
- **Varför**: varje draw-anrop kostar CPU-tid – drivrutinen förbereder och skickar kommandon till GPU:n – så tusentals
  små draw-anrop låter GPU:n vänta på CPU:n. Ett instansierat draw-anrop skickar meshen en gång.
- **Data per instans i en array**: 100 förskjutningar i en uniform-array, indexerad med instansnumret.
- **Instanced arrays**: ett vertexattribut som går vidare en gång per instans i stället för en gång per vertex –
  utan storleksgränsen för en uniform-array.
- **Heltalsdivision**: att skala med `gl_InstanceID / 100.0` kräver `.0`; `/ 100` skulle ge 0.
- **Asteroidfält**: 500 stenar i en ring (radie 15) runt planeten, var och en med en model-matris som beräknas en gång
  på CPU:n (`srand(42)`: samma fält varje körning), lagrad som ett **mat4-attribut** per instans. Ett vertexattribut har
  högst fyra komponenter, så matrisen tar fyra attribut, ett per kolumn. learnopengl ritar 100 000 stenar – en riktig
  GPU klarar det lätt med instancing; kursen använder 500 eftersom dess simulator körs på CPU:n.

:::opengl
- **Rita**: `glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100)`, `glDrawElementsInstanced(…, amount)`; i shadern
  `gl_InstanceID`.
- **Uniform-array**: `uniform vec2 offsets[100];`, varje element satt med namn (`"offsets[" + std::to_string(i) + "]"`).
- **Instanced array**: `glVertexAttribDivisor(2, 1)` för `aOffset`; matrisen är `layout (location = 3) in mat4
  aInstanceMatrix;` över location 3–6, var och en med `glVertexAttribDivisor(…, 1)`.
:::
:::vulkan
- **Rita**: `vkCmdDraw(commandBuffer, 6, 100, 0, 0)`, `vkCmdDrawIndexed(…, amount, …)`; i shadern `gl_InstanceIndex`.
- **Uniform-array**: `vec4 offsets[100]` i uniform buffern – i std140 tar varje arrayelement 16 byte ändå.
- **Instanced array**: vertex binding 1 med `inputRate = VK_VERTEX_INPUT_RATE_INSTANCE`; matrisen är en `mat4` på
  location 4–7 (`Vertex` använder redan 0–3), fyra attribut med `VK_FORMAT_R32G32B32A32_SFLOAT`.
:::
:::d3d12
- **Rita**: `DrawInstanced(6, 100, 0, 0)`, `DrawIndexedInstanced(…, amount, …)`; i shadern `SV_InstanceID`.
- **Array i en constant buffer**: `float4 offsets[100]` (varje arrayelement tar ett register om 16 byte), bunden som en
  root constant buffer view (`SetGraphicsRootConstantBufferView`).
- **Instanced array**: input elements med `D3D12_INPUT_CLASSIFICATION_PER_INSTANCE_DATA` och step rate 1 i input slot
  1; matrisen är fyra `INSTANCEMATRIX`-element som shadern sätter ihop igen, lagrad otransponerad.
:::

## Anti Aliasing

- **Aliasing**: taggiga kanter som trappsteg, eftersom varje pixel antingen ligger inuti en triangel eller inte.
- **SSAA** (super-sample anti-aliasing): rendera i högre upplösning och skala ner – jämnt, men varje pixel skuggas
  flera gånger.
- **MSAA** (multisample anti-aliasing): varje pixel har flera **samples** (här 4). Rastreraren kontrollerar vilka
  samples en triangel täcker; fragment shadern körs ändå **en gång** per pixel och triangel, och dess färg lagras i de
  täckta samplen. Djup och stencil testas per sample.
- **Resolve**: att medelvärdesbilda varje pixels samples till en färg – en kantpixel som täcks av 2 av 4 samples får
  hälften av triangelns färg och hälften av bakgrundens.
- **Off-screen-MSAA**: en multisamplad image kan inte samplas som en vanlig textur, så för post-processing resolvas den
  först till en vanlig bild; effekten arbetar sedan på den jämna bilden. (Att läsa samplen ett och ett, med
  `sampler2DMS` och `texelFetch`, är learnopengls "custom anti-aliasing algorithm".)
- **Scenen**: en enfärgat grön kub, vriden 30° så att dess kanter visar trappstegen.

:::opengl
- **MSAA i fönstret**: `glfwWindowHint(GLFW_SAMPLES, 4)` innan fönstret skapas, `glEnable(GL_MULTISAMPLE)`.
- **Off-screen**: `glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, …)` och `glRenderbufferStorageMultisample(…,
  4, GL_DEPTH24_STENCIL8, …)`; `glBlitFramebuffer(…, GL_COLOR_BUFFER_BIT, GL_NEAREST)` från den multisamplade
  framebuffern (`GL_READ_FRAMEBUFFER`) resolvar den till fönstret eller till `intermediateFBO`, vars textur
  skärmquaden samplar.
:::
:::vulkan
- **Ingen `GLFW_SAMPLES`**: antalet samples väljs med `getMaxUsableSampleCount()` (enhetens
  `framebufferColorSampleCounts & framebufferDepthSampleCounts`; här 4).
- **MSAA**: en multisamplad färg-image (`TRANSIENT_ATTACHMENT | COLOR_ATTACHMENT`), en djup-image med samma antal
  samples, `rasterizationSamples = msaaSamples` i pipelinen och en **resolve attachment** i subpassen
  (`pResolveAttachments`) – swap chain-imagen, eller en offscreen-image som skärmquaden samplar.
:::
:::d3d12
- **Inget multisamplat fönster**: en swap chain med flip model måste ha `SampleDesc.Count = 1`, så scenen ritas i ett
  multisamplat render target (`Tex2D(…, 1, 1, 4, 0, ALLOW_RENDER_TARGET)`), med en djupbuffert med samma antal samples
  (`D3D12_DSV_DIMENSION_TEXTURE2DMS`) och `psoDesc.SampleDesc.Count = 4`; `CheckFeatureSupport` med
  `D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS` kontrollerar stödet.
- **Resolve**: `ResolveSubresource` mellan barriers till `RESOLVE_SOURCE` och `RESOLVE_DEST` – till back buffern, eller
  till `m_screenTexture` för post-processing (quadens PSO har ett sample).
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Var inställningarna finns | globalt tillstånd (`glEnable`, …) | pipelinen | PSO:t |
| Djuptest och djupfunktion | `GL_DEPTH_TEST`, `glDepthFunc` | `depthTestEnable`, `depthCompareOp` | `DepthEnable`, `DepthFunc` |
| Skrivskyddat djup | `glDepthMask(GL_FALSE)` | `depthWriteEnable = VK_FALSE` | `D3D12_DEPTH_WRITE_MASK_ZERO` |
| Stenciltest | `glStencilFunc`, `glStencilOp`, `glStencilMask` | `front` / `back` `VkStencilOpState` | `FrontFace` / `BackFace`, masker, `OMSetStencilRef` |
| Blending | `glEnable(GL_BLEND)`, `glBlendFunc` | `VkPipelineColorBlendAttachmentState` | `BlendState.RenderTarget[0]` |
| Face culling | `glCullFace`, `glFrontFace` | `cullMode`, `frontFace` | `CullMode`, `FrontCounterClockwise` |
| Eget render target | framebuffer object | image + render pass + `VkFramebuffer` | resurs + RTV + SRV |
| Läsbart efteråt | sköts av drivrutinen | `finalLayout` + subpass dependency | transition barrier |
| Cube map | `GL_TEXTURE_CUBE_MAP` | 6 layers, `VK_IMAGE_VIEW_TYPE_CUBE` | 6 slices, `TEXTURECUBE`-SRV |
| Kopiera buffertar | `glCopyBufferSubData` | `vkCmdCopyBuffer` | `CopyBufferRegion` |
| Delade uniforms | uniform block, binding point | uniform block, descriptor | `cbuffer`, register |
| Geometry shader | `GL_GEOMETRY_SHADER` i programmet | funktionen `geometryShader`, geometristeg | `gs_5_0`, `psoDesc.GS` |
| Attribut per instans | `glVertexAttribDivisor` | `VK_VERTEX_INPUT_RATE_INSTANCE` | `PER_INSTANCE_DATA` |
| Instansnummer | `gl_InstanceID` | `gl_InstanceIndex` | `SV_InstanceID` |
| MSAA-resolve | `glBlitFramebuffer` (eller fönstret) | resolve attachment | `ResolveSubresource` |

Med den här delen klar kan du verktygen som resten av learnopengl.com bygger på: shadow maps är djuptexturer som
renderas off-screen, HDR och bloom är post-processing, och deferred shading renderar till flera
framebuffer-attachments på en gång.
