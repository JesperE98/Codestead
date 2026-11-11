# Sammanfattning: I praktiken

Grattis, du har nått slutet av delen *I praktiken* – och av learnopengls huvudkurs. Du började med att lära dig hitta
fel: felkontrollerna, meddelandena från drivrutinen eller lagren, ett värde som skrivs ut som en färg, och verktygen som
fångar en bildruta. Du ritade text med FreeTypes glyfer. Och sedan byggde du ett helt spel, Hedgerow, steg för steg: en
spelloop med indata, en sprite-renderare med en ortografisk projektion, banor som laddas från textfiler, en racket och
en boll, kollisionsdetektering och kollisionshantering, ett spår av partiklar, efterbehandlingseffekter genom ett
multisamplat mål, power-ups, liv, en meny och en vinstskärm. Den här sidan är en ordlista över delens viktigaste
begrepp, kapitel för kapitel, som de genomgångar learnopengl.com har i slutet av sina delar. Använd den för att slå upp
saker, och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet den kommer från.

Det mesta av ett spel är logik som inte har med grafik-API:et att göra – loopen, kollisionerna, power-upsen, liven –, så
det mesta på den här sidan står utanför rutorna. Det som skiljer är hur {{api}} rapporterar fel och hur det ritar: OpenGL
har en felflagga och globalt tillstånd och kan rita varifrån som helst; Vulkan kontrollerar ingenting utan sitt
validation layer, och varje ritanrop är ett kommando som spelas in i en command buffer, med värdena per sprite som push
constants och pipelines gjorda för ett render pass och ett antal samples; Direct3D 12 kontrollerar ingenting utan sitt
debug layer, spelar in i en command list med root constants och descriptor tables, och låter programmet hålla reda på
resursernas tillstånd med barriärer. När du är klar kontrollerar provet i slutet av delen vad du har lärt dig.

## Felsökning

- **Visuella fel**: en svart skärm eller en felaktig bild ger inget meddelande av sig själv; GPU-kod har ingen konsol och
  inga brytpunkter. Verktygen: felkontroller, felsökningsmeddelanden, att skriva värden som färger, och
  bildrutefelsökare.
- **De två sorternas fel**: fel vid körning (slut på minne, en förlorad enhet, en fil som inte är en shader) rapporteras
  med returvärden; att *använda API:et fel* kontrolleras bara av OpenGL:s felflagga eller av ett valfritt lager.
- **Felsöka shaderutdata**: skriv en variabel som färgen – normaler, texturkoordinater (u rött, v grönt) – och läs av
  bilden. Färger begränsas till 0..1, så värden med tecken behöver `* 0.5 + 0.5`.
- **Referenskompilatorn**: `glslangValidator` kontrollerar GLSL mot specifikationen (steget från filändelsen, eller
  `-S vert`); kod som den avvisar bör man inte lita på någonstans.
- **Framebuffer-utdata**: visa ett render targets textur på en rektangel i ett hörn av fönstret.
- **Bildrutefelsökare**: RenderDoc (gratis, OpenGL, Vulkan, Direct3D), NVIDIA Nsight Graphics, PIX (Direct3D 12): fånga en
  bildruta, stega genom dess anrop, granska tillstånd, buffertar, texturer och en pixels historik. De visar objektens namn.

:::opengl
- **`glGetError`**: returnerar och nollställer felflaggan; när en flagga väl är satt registreras inga andra fel förrän den
  har lästs (på vissa system flera flaggor – läs den i en loop). Koder: `GL_INVALID_ENUM` 1280, `GL_INVALID_VALUE` 1281,
  `GL_INVALID_OPERATION` 1282, …, `GL_INVALID_FRAMEBUFFER_OPERATION` 1286.
- **`glCheckError()`**: learnopengls makro runt `glCheckError_(__FILE__, __LINE__)` – skriver ut felets namn och var det
  kontrollerades.
- **Debug output**: en del av kärnan i OpenGL 4.3 (`KHR_debug`); en 4.3-kontext (med `GLFW_OPENGL_DEBUG_CONTEXT`) kör
  3.3 core-kod oförändrad; macOS stannar vid 4.1, utan den. `glDebugMessageCallback(glDebugOutput, nullptr)`,
  meddelandets källa, typ, id och allvarlighetsgrad; `GL_DEBUG_OUTPUT_SYNCHRONOUS` anropar den inne i det skyldiga
  anropet, så en brytpunkt i callbacken visar anropsstacken; `glDebugMessageControl` filtrerar. `glObjectLabel` namnger
  objekt, `glPushDebugGroup` / `glPopDebugGroup` markerar avsnitt.
- **Projektets fel**: `glUniform*` utan program i bruk (`GL_INVALID_OPERATION`: projektionen förblir noll – ingen kub),
  och `glTexImage2D(GL_FRAMEBUFFER, …)` (`GL_INVALID_ENUM`: en ofullständig textur samplas som svart).
:::
:::vulkan
- **`VkResult`**: det som ett anrop som kan misslyckas vid körning returnerar; felaktig användning är odefinierat beteende
  och kontrolleras inte.
- **Validation layer** `VK_LAYER_KHRONOS_validation` kontrollerar varje anrop mot specifikationens regler för *valid
  usage* och skickar meddelanden till **debug messengern** (`VK_EXT_debug_utils`, `debugCallback`): allvarlighetsgrad
  (verbose, info, warning, error – bitar i ordning, så en jämförelse filtrerar), typ (general, validation, performance),
  VUID:t, objekten. Callbacken returnerar `VK_FALSE`.
- **Objektnamn** med `vkSetDebugUtilsObjectNameEXT` (laddas med `vkGetInstanceProcAddr`), **etiketter** med
  `vkCmdBeginDebugUtilsLabelEXT` / `vkCmdEndDebugUtilsLabelEXT`.
- **Projektets fel**: en indata i vertexshadern vid location 1 som pipelinen inte beskriver
  (`VUID-VkGraphicsPipelineCreateInfo-Input-07904`); shadern läste (0, 0) och kuben blev enfärgat brun.
- Mer i lagret: synchronization validation, GPU-assisted validation, best practices, debug printf (`vkconfig`).
:::
:::d3d12
- **`HRESULT`** och `ThrowIfFailed` för anrop som kan misslyckas vid körning; `void`-anropen (vyer, command list)
  kontrolleras bara av **debug layer** (ett debug-bygge, Windows Graphics Tools).
- **Info queue** `ID3D12InfoQueue` (från enheten med `As`): lagrade meddelanden med kategori, allvarlighetsgrad
  (`CORRUPTION`, `ERROR`, `WARNING`, `INFO`, `MESSAGE`), ID och text; `GetMessage` två gånger (storleken, sedan
  meddelandet), `ClearStoredMessages`. `CheckDebugMessages()` är learnopengls `glCheckError()`.
- **`ID3D12InfoQueue1::RegisterMessageCallback`**: learnopengls debug output – anropas vid det skyldiga anropet;
  `SetBreakOnSeverity` bryter in i debuggern där (bara med `IsDebuggerPresent()`); filter för lagring och hämtning.
- **`SetName`** ger objekt namn som meddelandena och PIX använder. **GPU-based validation** och **DRED** för det som lagret
  på CPU-sidan inte kan se och för krascher där enheten tas bort.
- **Projektets fel**: ingen `SetDescriptorHeaps` före descriptor tables (inget ritas), och en SRV med `MipLevels` 0 (en
  ogiltig vy, som läses som svart).
:::

## Textrendering

- **Bitmappstypsnitt**: alla glyfer förrastrerade i en textur, var och en i sin cell; snabbt och enkelt, men en storlek och
  en liten teckenuppsättning.
- **FreeType**: laddar TrueType- och OpenType-typsnitt – glyfer som kurvor (splines) – och rastrerar dem i vilken
  pixelstorlek som helst. `FT_Init_FreeType`, `FT_New_Face`, `FT_Set_Pixel_Sizes(face, 0, size)` (em-storleken, bredden
  från höjden), `FT_Load_Char(face, c, FT_LOAD_RENDER)`: en grå 8-bitars bitmapp i `face->glyph->bitmap`; `FT_Done_Face`,
  `FT_Done_FreeType`. Varje anrop returnerar något annat än noll vid fel.
- **Glyfmått**: storleken (`bitmap.width`, `bitmap.rows`), **bearing** (`bitmap_left`, `bitmap_top`: från origo på
  **baslinjen** till bitmappens vänsterkant och överkant), **advance** (`advance.x`, i 1/64 pixel: `>> 6`).
- **`Character`** (textur eller plats i atlasen, storlek, bearing, advance) i en `std::map<char, Character>` för de första
  128 ASCII-tecknen.
- **RenderText**: per tecken en rektangel vid `x + bearing.x · scale`, `y − (size.y − bearing.y) · scale` (y uppåt), i
  glyfens storlek; sedan `x += (advance >> 6) · scale`. Textshadern använder den röda kanalen som alfa:
  `vec4(textColor, 1.0) * vec4(1.0, 1.0, 1.0, texture(text, TexCoords).r)`, med alfablending.
- **Kursens typsnitt**: Inter Bold (SIL Open Font License, `OFL.txt` bredvid; learnopengl: Antonio Bold); kursens
  kontroller har dess glyfer i 24 och 48 pixlar. Vidare: typsnitt med **signed distance fields** förblir skarpa i alla
  skalor.

:::opengl
- **En textur per glyf**: `GL_RED`, `GL_CLAMP_TO_EDGE`, `GL_LINEAR`, och `glPixelStorei(GL_UNPACK_ALIGNMENT, 1)` – en
  glyfs rader är lika många byte som den är bred, inte en multipel av 4.
- **En dynamisk rektangel**: en VBO med 6 × 4 floats (`GL_DYNAMIC_DRAW`), som skrivs om med `glBufferSubData` och ritas
  för varje tecken.
:::
:::vulkan
- **En glyfatlas**: en bild kan inte vara 0 × 0 (mellanslaget), och 128 bilder med descriptor sets vore många; bitmapparna
  kopieras rad för rad (`pitch`) till celler i en enda `VK_FORMAT_R8_UNORM`-bild, som laddas upp genom en staging buffer.
- **Varje rektangel sin egen plats**: GPU:n läser vertexbufferten när command buffern körs, så varje teckens rektangel
  skrivs efter de andra (en host-visible buffert, mappad) och ritas från sitt första hörn.
:::
:::d3d12
- **En glyfatlas**: en textur kan inte vara 0 × 0 (mellanslaget), och 128 texturer med descriptors vore många;
  bitmapparna kopieras rad för rad (`pitch`) till celler i en enda `DXGI_FORMAT_R8_UNORM`-textur, som laddas upp med
  `UpdateSubresources`.
- **Varje rektangel sin egen plats**: GPU:n läser vertexbufferten när command listen körs, så varje teckens rektangel
  skrivs efter de andra, och en rad är en `DrawInstanced`.
:::

## Spelet: förberedelser och spritar

- **Hedgerow**: kursens spel av learnopengls sort – en racket, en boll och en vägg av block i en trädgård i skymningen;
  fyra banor, power-ups, liv. learnopengls klasser skrivs som **structar och fria funktioner** i en `main.cpp`.
- **Spelloopen**: varje bildruta `deltaTime` (tiden sedan förra bildrutan), händelserna, sedan `ProcessInput`, `Update`,
  `Render`. Kursens tid är fast: bildruta n ser n / 60 s; den enda indata är mellanslag i bildrutorna 30–32.
- **Indata**: tangentcallbacken sparar `Keys[1024]`; `ProcessInput` läser dem varje bildruta.
- **Spelets tillstånd**: `GAME_ACTIVE`, `GAME_MENU`, `GAME_WIN`.
- **Resurshanteraren**: `LoadShader` / `GetShader`, `LoadTexture` / `GetTexture`, `ClearResources` – mappar med
  namngivna shadrar och texturer.
- **Den ortografiska projektionen**: fönstrets pixlar, (0, 0) uppe till vänster, y nedåt – learnopengls `glm::ortho(0,
  800, 600, 0, -1, 1)`; ingen vymatris.
- **Sprite-renderaren**: en rektangel (`vec4`: position 0..1 och texturkoordinater) och `DrawSprite(texture, position,
  size, rotate, color)`; modell = translate(position) · translate(½ size) · rotate · translate(−½ size) · scale(size) –
  rotationen kring mitten, läst från höger till vänster. Shadern: `vec4(spriteColor, 1.0) * texture(image, TexCoords)` –
  färgen tonar de ljusa texturerna.

:::opengl
- Shaderns `model` och `spriteColor` är uniforms som sätts per sprite; projektionen sätts en gång.
:::
:::vulkan
- `model` och `spriteColor` är **push constants** (76 byte, vertex- och fragmentsteget); projektionen finns i uniform
  buffern, `glm::ortho(0, 800, 0, 600, -1, 1)` – Vulkans clip space y pekar redan nedåt.
- `DrawSprite` spelar in i den command buffer som `recordCommandBuffer` lämnar till renderaren; texturen är dess descriptor
  set. Funktioner som behöver enheten (`Init`, `LoadShader`, `LoadTexture`, `InitRenderData`) är medlemmar i
  applikationsklassen.
:::
:::d3d12
- `model` och `spriteColor` är **root constants** (19 värden, root parameter 0); projektionen finns i konstantbufferten
  (`XMMatrixOrthographicOffCenterRH(0, Width, Height, 0, -1, 1)`), texturen är en descriptor table (dess ID är dess plats i
  heapen), samplern en statisk.
- DirectXMath multiplicerar radvektorer: modellmatrisen skrivs med skalningen först och förflyttningen sist. Tangenter kommer
  i `OnKeyDown` / `OnKeyUp` som virtual-key-koder.
:::

## Banor, boll och kollisioner

- **GameObject**: position, storlek, hastighet, färg, rotation, `IsSolid`, `Destroyed`, sprite. **GameLevel**: dess
  `Bricks`.
- **Banfiler**: rader med tal – 0 tomt, 1 solitt (en sten), 2–5 färgade block; 15 × 8 här, i fönstrets övre halva:
  enhetsstorlek = 800 / 15 × 300 / 8. `IsCompleted`: alla block som inte är solida är förstörda.
- **Racketen**: 100 × 20 nedtill, 500 pixlar per sekund med A och D, hålls inne i fönstret.
- **Bollen**: ett GameObject med `Radius` 12,5 och `Stuck`; hastighet (100, −350); mellanslag släpper den; `Move` studsar
  den mot vänster, höger och övre vägg. Med de fasta indata studsar den mot stenen (5, 9) i bildruta 86 och tappas i
  bildruta 151.
- **AABB – AABB**: två lådor överlappar om de överlappar på båda axlarna.
- **AABB – cirkel**: begränsa vektorn från lådans mitt till cirkelns mitt till lådans halva utsträckning – det ger lådans
  **närmaste punkt** –; en kollision om den ligger närmare än radien.
- **Kollisionshantering**: `VectorDirection` – den kompassriktning (upp, höger, ned, vänster) som har störst skalärprodukt
  med differensvektorn; flytta ut bollen med **inträngningen** (radien − |differensen| på den axeln) och vänd den
  hastighetskomponenten. Solida block står kvar, andra förstörs.
- **Studsen mot racketen**: träffens avstånd från racketens mitt bestämmer den nya x-hastigheten (`strength` 2), farten
  behålls (`normalize · length`), och y pekar alltid uppåt – lösningen för en boll som fastnat i racketen.
- **Tappa bollen**: nedanför fönstret → återställ banan och spelaren (från `render-text`: ett liv).

## Partiklar

- **Partikel**: position, hastighet, färg, liv. **Sändare / generator**: skapar partiklar som tynar bort; här 500
  partiklar, 2 nya per bildruta vid bollen, förskjutna med halva dess radie.
- **`firstUnusedParticle`**: letar från den senast använda, sedan från början; om ingen är död skrivs den första över.
  **`respawnParticle`**: en slumpmässig förskjutning (±5 px) och ljusstyrka (0,5…1,5), liv 1, bollens hastighet × 0,1.
- **Update**: liv −= dt; en levande partikel rör sig mot sin hastighet och bleknar (`alpha −= dt · 2.5`).
- **Additiv blending**: `GL_SRC_ALPHA, GL_ONE` – partiklarna adderas till ett sken; ritas efter racketen och före bollen.
  `rand()` utan `srand`: samma tal varje körning.

:::opengl
- `glBlendFunc(GL_SRC_ALPHA, GL_ONE)` före partiklarna, tillbaka till `GL_ONE_MINUS_SRC_ALPHA` efter dem: blending är
  globalt tillstånd.
:::
:::vulkan
- En andra pipeline, som bara skiljer sig i blendfaktorn för målfärgen (`VK_BLEND_FACTOR_ONE`): att binda en pipeline
  sätter hela dess tillstånd, inget följer med. Partikelns förskjutning och färg är push constants.
:::
:::d3d12
- En andra pipeline state, som bara skiljer sig i målets blend (`D3D12_BLEND_ONE`): att sätta en pipeline state sätter
  hela dess tillstånd, inget följer med. Partikelns förskjutning och färg är root constants.
:::

## Efterbehandling

- **Idén**: rendera spelet till en **multisamplad** färgbuffert (4 samples per pixel, inget djup), **lös upp** den till en
  textur (varje pixel medelvärdet av sina samples: kantutjämnade kanter), och rita texturen på en skärmrektangel med
  efterbehandlingsshadern.
- **Effekterna**: **shake** – rektangeln flyttad med `cos(time · 10), cos(time · 15) · 0.01` och kärnan för
  **oskärpa**; **confuse** – texturkoordinaterna `1 − t` (upp och ned, spegelvänt) och `1 − färg`; **chaos** –
  koordinater som cirklar med `(sin, cos)(time) · 0.3`, en upprepande textur och kärnan för **kantdetektering**. 9 samples
  1/300 isär. Chaos vinner över confuse; shake kan kombineras med båda.
- **ShakeTime**: en träff på ett solitt block sätter den till 0,05 s och `Shake`; `Update` räknar ned den – bildrutorna 86
  och 87.

:::opengl
- `MSFBO` med en `GL_RGB`-renderbuffer med 4 samples; `FBO` med en textur; `glBlitFramebuffer(…, GL_COLOR_BUFFER_BIT,
  GL_NEAREST)` löser upp (lika stora rektanglar); `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. Kärnorna är uniforms som sätts
  en gång (`glUniform2fv(…, 9, (float*)offsets)`); shadrarna bryr sig inte om antalet samples.
:::
:::vulkan
- Ett render pass utanför skärmen: en `MSImage` med 4 samples (transient, storeOp DONT_CARE) och `Texture` som subpassets
  **resolve-attachment** (final layout `SHADER_READ_ONLY_OPTIMAL`); två subpass dependencies. `EndRender` avslutar det och
  börjar fönstrets pass.
- Pipelines hör till ett render pass och ett antal samples: spritarnas och partiklarnas för `Effects.RenderPass` med 4
  samples, så efterbehandlaren skapas först. Värdena per bildruta är push constants, kärnorna en uniform buffer (std140:
  arrayelement som `vec4`). Clip space y och v pekar nedåt: två tecken byts i vertexshadern.
:::
:::d3d12
- `MSRenderTarget` (`SampleDesc.Count` 4, dess RTV i en egen RTV-heap) och en `Texture` med ett sample;
  `ResolveSubresource` mellan barriärer (`RESOLVE_SOURCE`, `RESOLVE_DEST` och tillbaka); sedan back bufferns RTV
  (`Graphics.BackBufferRtv`). En swapkedja med flip-modellen kan ändå inte vara multisamplad.
- En PSO ritar bara i mål med dess `SampleDesc.Count`: sprite- och partikelshadrarna med 4. Värdena per bildruta är root
  constants, kärnorna `static const`-arrayer i HLSL. v pekar nedåt: ett tecken byts.
:::

## Power-ups, ljud och text

- **PowerUp**: ett GameObject med `Type`, `Duration` och `Activated`; 60 × 20, faller med 150 px/s. Speed (+20 %),
  sticky, pass-through, pad-size-increase (+50 px), confuse, chaos; 1 på 75 för de positiva, 1 på 15 för de negativa, vid
  ett förstört block. Varaktighet 0: permanent.
- **`UpdatePowerUps`**: flytta, räkna ned, slå av effekten om inte **`IsOtherPowerUpActive`**; ta bort de förstörda och
  inaktiva med **erase-remove-idiomet** (`std::remove_if` med en **lambda**, sedan `erase`).
- **Aktivering**: nedanför fönstret → förstörd; fångad av racketen (AABB-versionen av `CheckCollision`) →
  `ActivatePowerUp`, förstörd, aktiverad. Sticky: `Ball.Stuck = Ball.Sticky` efter studsen mot racketen; pass-through:
  ingen kollisionshantering för block som inte är solida. `ResetPlayer` slår av allt.
- **Testet**: inget block går sönder med de fasta indata, så en power-up av varje sort lades in för hand; i bildruta 161
  fångar racketen pad-size-increase och sedan – nu bredare – confuse.
- **Ljud**: inget grafik-API spelar ljud. learnopengl använder **irrKlang** (`createIrrKlangDevice`,
  `play2D(file, loop)`, `drop`; gratis bara för icke-kommersiellt bruk): musik som upprepas i `Init`, effekter i
  `DoCollisions`. Alternativ: OpenAL Soft, miniaudio, SDL_mixer, XAudio2 på Windows. Kursen kan inte kontrollera ljud.
- **Spelets text**: en projektion med y nedåt, så (x, y) är textens övre vänstra hörn: `ypos = y +
  (Characters['H'].Bearing.y − ch.Bearing.y) · scale`. 24 pixlar; "Lives:" vid (5, 5), efter efterbehandlingsrektangeln.
- **Liv**: 3; en tappad boll kostar ett; vid 0 återställs banan och spelet går tillbaka till menyn.
- **Menyn**: W / S väljer bana (`(Level + 1) % 4`), ENTER startar; **`KeysProcessed`** gör att varje tryck räknas en gång,
  nollställs vid släpp. **Vinst**: `IsCompleted` → återställning, chaos, `GAME_WIN`; ENTER tillbaka till menyn.
- **Slutord**: spriteatlaser, instansiering, triangle strips, rumsuppdelning, färre tillståndsbyten.

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Felaktig användning rapporteras av | `glGetError`, debug output | validation layer, debug messenger | debug layer, info queue |
| Meddelande vid det skyldiga anropet | `GL_DEBUG_OUTPUT_SYNCHRONOUS` | messengerns callback | `RegisterMessageCallback`, `SetBreakOnSeverity` |
| Namnge objekt | `glObjectLabel` | `vkSetDebugUtilsObjectNameEXT` | `SetName` |
| Glyfer | en `GL_RED`-textur var | en atlasbild `R8_UNORM` | en atlastextur `R8_UNORM` |
| En sprites modell och färg | uniforms | push constants | root constants |
| En sprites textur | `glBindTexture` | dess descriptor set | en descriptor table (plats i heapen) |
| Projektion, y nedåt | `glm::ortho(0, 800, 600, 0, …)` | `glm::ortho(0, 800, 0, 600, …)` | `XMMatrixOrthographicOffCenterRH(0, 800, 600, 0, …)` |
| Additiva partiklar | `glBlendFunc` ändras och återställs | en andra pipeline | en andra PSO |
| Multisamplat mål | renderbuffer, 4 samples | bild, `VK_SAMPLE_COUNT_4_BIT` | textur, `SampleDesc.Count` 4 |
| Resolve | `glBlitFramebuffer` | resolve-attachment | `ResolveSubresource` + barriärer |
| Shadrarnas antal samples | behövs inte | i pipelinen | i PSO:n |
| Textrektanglar i en bildruta | en rektangel, skrivs om per tecken | var sin plats, ett ritanrop per tecken | var sin plats, ett ritanrop per rad |
| Ljud | ett annat bibliotek | ett annat bibliotek | ett annat bibliotek (XAudio2) |

Med den här delen klar har du använt det kursen lärde ut i ett komplett program: du vet hur man hittar ett fel när bilden
är fel, hur man ritar text, och hur ett spel sätts ihop av en loop, spritar, kollisioner, partiklar och effekter.
learnopengls sista ord gäller för varje API: ta de här teknikerna, kombinera och ändra dem, och bygg ditt eget.
