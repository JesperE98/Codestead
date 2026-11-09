# Sammanfattning: Kom igång

Grattis, du har nått slutet av delen *Kom igång*. Nu kan du öppna ett fönster, skriva shaders, skicka vertexdata och
värden till dem, lägga texturer på dina objekt, flytta runt dem med transformationsmatriser och gå runt i scenen med
en fri kamera. Det är många nya idéer, och många nya namn. Den här sidan är en ordlista över delens viktigaste
begrepp, kapitel för kapitel – samma sorts genomgång som learnopengl.com har i slutet av sin första del. Använd den
för att slå upp saker, och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet den kommer
från.

Begreppen utanför rutorna är desamma i alla API:er. Rutorna visar vad {{api}} kallar saker och hur det gör dem, där
de tre API:erna skiljer sig åt. När du är klar kontrollerar provet i slutet av delen vad du har lärt dig.

## {{api}} och fönstret

- **Grafik-API**: gränssnittet mellan ditt program och grafikdrivrutinen: de funktioner du anropar för att få upp
  något på skärmen. OpenGL, Vulkan och Direct3D 12 är tre sådana API:er; arbetet på GPU:n bakom dem är detsamma.
- **Fönster**: det är operativsystemet som äger fönstren, inte grafik-API:t, så ett fönster skapas för sig och
  kopplas sedan till API:t.
- **Renderingsloop**: loopen som håller programmet igång tills fönstret stängs: hantera inmatning, rendera en
  bildruta, visa den, hantera fönstrets händelser, och om igen.
- **Dubbelbuffring**: GPU:n ritar i en *back buffer* medan fönstret visar *front buffern*. När bildrutan är klar byts
  de två, så att du aldrig ser en halvritad bild.
- **Rensningsfärg**: färgen som varje pixel i back buffern får i början av en bildruta, innan något ritas.
- **Viewport**: den rektangel i fönstret som normaliserade enhetskoordinater avbildas på, i pixlar.

:::opengl
- **OpenGL**: en specifikation som säger vad varje funktion ska göra; grafikdrivrutinen implementerar den. Kursen
  använder version 3.3.
- **Core profile**: den moderna delen av OpenGL, utan de föråldrade funktionerna i *immediate mode*.
- **Tillståndsmaskin** och **kontext**: OpenGL är en stor samling tillstånd, *kontexten*. Tillståndsändrande
  funktioner som `glClearColor` ändrar det; tillståndsanvändande funktioner som `glClear` arbetar med det aktuella
  tillståndet.
- **Objekt**: samlingar av tillstånd (id:n av typen `unsigned int`) som du genererar, binder till ett mål,
  konfigurerar och använder.
- **Extensions**: ny funktionalitet som en drivrutin erbjuder före (eller utanför) kärnspecifikationen.
- **GLFW**: ett bibliotek som skapar fönstret och OpenGL-kontexten och rapporterar inmatning.
- **GLAD**: en loader som letar upp adresserna till OpenGL-funktionerna i drivrutinen när programmet körs
  (`gladLoadGLLoader`); utan den kraschar anrop till `gl…`-funktioner.
- **glViewport**: sätter viewporten; `framebuffer_size_callback` anropar den igen när fönstret ändrar storlek.
- **glfwSwapBuffers** visar den färdiga back buffern, och **glfwPollEvents** hanterar fönstrets händelser.
:::
:::vulkan
- **Vulkan**: ett *explicit* API: du skapar och hanterar nästan allt som en drivrutin gör åt dig i OpenGL – minne,
  synkronisering, i vilken ordning arbetet görs på GPU:n.
- **Instans** (`VkInstance`): kopplingen mellan ditt program och Vulkan-biblioteket.
- **Validation layers**: valfria lager som kontrollerar varje anrop efter misstag under utvecklingen och rapporterar
  dem via **debug messengern**. Vulkan självt gör nästan ingen felkontroll.
- **Fysisk enhet** (physical device): en GPU i datorn; **queue families** är de sorters köer den erbjuder (grafik,
  presentation, …).
- **Logisk enhet** (`VkDevice`) och **köer**: din koppling till den valda GPU:n, och köerna du skickar arbete till.
- **Window surface** (`VkSurfaceKHR`): kopplar Vulkan till GLFW-fönstret.
- **Swap chain**: en kö av bilder som visas i fönstret i tur och ordning – Vulkans dubbelbuffring. Dess inställningar
  är surface-formatet, presentationsläget och storleken (extent).
- **Image view**: beskriver hur en bild används (vilken del, vilket format); du behöver en per bild i swap chainen.
- **Render pass**: beskriver vilka attachments en bildruta renderar till och vad som händer med dem (rensas i början,
  sparas i slutet); **framebuffers** kopplar de faktiska image views till en render pass.
- **Command pool** och **command buffer**: kommandon *spelas in* i en command buffer och *skickas* till en kö;
  ingenting händer på GPU:n när du anropar en `vkCmd…`-funktion.
- **Semafor**: ordnar arbete på GPU:n (hämta bild → rendera → presentera) utan att blockera CPU:n.
- **Fence**: låter CPU:n vänta på GPU:n (`vkWaitForFences`), här tills den förra bildrutan är klar.
- **Viewport och scissor**: sätts under inspelningen (`vkCmdSetViewport`, `vkCmdSetScissor`), eftersom pipelinen
  anger dem som *dynamiskt tillstånd*.
:::
:::d3d12
- **Direct3D 12**: ett *explicit* API: du skapar och hanterar nästan allt som en drivrutin gör åt dig i OpenGL –
  minne, resursers tillstånd, i vilken ordning arbetet görs på GPU:n.
- **COM**, **ComPtr** och **HRESULT**: Direct3D-objekt är COM-objekt med referensräkning; `ComPtr` släpper dem
  automatiskt, och varje anrop returnerar ett `HRESULT` som `ThrowIfFailed` kontrollerar.
- **Win32-fönster**: fönstret skapas med Win32-API:t (en fönsterklass, `CreateWindowW`, en meddelandeloop och
  `WindowProc`).
- **DXGI-factory** och **adapter**: DXGI räknar upp GPU:erna (adaptrarna) och skapar swap chains.
- **Device** (`ID3D12Device`): skapar alla andra objekt. **Feature level** är den minsta uppsättning förmågor som
  GPU:n måste stödja.
- **Debug layer**: slås på innan devicen skapas; det kontrollerar varje anrop efter misstag under utvecklingen.
- **Command queue**, **command allocator** och **command list**: kommandon *spelas in* i en command list (minnet
  kommer från allokatorn) och körs när listan skickas till kön med `ExecuteCommandLists`.
- **Swap chain** och **back buffers**: buffertarna som visas i fönstret i tur och ordning – Direct3Ds
  dubbelbuffring. `Present` visar den färdiga.
- **Descriptor** och **descriptor heap**: en descriptor (här en *render target view*, RTV) beskriver en resurs för
  GPU:n; descriptors ligger i descriptor heaps (här en RTV-heap).
- **Resource barrier**: en resurs befinner sig i ett *tillstånd*; en övergångsbarriär byter det, till exempel en back
  buffer från `PRESENT` till `RENDER_TARGET` innan den ritas i och tillbaka igen före `Present`.
- **Fence**: ett 64-bitarsvärde som kön sätter när den når en `Signal`; CPU:n väntar på det, här tills den förra
  bildrutan är klar.
- **Viewport och scissor-rektangel**: sätts på command listen varje bildruta (`RSSetViewports`,
  `RSSetScissorRects`).
:::

## Hello Triangle

- **Grafikpipeline**: stegen som gör om 3D-koordinater till färgade pixlar: vertex shader, primitive assembly,
  rasterisering, fragment shader, tester och blending. Några är programmerbara (shaders), de andra har fast funktion
  och går bara att konfigurera.
- **Shader**: ett litet program som körs på GPU:n för ett steg i pipelinen.
- **Vertex**: en samling data per hörn i en form – hittills en position, senare också en färg, texturkoordinater och
  en normal. Varje sorts data är ett **vertexattribut**.
- **Vertex shader**: körs en gång per vertex och ger ut dess position i klipprummet.
- **Normaliserade enhetskoordinater (NDC)**: det lilla rum där x och y går från -1 till 1 efter vertex shadern; allt
  utanför klipps. Viewporten avbildar NDC på pixlar.
- **Primitiv**: formen som vertexarna bildar – här trianglar.
- **Rasterisering**: att ta reda på vilka pixlar en primitiv täcker och skapa ett **fragment** för varje.
- **Fragment shader** (i HLSL: **pixel shader**): körs en gång per fragment och ger ut dess färg.
- **Vertexbuffert**: GPU-minne som håller vertexdatan.
- **Stride** och **offset**: antalet byte från en vertex till nästa, och var ett attribut börjar inuti en vertex.
- **Indexbuffert** och **indexerad ritning**: en lista med vertexindex, så att vertexar som delas av flera trianglar
  bara lagras en gång (en rektangel: 4 vertexar och 6 index i stället för 6 vertexar).
- **Wireframe** och **back-face culling**: att bara rita trianglarnas kanter, och att hoppa över trianglar vars
  vertexar går åt andra hållet på skärmen.

:::opengl
- **Vertex buffer object (VBO)**: ett buffertobjekt bundet till `GL_ARRAY_BUFFER`; `glBufferData` kopierar in
  vertexarna i det.
- **glVertexAttribPointer**: talar om för OpenGL hur ett vertexattribut ska läsas (location, storlek, typ, stride,
  offset) ur den VBO som är bunden; `glEnableVertexAttribArray` slår på attributet.
- **Vertex array object (VAO)**: lagrar konfigurationen av vertexattributen och vilka buffertar den läser – bind VAO:n
  och du är redo att rita.
- **Element buffer object (EBO)**: OpenGL:s indexbuffert, bunden till `GL_ELEMENT_ARRAY_BUFFER` medan VAO:n är bunden,
  så att VAO:n kommer ihåg den.
- **Shaderobjekt** och **shaderprogram**: shaders kompileras när programmet körs (`glCompileShader`) och länkas till
  ett program (`glLinkProgram`) som `glUseProgram` aktiverar.
- **glDrawArrays** och **glDrawElements**: ritar direkt från vertexarna, eller via indexen.
- **glPolygonMode**: `GL_LINE` slår på wireframe-läget.
:::
:::vulkan
- **VkBuffer** och **VkDeviceMemory**: en buffert allokerar inte sitt eget minne; du allokerar minne av en lämplig typ
  (här host-visible, så att CPU:n kan mappa och fylla det) och binder det till bufferten.
- **Beskrivning av vertexindata**: en **binding description** (vilken buffert, stride, per vertex) och en
  **attribute description** per attribut (location, format, offset). De är en del av pipelinen.
- **SPIR-V**: bytekoden som Vulkan läser. GLSL kompileras till SPIR-V innan programmet körs (`glslc`) och läses in i
  en **shader module**.
- **Grafikpipeline** (`VkPipeline`): ett objekt med shaders och *alla* inställningar för den fasta funktionen
  (vertexindata, input assembly, rasterizer, multisampling, blending). För att ändra en inställning behöver du en
  annan pipeline.
- **Pipeline layout**: vad shaders får utifrån utöver vertexarna (descriptor set layouts, push constants).
- **Face culling**: rasterizerns `cullMode` och `frontFace`; Vulkans NDC har **y nedåt**.
- **vkCmdBindVertexBuffers**, **vkCmdBindIndexBuffer**, **vkCmdDraw** och **vkCmdDrawIndexed**: spelas in i command
  buffern inuti render passen.
:::
:::d3d12
- **Resurs** (`ID3D12Resource`) och **upload heap**: en buffert är en resurs; en *committed resource* i en upload
  heap är minne som CPU:n kan skriva till (`Map`) och GPU:n läsa.
- **Input layout**: en `D3D12_INPUT_ELEMENT_DESC` per attribut: ett **semantiskt** namn (`POSITION`, `COLOR`), ett
  format och en byte-offset. Den är en del av pipeline state.
- **Vertex buffer view** och **index buffer view**: var bufferten finns, hur stor den är, och stride (eller
  indexformatet); sätts med `IASetVertexBuffers` och `IASetIndexBuffer`.
- **HLSL** och **D3DCompileFromFile**: shaders skrivs i HLSL och kompileras när programmet körs (målen `vs_5_0` och
  `ps_5_0`) till bytekod.
- **Root signature**: vad shaders får utifrån utöver vertexarna; tom för den första triangeln.
- **Pipeline state object (PSO)**: ett objekt med shaders, input layout och *alla* inställningar för den fasta
  funktionen (rasterizer, blending, render targets format). För att ändra en inställning behöver du ett annat PSO.
- **DrawInstanced** och **DrawIndexedInstanced**: ritar direkt från vertexarna, eller via indexen.
:::

## Shaders

- **{{shaderLanguage}}**: språket dina shaders skrivs i, C-likt med vektor- och matristyper.
- **Vektorer** och **swizzling**: `vec2`…`vec4` (HLSL: `float2`…`float4`); komponenterna kan väljas ut och
  kombineras fritt, som i `color.rgb` eller `pos.xyxx`.
- **In- och utdata**: vad ett shadersteg tar emot och lämnar vidare. Vertex shaderns indata kommer från
  vertexbufferten; dess utdata blir fragment shaderns indata.
- **Interpolation**: rasteriseraren blandar vertex shaderns utdata över triangeln, så ett fragment mellan en röd och
  en grön vertex får en blandning av båda.
- **Värden från CPU:n**: värden som är desamma för varje vertex i ett draw-anrop (en färg, en tid, senare matriser) –
  OpenGL:s *uniforms*.

:::opengl
- **in / out**: en `out` i vertex shadern och en `in` i fragment shadern med samma namn och typ kopplas ihop när
  programmet länkas.
- **layout (location = n)**: ger ett vertexattribut dess location, det första argumentet till
  `glVertexAttribPointer`.
- **Uniform**: en global variabel i shaderprogrammet; den behåller sitt värde tills du ändrar det.
  `glGetUniformLocation` hittar den, `glUniform…` sätter den i det *aktiva* programmet. En uniform som inte används
  tas bort av kompilatorn (dess location är `-1`).
- **Shaderklass**: `Shader` (`shader_s.h`) läser shaderfilerna, kompilerar, länkar och kontrollerar dem, med `use()`
  och `setBool/setInt/setFloat`.
:::
:::vulkan
- **in / out**: kopplas ihop mellan stegen med sin **location**, inte med sina namn.
- **Push constants**: ett litet block med värden (minst 128 byte) som spelas in direkt i command buffern med
  `vkCmdPushConstants`; shadern deklarerar det med `layout(push_constant)`, pipeline layouten med en
  `VkPushConstantRange`.
- **Uniform buffer**: en buffert som shadern läser som ett `uniform`-block via en descriptor – det allmänna sättet för
  större värden (se *Koordinatsystem*).
- **Shaderfiler**: `shader.vert` och `shader.frag`, kompilerade till `vert.spv` och `frag.spv`, som `readFile` läser
  in.
:::
:::d3d12
- **Semantik**: in- och utdata kopplas ihop med sin semantik (`POSITION`, `COLOR`); semantik som börjar med `SV_` är
  *systemvärden*, som `SV_POSITION` (positionen i klipprummet) och `SV_TARGET` (färgen för render target 0).
- **cbuffer** och **register**: shadern läser värden från CPU:n som en constant buffer vid ett register: `b` för
  constant buffers, `t` för texturer, `s` för samplers.
- **Root constants**: 32-bitarsvärden som lagras i själva root signaturen (`InitAsConstants`) och sätts med
  `SetGraphicsRoot32BitConstants`; shadern ser dem som en `cbuffer`.
- **Root descriptors** och **descriptor tables**: de andra sorterna av root-parametrar, som hänvisar till resurser som
  constant buffers och texturer.
- **Ingångspunkter**: `VSMain` och `PSMain` i en fil, `shaders.hlsl`.
:::

## Texturer

- **Textur**: en bild som shaders kan läsa. Dess pixlar kallas **texlar**.
- **Texturkoordinater**: var på texturen en vertex ligger, från 0 till 1 på båda axlarna (*s*/*t* eller *u*/*v*); de
  interpoleras för varje fragment.
- **Sampling**: att läsa texturens färg vid en texturkoordinat.
- **Wrapping** (adresseringsläge): vad som händer med koordinater utanför 0..1: upprepa, upprepa speglat, klampa till
  kanten, eller klampa till en kantfärg.
- **Filtrering**: hur en texel väljs: **nearest** (den närmaste texeln, blockigt) eller **linear** (en blandning av
  de närliggande texlarna, mjukt). **Förstoringsfiltret** används när texturen ritas större än den är,
  **förminskningsfiltret** när den ritas mindre.
- **Mipmaps**: en kedja av allt mindre kopior av en textur, var och en hälften så stor som den förra, som används för
  förminskade texturer för att undvika artefakter och spara minnesbandbredd.
- **Sampler**: reglerna för hur en textur läses (filter, wrapping).
- **stb_image**: biblioteket som läser in bildfilerna.
- **mix** (HLSL: **lerp**): blandar två värden; `mix(a, b, 0.2)` är 80 % av `a` och 20 % av `b`.

:::opengl
- **Texturobjekt**: genereras, binds till `GL_TEXTURE_2D`, konfigureras med `glTexParameteri` (wrapping, filtrering –
  lagras i texturobjektet) och fylls med `glTexImage2D`; `glGenerateMipmap` skapar dess mipmaps.
- **Att vända bilden**: OpenGL förväntar sig texturkoordinat 0.0 på y-axeln längst ned i bilden, medan bilder lagrar
  den översta raden först; `stbi_set_flip_vertically_on_load(true)` vänder dem.
- **sampler2D**: uniform-typen för en 2D-textur i GLSL; `texture(sampler, coords)` samplar den.
- **Texturenhet**: en plats som en textur binds till (`glActiveTexture(GL_TEXTURE0 + n)`, sedan `glBindTexture`); en
  sampler-uniform sätts till enhetens nummer med `glUniform1i`. Minst 16 enheter finns.
:::
:::vulkan
- **VkImage**: en texturs bild, i device-local-minne, med egna **mipnivåer** (en i den här kursen).
- **Staging buffer**: en host-visible buffert som pixlarna först kopieras till; `vkCmdCopyBufferToImage` kopierar dem
  sedan till bilden.
- **Image layout** och **layoutövergång**: en bild har en layout som passar hur den används; en pipeline barrier
  flyttar den från `UNDEFINED` till `TRANSFER_DST_OPTIMAL` (för kopieringen) och vidare till
  `SHADER_READ_ONLY_OPTIMAL` (för sampling).
- **Image view** och **sampler** (`VkSampler`): hur shadern ser bilden, och hur den läser den. En sampler hör inte
  till någon bild, så en sampler kan läsa många.
- **Descriptor**, **descriptor set layout**, **descriptor pool** och **descriptor set**: en descriptor pekar ut en
  resurs för en shader. Layouten säger vilka **bindings** som håller vilka sorters descriptors (en del av pipeline
  layouten), setet allokeras ur poolen, skrivs med `vkUpdateDescriptorSets` och binds med `vkCmdBindDescriptorSets`.
- **Combined image sampler**: en image view och en sampler i en och samma descriptor; shadern ser en `sampler2D` vid
  `layout(binding = n)`.
- **Texturkoordinater**: v = 0 är bildens översta rad, så bilden vänds inte.
:::
:::d3d12
- **Texturresurs**: en `TEXTURE2D`-resurs i en **default heap** (GPU-minne), som fylls från en upload heap med
  `UpdateSubresources` och sedan flyttas från `COPY_DEST` till `PIXEL_SHADER_RESOURCE` med en resource barrier.
- **Shader resource view (SRV)**: den descriptor som en shader läser texturen genom, i en **shader-visible**
  CBV/SRV/UAV-descriptor heap.
- **Descriptor table**: en root-parameter som pekar på ett intervall av descriptors i heapen; dess SRV:er blir
  registren `t0`, `t1`, …; sätts med `SetDescriptorHeaps` och `SetGraphicsRootDescriptorTable`.
- **Statisk sampler**: en sampler som beskrivs i själva root signaturen, vid register `s0`; den hör inte till någon
  textur, så en sampler kan läsa många.
- **Texture2D** och **Sample**: `texture1.Sample(wrapSampler, input.texCoord)` samplar en textur i HLSL.
- **Texturkoordinater**: v = 0 är bildens översta rad, så bilden vänds inte.
:::

## Transformationer

- **Vektor**: en riktning och en storlek. Dess **längd** får man med Pythagoras sats; att **normalisera** en vektor
  gör den till en **enhetsvektor** med längden 1.
- **Skalärprodukt**: produkten av längderna gånger cosinus för vinkeln mellan två vektorer – för enhetsvektorer
  cosinus självt, som avslöjar vinkeln.
- **Kryssprodukt**: en vektor som är vinkelrät mot två andra (bara i 3D).
- **Matris**: ett rutnät av tal. Matrismultiplikation är inte kommutativ: A · B är oftast inte B · A.
- **Enhetsmatris**: matrisen som lämnar en vektor oförändrad.
- **Skalnings-**, **translations-** och **rotationsmatriser**: ändrar en vektors storlek, position och riktning.
  Rotationsvinklar anges i radianer.
- **Homogen koordinat**: vektorns w-komponent. Med w = 1 är en vektor en punkt och flyttas; med w = 0 är den en
  riktning och flyttas inte.
- **Att kombinera matriser**: en matris kan göra flera transformationer. Med kolumnvektorer (läroboken, GLM) tillämpas
  matrisen längst till höger först: i `Trans * Scale` skalas vektorn först och flyttas sedan.

:::opengl
- **GLM**: matematikbiblioteket OpenGL Mathematics: `glm::mat4`, `glm::translate`, `glm::rotate`, `glm::scale`,
  `glm::radians`.
- **glUniformMatrix4fv** och **glm::value_ptr**: skickar en matris till en `mat4`-uniform; GLM lagrar matriser kolumn
  för kolumn, i den ordning OpenGL förväntar sig, så *transpose*-argumentet är `GL_FALSE`.
:::
:::vulkan
- **GLM**: samma matematikbibliotek som i learnopengl och vulkan-tutorial: `glm::mat4`, `glm::translate`,
  `glm::rotate`, `glm::scale`. En `glm::mat4` motsvarar GLSL:s `mat4` byte för byte.
- **Matrisen som push constant**: `struct PushConstants { glm::mat4 … }` och ett `push_constant`-block i vertex
  shadern.
- **Y-vändningen**: matematiken görs med y uppåt, som i learnopengl, och vertex shadern vänder y för Vulkans
  klipprum med y nedåt (från och med *Koordinatsystem* gör projektionsmatrisen det).
:::
:::d3d12
- **DirectXMath**: Microsofts matematikbibliotek. **Beräkningstyper** (`XMVECTOR`, `XMMATRIX`) är till för
  matematiken, **lagringstyper** (`XMFLOAT3`, `XMFLOAT4X4`) för dina structar.
- **Radvektorer**: DirectXMath skriver v · M, så dess matriser är lärobokens transponerade och en produkt läses från
  **vänster till höger**: `XMMatrixScaling(…) * XMMatrixTranslation(…)` skalar först och flyttar sedan.
- **XMMatrixTranspose** och **mul(position, transform)**: `XMFLOAT4X4` lagrar rad för rad medan HLSL läser en matris i
  en cbuffer kolumn för kolumn, så matrisen transponeras när den lagras; `mul` med vektorn först beräknar v · M, som
  DirectXMath.
- **Matrisen som root constants**: en 4×4-matris är 16 root constants på 32 bitar (av högst 64 DWORD i en root
  signature).
:::

## Koordinatsystem

- **Lokalt rum** (local space): ett objekts koordinater i förhållande till dess egen origo.
- **Världsrum** (world space): koordinaterna i den större världen. **Model-matrisen** flyttar, skalar och roterar ett
  objekt från det lokala rummet till världsrummet.
- **Vyrum** (view space, kamera- eller ögonrum): världen sedd från kameran; **vymatrisen** tar dig dit.
- **Klipprum** (clip space): det som vertex shadern ger ut; **projektionsmatrisen** tar dig dit och avgör vad som syns.
- **Frustum**: den volym som projektionsmatrisen behåller; allt utanför klipps.
- **Ortografisk projektion**: ett lådformat frustum, utan perspektiv: saker långt bort är lika stora som saker nära.
- **Perspektivprojektion**: ett pyramidformat frustum som bestäms av synfältet, bildförhållandet och när- och
  fjärrplanen; den lägger avståndet i w, så att saker längre bort blir mindre.
- **Perspektivdivision**: att dela x, y och z med w i slutet av vertexsteget, vilket gör om klipprummet till NDC.
- **Skärmrum** (screen space): NDC avbildade på viewporten, i pixlar.
- **Högerhänt system**: +x åt höger, +y uppåt, +z mot dig; kameran tittar längs -z i vyrummet.
- **Kedjan**: `projection · view · model · position` (med kolumnvektorer, läses från höger till vänster).
- **Djupbuffert** (z-buffert) och **djuptestning**: per pixel djupet för det hittills närmaste fragmentet, rensat till
  1.0 (fjärrplanet) varje bildruta; ett fragment som ligger längre bort än det lagrade värdet kastas.

:::opengl
- **OpenGL:s NDC**: x, y och z går alla från -1 till 1; y pekar uppåt. `glm::perspective` och `glm::ortho` ger det
  intervallet.
- **Uniforms för alla tre matriserna**: `model`, `view` och `projection` sätts med `setMat4` (`shader_m.h`); varje
  draw-anrop använder de värden som satts före det.
- **glEnable(GL_DEPTH_TEST)** och **GL_DEPTH_BUFFER_BIT**: slår på djuptestningen (GLFW skapar djupbufferten) och
  rensar djupbufferten tillsammans med färgen.
:::
:::vulkan
- **Vulkans NDC**: djupet går från 0 till 1 och y pekar nedåt. `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` anpassar GLM:s
  projektion till djupintervallet, och `proj[1][1] *= -1` vänder y.
- **Uniform buffer för view och projection**: en `VkBuffer` som läses via en descriptor (binding 2 i descriptor
  setet); dess *innehåll* läses när GPU:n kör kommandona, så varje draw-anrop i en bildruta ser samma värden.
- **Push constant för model-matrisen**: spelas in i command buffern, så varje draw-anrop får sin egen.
- **Djupbild**: du skapar djupbufferten själv: en bild i ett djupformat, dess view, ett djup-attachment i render
  passen och framebuffers, pipelinens depth-stencil-tillstånd, och ett rensningsvärde på 1.0.
:::
:::d3d12
- **Direct3Ds NDC**: djupet går från 0 till 1; y pekar uppåt, som i OpenGL. Kursen använder DirectXMaths högerhänta
  funktioner (`XMMatrixPerspectiveFovRH`), som har samma vyrum som GLM.
- **Constant buffer för view och projection**: en buffertresurs som läses via en **constant buffer view** (CBV,
  register `b1`) i descriptor heapen; dess storlek är en multipel av 256 byte. Dess *innehåll* läses när GPU:n kör
  kommandona, så varje draw-anrop i en bildruta ser samma värden.
- **Root constants för model-matrisen**: spelas in i command listen, så varje draw-anrop får sin egen.
- **Djupbuffert**: du skapar den själv: en **DSV-heap**, en `DXGI_FORMAT_D32_FLOAT`-textur med sin depth stencil view,
  PSO:ns depth-stencil-tillstånd, `ClearDepthStencilView` varje bildruta och DSV:n i `OMSetRenderTargets`.
:::

## Kamera

- **Kamerans position**, **riktning**, **höger-** och **uppåtvektor**: vyrummets axlar, byggda med kryssprodukter av
  riktningen och världens uppåtvektor.
- **LookAt-matris**: vymatrisen byggd av de axlarna och kamerans position: en rotation in i kamerans axlar gånger en
  translation med den negerade positionen.
- **Fri kamera**: `cameraPos`, `cameraFront` och `cameraUp`; vyn tittar från `cameraPos` mot
  `cameraPos + cameraFront`, och WASD-tangenterna flyttar `cameraPos`.
- **Deltatid**: tiden som den förra bildrutan tog. Att multiplicera hastigheter med den gör att rörelsen blir
  densamma på snabba och långsamma datorer.
- **Eulervinklar**: **yaw** (vänster/höger), **pitch** (upp/ned) och **roll**. Riktningsvektorn beräknas från yaw och
  pitch med sinus och cosinus; pitch hålls mellan -89° och 89° så att vyn inte slår runt.
- **Mustitt** (mouse look): musens rörelse sedan förra bildrutan, gånger en känslighet, läggs till yaw och pitch.
- **Zoom**: ett mindre **synfält** (field of view) i projektionsmatrisen får scenen att se större ut; kursen håller det
  mellan 1° och 45°.

:::opengl
- **glm::lookAt(position, target, up)**: bygger LookAt-matrisen.
- **glfwGetKey**: om en tangent hålls nere just nu (`processInput`).
- **glfwSetInputMode(…, GLFW_CURSOR, GLFW_CURSOR_DISABLED)**: döljer och fångar markören.
- **glfwSetCursorPosCallback** och **glfwSetScrollCallback**: `mouse_callback` och `scroll_callback`, som anropas när
  musen rör sig och när hjulet snurrar.
:::
:::vulkan
- **glm::lookAt(position, target, up)**: bygger LookAt-matrisen; den hamnar i uniform buffern i
  `updateUniformBuffer()`, tillsammans med projektionen, som använder `fov`.
- **GLFW-inmatning**: samma som i OpenGL: `glfwGetKey`, `GLFW_CURSOR_DISABLED`, och callbackarna
  `glfwSetCursorPosCallback` och `glfwSetScrollCallback`.
:::
:::d3d12
- **XMMatrixLookAtRH(eye, focus, up)**: bygger den högerhänta LookAt-matrisen (LH-versionen skulle inte passa
  RH-projektionen).
- **Tangentbord**: `WM_KEYDOWN` och `WM_KEYUP` håller en array med nedtryckta tangenter uppdaterad, och `OnUpdate`
  flyttar kameran en gång per bildruta.
- **Mus**: `ShowCursor(FALSE)` döljer markören, `WM_MOUSEMOVE` rapporterar dess position (`GET_X_LPARAM`,
  `GET_Y_LPARAM`), och `SetCursorPos` flyttar tillbaka den till mitten av fönstret.
- **Mushjul**: `WM_MOUSEWHEEL`, med `GET_WHEEL_DELTA_WPARAM` delat med `WHEEL_DELTA` per hack.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Visa den färdiga bildrutan | `glfwSwapBuffers` | `vkQueuePresentKHR` | `Present` |
| Vertexformat | VAO (`glVertexAttribPointer`) | beskrivning av vertexindata i pipelinen | input layout i PSO:t |
| Pipelinens inställningar | kontextens tillstånd | `VkPipeline` | pipeline state object |
| Små värden per draw-anrop | uniform | push constant | root constants |
| Värden för hela bildrutan | uniform | uniform buffer (descriptor) | constant buffer (CBV) |
| En textur för shadern | texturenhet | descriptor-binding | SRV-register (`t0`) |
| Hur en textur läses | texturparametrar | `VkSampler` | (statisk) sampler |
| Djupintervall i NDC | -1..1 | 0..1 | 0..1 |
| Att vänta på GPU:n | (sköts av drivrutinen) | fence | fence |

Det var allt för den första delen. I *Ljussättning* använder du allt det här – shaders, värden från CPU:n, texturer
och kameran – för att ljussätta en scen.
