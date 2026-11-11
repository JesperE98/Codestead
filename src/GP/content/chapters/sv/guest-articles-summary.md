# Sammanfattning: Gästartiklar

Grattis, du har nått slutet av delen *Gästartiklar* – och av kursen. Delen följde artiklarna som gästskribenter skrev för
learnopengl.com mellan 2020 och 2022, var och en om en egen teknik: transparens som inte beror på ritordningen, en
tentakel som animeras av sina ben, en scengraf och frustum culling byggd på den, kaskaderade skuggkartor för en stor vy,
ett landskap från en höjdkarta – först som ett enda tätt mesh, sedan tessellerat på GPU:n –, OpenGL:s direct state
access, en bloom gjord av en kedja allt mindre texturer, compute shaders och ljus med en yta. Den här sidan är en
ordlista över delens viktigaste begrepp, kapitel för kapitel, som de genomgångar learnopengl.com har i slutet av sina
delar. Använd den för att slå upp saker, och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet
den kommer från.

De flesta av teknikerna är sätt att organisera pass, buffrar och shaders, och CPU-kod som scengrafen, animatören och
cullingen – likadant i alla API:er, så det mesta på den här sidan står utanför rutorna. Det som skiljer är hur {{api}}
slår på GPU:ns valfria delar, renderar i flera eller allt mindre mål och får ett pass att vänta på ett annat. OpenGL ber
om en kontextversion (4.0 för tessellering och instansierade geometry shaders, 4.3 för compute, 4.5 för DSA) och räknar
själv ut de flesta beroenden, med `glMemoryBarrier` som undantag. Vulkan slår på device features (`independentBlend`,
`tessellationShader`, `geometryShader`, `fillModeNonSolid`), bakar in blending, topologi och tesselleringstillstånd i
pipelines, och låter render passes, layouter och barriärer säga vem som väntar på vem. Direct3D 12 har alla de här stegen
på varje enhet, slår på dem i pipeline state-objektet (`IndependentBlendEnable`, `HS` / `DS` / `GS`, topologitypen
`PATCH`) och byter resurstillstånd med barriärer. När du är klar kontrollerar provet i slutet av delen vad du har lärt
dig.

## OIT: introduktion

- **Over-operatorn**: `C = Cs · αs + Cd · (1 − αs)` – vanlig alfablending. Rätt för ett lager över en ogenomskinlig
  bakgrund; för flera lager bara när de kommer **bakifrån och fram**, eftersom den inte är kommutativ: lagret som blendas
  sist väger tyngst.
- **Djupskrivning och transparens**: ett genomskinligt objekt som skriver sitt djup döljer allt bakom sig, som om det
  vore ogenomskinligt (den blå kvadratens saknade hörn). Utan djupskrivning blir blendingordningen ritordningen – fortfarande
  fel, bara mindre tydligt.
- **Att sortera** per objekt efter avståndet – svaret i kapitlet *Blending* – misslyckas där objekt **skär igenom
  varandra**, överlappar **cykliskt**, **överlappar sig själva** (ett mesh, ett draw call), eller där mittpunkterna ligger
  i en ordning och fragmenten i en annan; och det kostar CPU-tid varje bildruta.
- **Ordningsoberoende transparens (OIT)**: resultatet av blending bakifrån och fram (eller nära det) oavsett i vilken
  ordning objekten ritas. Familjerna:
  - **Depth peeling** (Everitt, 2001): ett pass per lager, som vart och ett behåller det närmaste fragmentet bakom
    föregående lager; exakt, men ett pass över all genomskinlig geometri per lager (*dual depth peeling* halverar dem).
  - **A-buffer / länkade listor per pixel**: varje genomskinligt fragment sparas med sitt djup (atomisk räknare, atomiskt
    utbyte i en huvudbild per pixel), sedan sorteras och blendas varje pixels lista i ett helskärmspass; exakt med ett
    geometripass, men minnet växer med fragmenten (*k-buffrar* behåller bara de k närmaste).
  - **Weighted blended OIT** (McGuire och Bavoil, 2013): summor och produkter i stället för over-operatorn – en
    approximation med en fast mängd minne och ingen sortering.
  - **Momentbaserad OIT** och **stokastisk transparens**: approximationer av transmittansen per pixel, mittemellan.

## OIT: Weighted Blended

- **Revealage**: `(1 − α1) · (1 − α2) · … · (1 − αn)`, hur mycket av bakgrunden som syns igenom – exakt och oberoende av
  ordningen (en produkt).
- **Viktat medelvärde**: `Σ Ci · αi · wi / Σ αi · wi`, blendat över bakgrunden med täckningen `1 − revealage`. Det som går
  förlorat är skymningen *mellan* de genomskinliga lagren.
- **Vikten** `w = clamp(pow(min(1.0, α · 10) + 0.01, 3) · 1e8 · pow(1 − z · 0.9, 3), 1e-2, 3e3)` med z som fönsterdjupet:
  närmare och mer täckande fragment väger tyngre; clamp hindrar 16-bitars flyttal från att svämma över för snabbt. Nära
  kameran slår båda kvadraterna i taket 3000 och väger lika – (0, 96, 96) där de överlappar.
- **Två render targets**: **ackumulering** (RGBA, 16-bitars flyttal, rensad till 0, blending `ONE, ONE`: `(C · α, α) · w`
  summeras) och **revealage** (en 8-bitarskanal, rensad till 1, blending `ZERO, ONE_MINUS_SRC_COLOR`: multipliceras med
  `1 − α`). Det enda kravet på hårdvaran: **olika blendfunktioner per mål** i samma draw call.
- **De fyra passen**: solid-passet till ett ogenomskinligt mål utanför skärmen, med djup; det genomskinliga passet till
  de två målen, djuptest mot det ogenomskinliga djupet men **ingen djupskrivning**; compositepasset – en helskärmsfyrhörning,
  `texelFetch` av samma pixel, `discard` där revealage är 1, ett skydd med `isinf`, medelvärdet med alfa `1 − revealage`,
  vanlig alfablending och ett djuptest som alltid släpper igenom; slutpasset till fönstret.
- **Vad den gör fel**: det närmaste lagret dominerar inte, starkt täckande lager ser urvattnade ut, många lager tappar
  precision, ingen färgad transmission eller brytning. Bara ordningen *mellan* de genomskinliga objekten slutar spela roll.

:::opengl
- **OpenGL 4.2 core**: `glBlendFunci(buf, src, dst)` (core sedan 4.0) för en blendfunktion per draw buffer, och
  `layout (binding = N)` på samplers (4.2). macOS (4.1) skulle sätta enheterna med `setInt` i stället.
- **Rensa varje mål för sig**: `glClearBufferfv(GL_COLOR, i, value)` – `glClear` skulle rensa båda till samma
  `glClearColor`.
- Djupet är en **textur** (`depthTexture`) så att det genomskinliga framebuffer-objektet kan koppla in samma; compositepasset
  använder `glDepthFunc(GL_ALWAYS)`; `glDepthMask(GL_TRUE)` före nästa bildrutas `glClear`, som respekterar masken.
:::
:::vulkan
- **`independentBlend`**: som standard måste alla `VkPipelineColorBlendAttachmentState` i en pipeline vara lika; device
  featuren tillåter olika – kontrollerad i `isDeviceSuitable` och påslagen när enheten skapas.
- **Render passes i stället för framebuffers**: det ogenomskinliga passet sparar sin färg och sitt djup; det
  genomskinliga passet **laddar** det ogenomskinliga djupet (dess clear-värde ignoreras men måste finnas – clear-värdena
  indexeras per attachment); compositepasset laddar den ogenomskinliga färgen och har ingen djup-attachment alls
  (`glDepthFunc(GL_ALWAYS)` blir inget djuptest). Subpass-beroenden och slutlayouter (`COLOR_ATTACHMENT_OPTIMAL`,
  `SHADER_READ_ONLY_OPTIMAL`) ordnar passen.
:::
:::d3d12
- **`IndependentBlendEnable = TRUE`**: utan den gäller `BlendState.RenderTarget[0]` för alla mål.
- **Två mål från en pixel shader**: en returnerad struct med `SV_TARGET0` och `SV_TARGET1`; båda RTV:erna binds samtidigt
  med den ogenomskinliga djupbufferten, var och en rensad till sitt eget värde; `D3D12_DEPTH_WRITE_MASK_ZERO` för det
  genomskinliga passet, `D3D12_COMPARISON_FUNC_ALWAYS` för compositepasset. `texelFetch` är `Texture2D.Load(int3(x, y, mip))`.
- Varje textur utanför skärmen vilar i `PIXEL_SHADER_RESOURCE` och blir ett `RENDER_TARGET` med en barriär för sitt pass.
:::

## Skelettanimation

- **Skelettanimation och skinning**: ett mesh med ett **skelett** – ett träd av **ben** – där varje vertex sitter fast i
  några ben med **vikter**. En animation sparar benens transformer över tiden, inte vertexarna; vertex shadern flyttar
  varje vertex med dess ben. *Vertexanimation* sparar i stället varje vertex per nyckel – exakt, men tungt och inte
  återanvändbart.
- **Kursens modell**: en tentakel i glTF 2.0 med fyra ben i en kedja (`Base`, `Lower`, `Upper`, `Tip`), högst två ben per
  vertex, och en loopande animation på 2 sekunder, `Sway`.
- **Bindpose och offsetmatris**: meshet är modellerat i bindposen (viloposen); **offsetmatrisen** (den inversa
  bindmatrisen) för en vertex in i benets rum. Ett bens slutliga matris är `globalTransform · offset` – identiteten i
  bindposen.
- **Linear blend skinning**: `Σ vikt_i · finalBonesMatrices[benId_i] · position` över upp till fyra ben
  (`MAX_BONE_INFLUENCE = 4`), id −1 hoppas över; vikterna summerar till 1, så meshet böjer sig mjukt i lederna.
- **Nyckelrutor**: tre spår per ben – positioner och skalor interpoleras med `mix`, rotationer som **kvaternioner** med
  **slerp** (kortaste bågen, konstant vinkelhastighet; Eulervinklar och linjärt interpolerade matriser ger fel vägar
  eller skjuvning). De två nycklarna runt en tidpunkt och andelen `(time − last) / (next − last)`; den lokala transformen
  `translation · rotation · scale`.
- **Ticks**: `mTicksPerSecond` (1000 för glTF-filen) och `mDuration` (2000); `time += ticksPerSecond · dt`, lindad med
  `fmod(time, duration)`.
- **assimps data**: per `aiBone` ett namn, `mOffsetMatrix` och `mWeights` (`mVertexId`, `mWeight`) – vänt till id:n och
  vikter per vertex av `ExtractBoneWeightForVertices`; id:n i den ordning benen först ses, sparade i `m_BoneInfoMap`
  (`BoneInfo { id; offset; }`). `ReadMissingBones` ger id till animerade ben som ingen vertex använder.
- **Bone, Animation, Animator**: `CreateBone` / `UpdateBone`; `LoadAnimation` (längd, ticks, en kopia av **nodträdet**
  med `ReadHierarchyData`, ett ben per kanal); `CalculateBoneTransform` går igenom trädet som scengrafens uppdatering,
  och `UpdateAnimation` flyttar fram tiden. **100 slutliga matriser** (`MAX_BONES`), uppladdade varje bildruta.
- **Vidare**: att blanda animationer, **dual quaternion skinning** (mot "karamellpappers"-kollapsen i linjär blending),
  skinnade normaler, skinning en gång i en compute shader.

:::opengl
- **`glVertexAttribIPointer(3, 4, GL_INT, …)`** – **I:et** håller benens id:n som heltal (`ivec4` i shadern); vikterna på
  location 4 med `glVertexAttribPointer`.
- De 100 matriserna som uniforms `finalBonesMatrices[i]`, satta en i taget varje bildruta; ingen `aiProcess_FlipUVs` –
  assimp vänder redan glTF:s texturkoordinater till OpenGL:s konvention med v uppåt.
:::
:::vulkan
- **`VK_FORMAT_R32G32B32A32_SINT`** på location 3 levererar heltal till en `ivec4` – Vulkans `glVertexAttribIPointer`.
- De 100 matriserna i uniform-bufferten efter view och projection (6 400 byte, inom de 16 KB varje enhet tillåter),
  kopierade från animatören i `updateUniformBuffer()`; modellen läses med `aiProcess_FlipUVs` (Vulkans v = 0 är bildens
  översta rad).
:::
:::d3d12
- **`BLENDINDICES`** (`DXGI_FORMAT_R32G32B32A32_SINT`, `int4`) och **`BLENDWEIGHT`** – semantikerna Direct3D reserverar
  för skinning.
- **Radvektorer**: varje produkt i omvänd ordning – den lokala transformen `scale · rotation · translation`, en nods
  globala transform `nodeTransform · parentTransform`, ett bens slutliga matris `offset · global`; assimps matriser
  transponeras vid konverteringen; `XMQuaternionSlerp`, `XMVectorLerp`; `XMFLOAT4X4` / `XMFLOAT4` i containrar.
- De 100 matriserna i constant bufferten, transponerade som de andra, fyllda i `OnUpdate`.
:::

## Scengraf

- **Scengraf**: ett träd av **entiteter**, var och en med en transform **relativt sin förälder** – en måne relativt sin
  planet. **Lokalt rum** (relativt föräldern) och **globalt rum** (världen): `global = parentGlobal · local`; rotens
  förälder är identiteten. Förälderns skala och rotation följer med till allt under den.
- **Transformen**: position, Eulerrotation (grader, tillämpade z, x, y: `Y · X · Z`) och skala; den lokala matrisen är en
  **TRS**-matris – translation · rotation · scale.
- **Entiteten**: en transform, modellen den ritar och dess barn. Kursen håller barnen **som värden** i en `std::vector`
  och skickar förälderns globala matris nedåt som parameter, utan föräldrapekare (learnopengl:
  `std::list<std::unique_ptr<Entity>>` och en rå `parent`). `updateSelfAndChild` och `drawSelfAndChild` går igenom trädet
  rekursivt.
- **Pekare in i vektorer**: en `push_back` förbi kapaciteten flyttar elementen och lämnar pekare till dem hängande –
  säkert i kursens loop bara för att varje pekare används före nästa `push_back` i den vektorn.
- **Kedjan**: tio barn på (3.5, 0, 0) och skala 0.6 vardera – en modell ritad elva gånger med elva modellmatriser.
- **Dirty-flaggan**: en transform minns om dess lokala värden har ändrats; set-funktionerna sätter den,
  `computeModelMatrix` nollställer den. En ändrad entitet räknar om sig själv och **allt under sig**
  (`forceUpdateSelfAndChild`); en oförändrad letar bara vidare nedåt.
- **Att flytta grafen**: roten vriden `20 · time` grader, grafen uppdaterad **innan** den ritas – hela kedjan följer med.

:::d3d12
- DirectXMaths **radvektorer** vänder varje produkt: den lokala matrisen `S · Z · X · Y · T`, den globala `local · parent`.
  `XMFLOAT3` / `XMFLOAT4X4` sparas i structarna, `XMMATRIX` används för räknandet.
:::

## Frustum culling

- **Frustum culling**: att på CPU:n hoppa över objekt utanför **synfrustumet** – inget draw call, inga vertexar som
  shadas.
- **Plan**: en enhetsnormal **n** och ett avstånd d, `dot(n, p) = d`; det **tecknade avståndet** `dot(n, p) − d` är
  positivt på den sida normalen pekar mot. Frustumet är sex plan med normalerna riktade **inåt**.
- **`createFrustumFromCamera`**: planen byggs i världsrummet från kamerans position, front-, höger- och uppvektor,
  synfältet, bildförhållandet och när- och fjärravståndet – närplanet genom `pos + zNear · front`, fjärrplanet genom
  `pos + zFar · front`, sidoplanen genom kameran med normaler från kryssprodukter. Ingen projektionsmatris, så API:ets
  djupintervall och y-riktning spelar ingen roll (att ta ut planen ur view-projection-matrisen skulle bero på båda).
  learnopengls namn på sidoplanen är omkastade – ofarligt när alla sex testas.
- **Begränsningsvolym** (bounding volume): en enkel form som omsluter modellen och testas i stället för dess vertexar.
  Testet är **konservativt**: det kan rita något osynligt, men hoppar aldrig över något synligt.
- **Sfär**: mittpunkt och radie från lådan runt vertexarna (börja maximum på `numeric_limits<float>::lowest()`, inte
  `min()`, det minsta *positiva* flyttalet). I världsrummet: mittpunkten genom modellmatrisen, radien gånger den **största
  skalan**. På planets insida när det tecknade avståndet är `> −radien`.
- **AABB**: mittpunkt och halva storlekar (extents); mot ett plan är dess "radie" längs normalen `Σ extent_i · |n_i|`. En
  vriden låda behöver en ny axelriktad låda runt sig i världsrummet – större än lådan själv.
- **Rutnätet**: 10 × 10 planeter runt roten, som vrider sig; vid 2.0 s ritas **8 / 101** med fjärrplanet på 15, **37 / 101**
  med kamerans eget frustum (samma bild), **38 / 101** med AABB:er – en mer än med sfärer, eftersom lådan runt en vriden
  låda sitter löst. Barnen testas även när föräldern cullas (inga hierarkiska volymer).
- **Vad den inte sparar**: overdraw (skymning), de synliga objektens pixlar, de osynliga delarna av ett synligt objekt.
  Mer: occlusion culling, hierarkier av begränsningsvolymer och oktalträd, GPU-driven culling med indirekta draw calls.

:::opengl
- Räknarna `ritade / totalt` hamnar i fönstrets titel med `glfwSetWindowTitle`.
:::
:::vulkan
- `Model` får en kopia av sina vertexar på CPU:n för `generateSphereBV` – annars finns vertexdatan bara i en
  device-local-buffert. Räknarna hamnar i fönstrets titel med `glfwSetWindowTitle`.
:::
:::d3d12
- Modellmatrisens skalade axlar är dess **rader** `r[0..2]` (radvektorer), där GLM har dem i kolumnerna. Räknarna hamnar
  i fönstrets titel med `SetWindowTextW`.
:::

## Kaskaderade skuggkartor

- **Perspektivaliasing**: en skuggkarta sprider sina texlar jämnt, en perspektivvy gör det inte – för få texlar per pixel
  nära kameran när en karta täcker en stor vy.
- **Kaskader**: synfrustumet delas längs djupet i skivor, var och en med en skuggkarta som sluter tätt kring den.
  Delningarna är bråkdelar av fjärrplanet (500): `far / 50, / 25, / 10, / 2` = 10, 20, 50, 250 – fyra delningar, **fem
  kaskader**, var och en längre än den förra.
- **En skivas hörn**: de åtta hörnen i lådan av normaliserade enhetskoordinater, transformerade med **inversen av
  projection · view** och dividerade med w, med en projektion som har skivans när- och fjärravstånd.
- **En tät ljuslåda**: ljusets view i hörnens mittpunkt, riktad längs −lightDir; den ortografiska lådan från hörnens
  minima och maxima i ljusrummet, med z-intervallet utsträckt med `zMult = 10` så att objekt mellan ljuset och skivan inte
  klipps bort. Räknas om varje bildruta – kaskaderna följer kameran.
- **En texturarray**: fem lager, djup, närmaste-filtrering, en kant med djupet 1.0 (inget utanför en låda ligger i skugga).
- **Alla kaskader i ett pass**: **instansierade geometry shaders** – geometry shadern körs fem gånger per triangel, använder
  anropets ljusrumsmatris och skickar triangeln till lagret med samma nummer.
- **Att välja kaskad**: fragmentets djup i view-rummet, `abs((view · pos).z)`, jämförs med delningsavstånden; bortom den
  sista delningen den sista kaskaden. Debugvyn färgar kaskaderna röd, grön, blå …
- **Skuggor**: kaskadens matris, djupet från det lagret (lagret som tredje texturkoordinat) och en bias skalad per kaskad
  (delad med kaskadens fjärravstånd · 0.5) – en fast bias skulle lossa skuggorna i stora lådor (*peter panning*). **PCF**
  över 3 × 3 texlar i lagret, texelstorleken från arrayens bredd och höjd.
- **Vidare**: att blanda över sömmarna mellan kaskader, att **stabilisera** kaskaderna mot flimmer (en omslutande sfär
  och fästning vid hela texlar), tätare z-intervall, ett praktiskt delningsschema, culling per kaskad.

:::opengl
- **OpenGL 4.1**: `layout (triangles, invocations = 5) in;` (core sedan 4.0), `gl_InvocationID`, `gl_Layer`.
- **Hörnen**: z från −1 till 1, `(2x − 1, 2y − 1, 2z − 1)`. Matriserna i ett `std140`-uniformblock med `mat4[16]` på
  bindningspunkt 0.
- `glTexImage3D` med fem lager; `glFramebufferTexture` (utan `Layer`) kopplar in hela arrayen – ett **lagrat**
  framebuffer-objekt; `sampler2DArray`, `textureSize` returnerar en `ivec3`.
:::
:::vulkan
- **Hörnen**: Vulkans djup är 0..1 (`GLM_FORCE_DEPTH_ZERO_TO_ONE`), så z går från 0 till 1: `(2x − 1, 2y − 1, z)` –
  learnopengls `2z − 1` skulle lägga de nära hörnen framför närplanet och förstora varje låda.
- **Featuren `geometryShader`**; en bild med `arrayLayers = 5`, en vy av typen `VK_IMAGE_VIEW_TYPE_2D_ARRAY` som används
  både som samplad array och som attachment i en framebuffer med `layers = 5`; clamp mot en vit kant.
- std140: `float cascadePlaneDistances[16]` blir en array av `vec4` (arrayelement ligger 16 byte isär).
:::
:::d3d12
- **Hörnen**: Direct3D:s djup är 0..1, så `(2x − 1, 2y − 1, z)`, med inversen av view · projection (radvektorer).
- **`[instance(5)]`**, `SV_GSInstanceID`, `SV_RenderTargetArrayIndex`; en `R32_TYPELESS`-textur med `DepthOrArraySize = 5`,
  en DSV och en SRV över alla skivor; en kant-sampler med `OPAQUE_WHITE`.
- HLSL:s packning: varje element i en cbuffer-array börjar en ny 16-bytesrad, så delningsavstånden är `float4`.
:::

## Tessellering: höjdkarta

- **Höjdkarta**: en gråskalebild läst som terräng – varje pixel en punkt i ett rutnät, dess grå nyans höjden. Kursens är
  256 × 256 med en 8-bitarskanal (`stbi_load(…, 0)` rapporterar en kanal), inte vänd: dess översta rad är terrängens
  bakre kant.
- **En vertex per pixel**: x från kolumnen, z från raden (centrerade), `y = värde · 64/256 − 16` – 65 536 vertexar.
- **Triangle strips**: sicksack mellan två rader, varje vertex efter de två första bildar en triangel. 255 strips med 510
  trianglar (130 560 index för 130 050 trianglar; en lista skulle behöva tre index per triangel). Varje strip ritas för
  sig – en enda strip över hela bufferten skulle förbinda slutet av ett radpar med början av nästa.
- **Primitive restart**: ett särskilt index (`0xFFFFFFFF` för 32-bitarsindex) avslutar en strip, så att alla får plats i
  ett draw call.
- **`rez`**: learnopengls var n:te vertex passar den här kartan bara för `rez = 1` (den måste dela både 255 och 256).
- **Färg efter höjd**: `h = (height + 16) / 64` som grått; learnopengls CPU-demo delar med 32.
- **Kostnaden**: varje vertex lagras och transformeras och varje triangel sätts upp varje bildruta, nära som fjärran;
  detaljrikedomen bestäms när meshet byggs.

:::opengl
- `GL_POINTS` för en första titt; varje strip med ett eget `glDrawElements(GL_TRIANGLE_STRIP, …)`, vars sista argument är
  en **byte**-offset; primitive restart med `glEnable(GL_PRIMITIVE_RESTART)` + `glPrimitiveRestartIndex`.
:::
:::vulkan
- Punkter kräver att vertex shadern skriver **`gl_PointSize`**; `VK_INDEX_TYPE_UINT32` (65 536 vertexar använder varje
  16-bitarsvärde); `firstIndex` i `vkCmdDrawIndexed` räknar index; primitive restart med `primitiveRestartEnable` i
  pipelinen.
:::
:::d3d12
- Topologin i två delar: pipeline state-objektets `PrimitiveTopologyType` (punkt, linje, triangel, patch) och
  `IASetPrimitiveTopology` (lista eller strip); en punkt är alltid en pixel. `StartIndexLocation` räknar index;
  restart-indexet är pipeline state-objektets `IBStripCutValue`. Utskrifter går till `OutputDebugStringA`.
:::

## Tessellering

- **Stegen**: **tessellation control shadern** (Direct3D: **hull shadern**) körs per kontrollpunkt och sätter
  **tesselleringsnivåerna** per patch; den fasta **tessellatorn** genererar (u, v)-punkter och trianglar över en abstrakt
  patch; **tessellation evaluation shadern** (**domain shadern**) körs för varje genererad punkt och räknar ut dess
  position. Indata är **patches** med ett fast antal kontrollpunkter.
- **Projektet**: 20 × 20 patches med **4 kontrollpunkter** (1 600 vertexar, position + texturkoordinat), höjdkartan som en
  textur med en kanal, **clamp mot kanten** (repeat skulle dra in de bortre topparnas höjder i den främre kanten).
- **Evaluation**: texturkoordinaten och positionen interpoleras bilinjärt från de fyra hörnen med u och v, höjden läses
  ur texturen, punkten flyttas längs patchens normal, sedan model, view och projection. Mipmaps är till ingen nytta här:
  före rastreringen finns inga derivator, så shadern läser nivå 0.
- **Nivåer**: fyra **yttre** nivåer (en per kant) och två **inre**. **Spacing**: `equal_spacing` / `integer` avrundar uppåt
  till hela, lika långa segment; **`fractional_odd_spacing`** avrundar uppåt till nästa udda tal med två kortare segment,
  så att en nivå som ändras flyttar punkterna mjukt. Nivå 8 → 9 segment, 9 × 9 fyrhörningar, 162 trianglar per patch.
- **Nivå 1** (startens control-steg): en platt fyrhörning per patch – en grov terräng; **nivå 8**: hela terrängen, ungefär
  65 000 trianglar från 1 600 vertexar.
- **Nivåer efter avstånd**: per hörn djupet i ögonrummet, skalat till 0..1 mellan 250 och 450; varje yttre nivå
  `mix(MAX, MIN, …)` (8 till 2) från **det närmaste av kantens två hörn**, de inre nivåerna den största av de två parallella
  yttre nivåerna. Att räkna en kant bara från dess egna hörn undviker **sprickor** mellan grannpatches.
- **Trådmodell**: bara trianglarnas kanter – samma täthet på varje patch med fasta nivåer, gles längst bak med nivåer
  efter avstånd.
- **Vidare**: nivåer i skärmrummet, culling av patches (nivå 0), normaler i evaluation shadern, displacement på modeller,
  **mesh shaders**.

:::opengl
- **OpenGL 4.0** (kursen ber om 4.1, som macOS har): `GL_MAX_TESS_GEN_LEVEL` (64); `glPatchParameteri(
  GL_PATCH_VERTICES, 4)` och `glDrawArrays(GL_PATCHES, …)`.
- `layout (quads, fractional_odd_spacing, ccw) in;` på evaluation shadern, `layout (vertices = 4) out;` och
  `gl_TessLevelOuter[4]` / `gl_TessLevelInner[2]` – skrivna av anrop 0 – på control shadern, `gl_TessCoord`. OpenGL
  klarar sig utan control shader (standardnivåer); kursen behåller den.
- `glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)` för trådmodellen; `GL_R8` med data i `GL_RED`.
:::
:::vulkan
- Device featuren **`tessellationShader`**; `maxTessellationGenerationLevel` (64); `VK_PRIMITIVE_TOPOLOGY_PATCH_LIST` och
  `VkPipelineTessellationStateCreateInfo.patchControlPoints = 4` – patchstorleken hör till pipelinen.
- En pipeline med tessellering **måste** ha både en control och en evaluation shader – därav startens control shader med
  nivå 1. Tessellatorn placerar `gl_TessCoord` som OpenGL:s gör.
- Trådmodell med `VK_POLYGON_MODE_LINE` och featuren **`fillModeNonSolid`**; höjdkartan i `VK_FORMAT_R8_UNORM` utan mipmaps,
  samplad i evaluation-steget.
:::
:::d3d12
- Tessellering finns på varje Direct3D 12-enhet; den största faktorn är konstanten
  `D3D12_TESSELLATOR_MAX_TESSELLATION_FACTOR` (64).
- **Hull shadern** deklarerar layouten – `[domain("quad")]`, `[partitioning("fractional_odd")]`,
  `[outputtopology("triangle_ccw")]`, `[outputcontrolpoints(4)]`, `[patchconstantfunc(…)]` – och körs per kontrollpunkt
  (`SV_OutputControlPointID`); **patch constant-funktionen** körs en gång per patch och returnerar `SV_TessFactor[4]` och
  `SV_InsideTessFactor[2]`. Domain shadern får `SV_DomainLocation` och en `OutputPatch`.
- `PrimitiveTopologyType = PATCH` i pipeline state-objektet, `D3D_PRIMITIVE_TOPOLOGY_4_CONTROL_POINT_PATCHLIST` på command
  listen (topologi och patchstorlek i en konstant); `SampleLevel(…, 0)`; `D3D12_FILL_MODE_WIREFRAME`.
:::

## DSA

- **Bind to edit**: OpenGL:s klassiska modell – bind ett objekt till ett target, anropa sedan funktioner som arbetar på
  det som råkar vara bundet. Problemen: **tillstånd som läcker**, **dolda beroenden** (en VAO som sväljer en elementbuffert,
  en hjälpfunktion som byter ut en texturbindning), extra anrop, och en bindning med två betydelser (redigera och rita).
- **Direct state access** (OpenGL **4.5**, `ARB_direct_state_access`): funktioner som tar objektet som parameter –
  `glNamedBufferStorage(buffer, …)`, `glTextureParameteri(texture, …)`. Bindning finns kvar bara för att **rita**.
- **`glCreate*` mot `glGen*`**: `glGen*` reserverar ett namn, och den första bindningen skapar objektet och bestämmer dess
  typ; `glCreate*` skapar objekten direkt (`glCreateTextures` tar target som parameter).
- **Oföränderlig lagring**: `glNamedBufferStorage` låser en buffers storlek för gott, med **flaggor** i stället för
  användningstips – `0` (ändras aldrig från CPU:n), `GL_DYNAMIC_STORAGE_BIT` (tillåter `glNamedBufferSubData`),
  map-bitarna, beständig mappning. `glTextureStorage2D` allokerar alla mipnivåer på en gång – komplett från början; data
  med `glTextureSubImage2D`, mipmaps med `glGenerateTextureMipmap`; en hel kedja har `1 + floor(log2(max(b, h)))` nivåer.
- **Separat attributformat** (från 4.3): `glVertexArrayAttribFormat` (format och offset inom en vertex),
  `glVertexArrayAttribBinding` (vilken bindningspunkt), `glVertexArrayVertexBuffer` (buffert, offset, stride),
  `glVertexArrayElementBuffer`; `glBindTextureUnit(unit, texture)` för att rita.
- **Andra objekt**: `glCreateFramebuffers` + `glNamedFramebufferTexture`, `glNamedRenderbufferStorage`,
  `glProgramUniform*` (4.1). macOS stannar vid 4.1 – ingen DSA där.

:::opengl
- Uppgifterna skriver om rektangeln från *Hello Triangle* med DSA och ger den containertexturen:
  `glTextureStorage2D(texture, levels, GL_RGB8, …)` (ett **storleksbestämt** internt format) och
  `glTextureSubImage2D(…, GL_RGB, GL_UNSIGNED_BYTE, data)` (formatet på datan som laddas upp).
:::
:::vulkan
- Inga uppgifter: Vulkan har aldrig haft bind to edit. Varje anrop namnger sina objekt; en `VkBuffer` har fast storlek och
  dess minne är ett separat `VkDeviceMemory` från en vald minnestyp – det som oföränderlig lagring och dess flaggor för
  OpenGL mot. Vertexformatet bor i pipelinen (attribut- och bindningsbeskrivningar), buffrarna binds per draw call.
:::
:::d3d12
- Inga uppgifter: Direct3D 12 har aldrig haft bind to edit. Resurser är COM-objekt med fast storlek, skapade med sitt
  minne (heaptyp) eller placerade i en `ID3D12Heap`; vertexformatet är pipeline state-objektets input layout, buffrarna
  binds per draw call med vyer som bär stride.
:::

## Fysikaliskt baserad bloom

- **Den gaussiska bloomens svagheter**: en hård tröskel (glöden slås av och på), en liten, blockig glöd, flimmer från små
  ljusa detaljer, och tjugo pass i full upplösning.
- **Jimenez bloom** (*Call of Duty: Advanced Warfare*, SIGGRAPH 2014): **nedsampla** HDR-bilden steg för steg till allt
  mindre texturer, **uppsampla** sedan tillbaka och lägg ihop nivåerna. Små texturer gör en bred oskärpa billig.
- **Mipkedjan**: sex nivåer från halva fönstret (400 × 300 … 12 × 9), **R11G11B10 float** (ingen alfa, inget tecken –
  halva minnet och bandbredden jämfört med RGBA16F), linjär filtrering, clamp mot kanten; separata texturer, som
  learnopengl gör.
- **Nedsampling**: **13 bilinjära sampel** från ett område på 6 × 6 texlar – fem överlappande rutor på 2 × 2, de fyra
  hörnrutorna 0.125 var, den inre rutan 0.5 – så att energin bevaras och små detaljer inte flimrar mellan nivåerna.
- **Uppsampling**: ett 3 × 3 **tältfilter** (1 2 1 / 2 4 2 / 1 2 1 / 16) med en radie i **texturkoordinater**
  (`filterRadius = 0.005`), blendat additivt (`ONE, ONE`) i nästa större nivå; nivå 0 blir till slut bloomtexturen.
- **Ingen tröskel**: `mix(hdrColor, bloomColor, 0.04)` – bloomen *interpoleras*, adderas inte, och energin bevaras som när
  en lins sprider en del av allt ljus; ljusa saker glöder eftersom 4 % av mycket fortfarande är mycket.
- **Karis-medelvärdet**: bara i den första nedsamplingen viktas varje ruta med `1 / (1 + luma)` (luma av den till sRGB
  omvandlade färgen), så att en enda extrem pixel – en **eldfluga** – inte kan dominera; `max(…, 0.0001)` håller resultatet
  över noll.

:::opengl
- Ett framebuffer-objekt vars färg-attachment byts till nivån som ritas, `glViewport` per nivå; `GL_R11F_G11F_B10F`;
  `glBlendFunc(GL_ONE, GL_ONE)` för uppsamplingen.
:::
:::vulkan
- En framebuffers attachments är fasta, så **en framebuffer per nivå** och en descriptor set per nivå för att läsa den;
  `VK_FORMAT_B10G11R11_UFLOAT_PACK32`. Två kompatibla render passes: nedsamplingens (`loadOp DONT_CARE`) och
  uppsamplingens (`loadOp LOAD`, den adderar till nivån). Viewport och scissor per nivå; `srcResolution` i push
  constants på offset 80 (std430: en `vec2` är justerad till 8 byte).
:::
:::d3d12
- Inga framebuffer-objekt: varje nivå har en **RTV** (att rita i) och en **SRV** (att läsas), vilar i
  `PIXEL_SHADER_RESOURCE` och blir ett `RENDER_TARGET` med en barriär för sitt pass; `DXGI_FORMAT_R11G11B10_FLOAT`;
  uppsamplingens pipeline state blendar `ONE, ONE`; parametrarna som root constants.
:::

## Compute shaders

- **Compute shader**: ett program utanför grafikpipelinen – inga vertexar, ingen rastrerare – som körs som ett rutnät av
  **anrop** (invocations, trådar) i **arbetsgrupper** (trådgrupper). Gruppstorleken deklareras i shadern (10 × 10 × 1),
  antalet grupper anges med en **dispatch** (80 × 60 × 1 – ett anrop per texel i texturen på 800 × 600).
- **Id:n**: `gl_WorkGroupID` / `SV_GroupID`, `gl_LocalInvocationID` / `SV_GroupThreadID`, `gl_GlobalInvocationID` /
  `SV_DispatchThreadID` = grupp-id × gruppstorlek + lokalt id.
- **Arbetsgruppens storlek**: anropen körs i omgångar om 32 eller 64 (warps, wavefronts); riktig kod väljer multiplar av
  dem och avrundar antalet grupper uppåt. Grupper är oberoende och kan köras i vilken ordning som helst; anrop i samma
  grupp kan dela minne (`shared` / `groupshared`) och synkronisera.
- **Gränser**: grupper per dimension, gruppstorlek per dimension och anrop per grupp totalt – 1024 × 1024 × 1 ryms inom
  storlekarna per dimension men inte inom de 1024 anropen.
- **Bilder för load/store**: en textur som läses och skrivs med heltalskoordinater – `imageLoad` / `imageStore`,
  `RWTexture2D` – utan sampler, filtrering eller mipmaps; samma textur samplas också av fyrhörningen.
- **Barriären**: det compute shadern skriver ordnas inte automatiskt före senare läsningar – programmet måste låta ritandet
  vänta på dem och göra datan synlig.
- **Programmet**: rött som ökar åt höger, grönt uppåt, den röda rampen som flyttar sig 100 texlar per sekund och lindas med
  `mod` vid bredden. Vidare: delat minne för oskärpefilter, partiklar, culling och indirekta draw calls, skinning,
  tiled lighting.

:::opengl
- **OpenGL 4.3** (macOS stannar vid 4.1 – ingen compute där); ett program med en enda `GL_COMPUTE_SHADER`;
  `glDispatchCompute(80, 60, 1)`.
- Gränserna med `glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT / _SIZE, i, …)` och
  `GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS`.
- **Image units**: `glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_READ_WRITE, GL_RGBA32F)` – skilda från texture
  units, bara storleksbestämda format; `layout (rgba32f, binding = 0) uniform image2D`.
- **`glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`** – namngiven efter hur datan läses härnäst;
  `GL_TEXTURE_FETCH_BARRIER_BIT` täcker sampling och är det försiktiga tillägget.
:::
:::vulkan
- En **compute pipeline** (`vkCreateComputePipelines`: ett steg och en layout), bunden på `VK_PIPELINE_BIND_POINT_COMPUTE`;
  `vkCmdDispatch` före render passet; tiden som push constant.
- Gränserna från `VkPhysicalDeviceLimits` (garanterat bara 128 × 128 × 64 och 128 anrop).
- **Storage image**: `VK_IMAGE_USAGE_STORAGE_BIT`, en descriptor av typen `VK_DESCRIPTOR_TYPE_STORAGE_IMAGE`, bilden i
  **`VK_IMAGE_LAYOUT_GENERAL`** (skriva och sampla i samma layout); formatets features kontrolleras.
- En **image memory barrier** från compute shaderns skrivningar till fragment shaderns läsningar – steg och åtkomstmasker
  säger vem som väntar på vem.
:::
:::d3d12
- Ett **compute pipeline state** (`D3D12_COMPUTE_PIPELINE_STATE_DESC`: root signature och `CS`), en egen root signature,
  `SetComputeRoot…`-anrop, `Dispatch(80, 60, 1)` på den direkta command listen; tiden som root constant (`fmod`).
- Gränserna är API:ets konstanter: 65535 grupper per dimension, 1024 × 1024 × 64, 1024 trådar per grupp.
- En **unordered access view** (`RWTexture2D<float4>`, u0) på en textur med `ALLOW_UNORDERED_ACCESS`, bredvid SRV:n.
- En **övergångsbarriär** UNORDERED_ACCESS → PIXEL_SHADER_RESOURCE (och tillbaka nästa bildruta); en **UAV-barriär** mellan
  två compute-pass på samma UAV.
:::

## Ytljus

- **Ytljus** (area light): ljus från en yta – mjukare skuggning, och högdagrar med ljusets form. Belysningen är en
  integral över ljusets rymdvinkel.
- **Vektoriella formfaktorn**: för den **avklippta cosinusen** (Lambert) är integralen över en polygon exakt – varje kant
  av polygonen, projicerad på enhetssfären, bidrar med sin vinkel i kryssproduktens riktning; summans komponent längs
  normalen är det diffusa resultatet. `IntegrateEdgeVec` räknar θ / sin θ med en anpassad funktion i stället för `acos`.
- **Linjärt transformerade cosinusar** (Heitz, Dupuy, Hill och Neubelt, 2016): en avklippt cosinus vars riktningar
  transformeras med en matris M approximerar GGX-loben. Att integrera den över en polygon är detsamma som att integrera
  cosinusen över polygonen transformerad med **M⁻¹** – så shadern multiplicerar hörnen med M⁻¹ och använder den exakta
  kantformeln.
- **Tabellerna**: **LTC1** – de fyra icke-triviala elementen i M⁻¹, 64 × 64 över strävhet och `sqrt(1 − cos θ)`; **LTC2** –
  BRDF:ens storlek uppdelad för Fresnel (`specular *= F0 · t2.x + (1 − F0) · t2.y`) och, i w, den horisontklippta sfären
  som ersätter att klippa polygonen. Flyttalstexturer (ett `GL_RGBA` utan storlek skulle klippa till 0..1), inte vända,
  `LUT_SCALE` / `LUT_BIAS` på texlarnas mittpunkter.
- **Diffust**: M⁻¹ är identiteten; **spekulärt**: M⁻¹ från LTC1, skalad med LTC2 – en mjuk, utdragen spegling av
  rektangeln. Resultatet `color · intensity · (specular + diffuse · albedo)`, tvåsidiga ljus.
- **Flera ljus**: en grundrektangel placerad åtta gånger med `translate · rotate` – en ring av åtta färgade ljus, deras
  hörn satta en gång; uppslagningarna stannar utanför loopen. LTC har inga skuggor; metoden kan utvidgas till texturerade
  ljus, skivor och linjer.

:::opengl
- `GL_RGBA32F`-texturer på enhet 0 och 1, träet (sRGB) på enhet 2; ljusen som uniform-arrayer av structar – varje medlem
  i varje element har en egen location, så inga layoutregler gäller.
:::
:::vulkan
- `VK_FORMAT_R32G32B32A32_SFLOAT`-bilder via en staging-buffert; linjär filtrering av 32-bitars flyttal kontrolleras
  (`SAMPLED_IMAGE_FILTER_LINEAR_BIT`); en sampler kan inte ligga i ett uniformblock, så träet har en egen bindning.
- **std140**: i ett ljus börjar `color` (en `vec3`) på 16, hörnen är `vec4` med 16 byte emellan, en `bool` tar 4 byte, och
  structen avrundas uppåt till 112 byte – utskrivet i C++-spegeln.
:::
:::d3d12
- `DXGI_FORMAT_R32G32B32A32_FLOAT`-texturer uppladdade med `UpdateSubresources`, en statisk sampler
  `MIN_POINT_MAG_LINEAR_MIP_POINT`.
- `float3x3(a, b, c)` tar **rader** där GLSL:s `mat3` tar kolumner: `transpose(mat3(T1, T2, N))` är `float3x3(T1, T2, N)`.
- **HLSL:s packning**: `intensity` och `color` delar en rad, hörnen är `float4`, en struct i en cbuffer-array fyller hela
  rader – 96 byte.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| En blendfunktion per mål | `glBlendFunci` (4.0) | featuren `independentBlend` | `IndependentBlendEnable` |
| Rensa varje mål till sitt eget värde | `glClearBufferfv` | clear-värden per attachment | `ClearRenderTargetView` per RTV |
| Vertexattribut med heltal | `glVertexAttribIPointer` | `R32G32B32A32_SINT` | `BLENDINDICES`, `R32G32B32A32_SINT` |
| Ordningen i produkter av transformer | kolumnvektorer: `parent · local` | som OpenGL (GLM) | radvektorer: `local · parent` |
| NDC-djupet för frustumets hörn | −1..1 | 0..1 | 0..1 |
| Ett pass till alla kaskader | `invocations = 5`, `gl_Layer` | featuren `geometryShader`, `layers = 5` | `[instance(5)]`, `SV_RenderTargetArrayIndex` |
| Börja om en strip | `GL_PRIMITIVE_RESTART` | `primitiveRestartEnable` | `IBStripCutValue` |
| Tessellering tillgänglig | OpenGL 4.0 | featuren `tessellationShader` | alltid |
| Patch med 4 kontrollpunkter | `glPatchParameteri` + `GL_PATCHES` | `PATCH_LIST` + `patchControlPoints` | `4_CONTROL_POINT_PATCHLIST` |
| Nivåer per patch | `gl_TessLevelOuter/Inner` i anrop 0 | likadant | patch constant-funktionen |
| Trådmodell | `glPolygonMode(…, GL_LINE)` | `VK_POLYGON_MODE_LINE` + `fillModeNonSolid` | `D3D12_FILL_MODE_WIREFRAME` |
| Objekt namngivna i varje anrop | DSA (4.5) | alltid | alltid |
| Rendera i en kedja av nivåer | ett framebuffer-objekt, bytt attachment | en framebuffer per nivå | en RTV per nivå |
| Packat HDR-flyttalsformat | `GL_R11F_G11F_B10F` | `B10G11R11_UFLOAT_PACK32` | `R11G11B10_FLOAT` |
| Compute tillgängligt | OpenGL 4.3 | alltid (kö för grafik + compute) | alltid |
| Skrivbar bild | image unit, `image2D` | storage image, layouten `GENERAL` | UAV, `RWTexture2D` |
| Vänta på det compute skrivit | `glMemoryBarrier` | image memory barrier | övergångs- (eller UAV-) barriär |
| Uppslagstabeller i flyttal | `GL_RGBA32F` | `R32G32B32A32_SFLOAT` | `R32G32B32A32_FLOAT` |

Med den här delen klar har du gått igenom varje avsnitt på learnopengl.com, och dess gästartiklar också: transparens
utan sortering, animerade figurer, scener som organiseras och cullas, skuggor för stora vyer, terräng som förfinas på
GPU:n, OpenGL:s moderna objektmodell, en modern bloom, compute shaders och ytljus. Var och en är en startpunkt –
artiklarnas listor över hur man går vidare visar vart motorerna tar dem härnäst – och var och en har du nu skrivit i
{{api}}.
