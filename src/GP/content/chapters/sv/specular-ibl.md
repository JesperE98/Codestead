# Spekulär IBL

I förra kapitlet satte vi upp PBR tillsammans med bildbaserad belysning genom att räkna ut en irradiansmap i förväg som
belysningens indirekta diffusa del. I det här kapitlet fokuserar vi på reflektansekvationens spekulära del:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  ks · (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Du märker att Cook-Torrances spekulära del (multiplicerad med ks) inte är konstant över integralen: den beror på den
inkommande ljusriktningen, men också på vyriktningen. Att försöka lösa integralen för alla inkommande ljusriktningar och
alla möjliga vyriktningar är en kombinatorisk överbelastning och alldeles för dyrt att räkna ut i realtid. Epic Games
föreslog en lösning där de, med några kompromisser, kunde förkonvolvera den spekulära delen för realtidsbruk:
*split sum-approximationen*.

Split sum-approximationen delar upp reflektansekvationens spekulära del i två separata delar som vi kan konvolvera var
för sig och sedan kombinera i PBR-shadern för spekulär indirekt bildbaserad belysning. Precis som när vi förkonvolverade
irradiansmappen behöver split sum-approximationen en HDR-environment map som indata till konvolutionen. För att förstå
split sum-approximationen tittar vi igen på reflektansekvationen, men den här gången på den spekulära delen:

```text
  Lo(p, ωo) = ∫Ω  ks · (D · F · G) / (4 · (ωo · n) · (ωi · n)) · Li(p, ωi) · (n · ωi)  dωi
            = ∫Ω  fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi)  dωi
```

Av samma (prestanda)skäl som vid irradianskonvolutionen kan vi inte lösa integralens spekulära del i realtid och vänta oss
rimlig prestanda. Helst skulle vi alltså räkna ut integralen i förväg och få något som en spekulär IBL-map, sampla den
med fragmentets normal och vara klara. Men här blir det lite knepigt. Irradiansmappen kunde vi räkna ut i förväg eftersom
integralen bara berodde på ωi och vi kunde flytta ut de konstanta diffusa albedotermerna ur integralen. Den här gången
beror integralen på mer än bara ωi, vilket syns i BRDF:en: också på vyriktningen ωo och strävheten. Att räkna ut alla
möjliga kombinationer av ωi och ωo i förväg är inte praktiskt i realtid.

Epic Games split sum-approximation löser problemet genom att dela upp förberäkningen i 2 separata delar som vi senare kan
kombinera till det förberäknade resultat vi är ute efter. Split sum-approximationen delar den spekulära integralen i två
separata integraler:

```text
  Lo(p, ωo) ≈ ∫Ω Li(p, ωi) dωi  ·  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi
```

Den första delen (konvolverad) kallas den *förfiltrerade environment mappen* (pre-filtered environment map), som
(liksom irradiansmappen) är en förberäknad konvolution av omgivningen, men den här gången med strävheten inräknad. För
ökande strävhet konvolveras environment mappen med mer utspridda samplingsvektorer, vilket ger suddigare reflektioner.
För varje strävhetsnivå vi konvolverar lagrar vi de allt suddigare resultaten i den förfiltrerade mappens mipnivåer.

Vi genererar samplingsvektorerna och hur utspridda de är med Cook-Torrance-BRDF:ens normalfördelningsfunktion (NDF), som
tar både en normal och en vyriktning som indata. Eftersom vi inte vet vyriktningen i förväg när vi konvolverar environment
mappen gör Epic Games ytterligare en approximation och antar att vyriktningen (och därmed den spekulära
reflektionsriktningen) är lika med den utgående samplingsriktningen ωo. I kod blir det:

```glsl
vec3 N = normalize(w_o);
vec3 R = N;
vec3 V = R;
```

På så sätt behöver den förfiltrerade konvolutionen inte känna till vyriktningen. Det betyder att vi inte får snygga
spekulära reflektioner i strykande vinkel när vi tittar snett på ytan; det brukar dock anses vara en godtagbar
kompromiss.

Den andra delen av split sum-ekvationen är lika med BRDF-delen av den spekulära integralen. Om vi låtsas att den
inkommande radiansen är helt vit från alla håll (alltså L(p, x) = 1.0) kan vi räkna ut BRDF:ens svar i förväg för en given
strävhet och en given vinkel mellan normalen n och ljusriktningen ωi, eller n · ωi. Epic Games lagrar BRDF:ens
förberäknade svar för varje kombination av normal och ljusriktning och för olika strävhet i en 2D-uppslagstextur (LUT)
som kallas *BRDF-integrationsmappen*. Uppslagstexturen ger en skala (röd) och en förskjutning, bias (grön), för ytans
Fresnel-svar, och det är den spekulära integralens andra del.

Vi genererar uppslagstexturen genom att behandla den vågräta texturkoordinaten (mellan 0.0 och 1.0) på ett plan som
BRDF:ens indata n · ωi, och den lodräta texturkoordinaten som indata för strävheten. Med BRDF-integrationsmappen och den
förfiltrerade environment mappen kan vi kombinera båda och få den spekulära integralens resultat:

```glsl
float lod             = getMipLevelFromRoughness(roughness);
vec3 prefilteredColor = textureCubeLod(PrefilteredEnvMap, refVec, lod);
vec2 envBRDF          = texture2D(BRDFIntegrationMap, vec2(NdotV, roughness)).xy;
vec3 indirectSpecular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
```

(Det är Epics pseudokod; kapitlets shader har sina riktiga rader längre fram.) Det här ger en överblick över hur Epic
Games split sum-approximation ungefär angriper den indirekta spekulära delen av reflektansekvationen. Nu ska vi bygga de
förkonvolverade delarna själva.

```quiz
Vad delar split sum-approximationen upp den spekulära integralen i?
- [ ] En del för metallsfärerna och en för de icke-metalliska
- [ ] De fyra punktljusens direkta ljus och omgivningens indirekta ljus
- [x] En förfiltrerad environment map – omgivningens ljus konvolverat med GGX-loben för flera strävhetsnivåer, med antagandet n = v = r – och en 2D-BRDF-integrationsmap som för varje NdotV och strävhet innehåller en skala och en förskjutning för F0; shadern multiplicerar de två
- [ ] Omgivningens röda och gröna kanal, som filtreras var för sig
---
Hela integralen beror på vyriktningen och strävheten liksom på ljusriktningen – för många indata för att tabellera. Produkten av två integraler, var och en med bara två indata utöver riktningen, kan lagras i en cube map med mipnivåer och i en liten 2D-textur.
```

## Projektet

Projektet börjar i slutet av förra kapitlet: de 7 × 7 röda sfärerna, belysta direkt av de fyra punktljusen och indirekt
av irradiansmappen, framför omgivningen. Nytt i det:

- **Skärmfyrhörningen**, learnopengls `renderQuad()` från de tidigare kapitlen: två trianglar som täcker render targeten,
  med texturkoordinater från 0 till 1 – för BRDF-integrationsmappen.
- Shadrarna **`prefilter`** och **`brdf`** med TODO. Förfiltershadern har redan `DistributionGGX` och Hammersley-
  sekvensens två funktioner (`RadicalInverse_VdC` och `Hammersley`), BRDF-shadern Hammersley-funktionerna;
  skärmfyrhörningens vertex shader är färdig.
- **En debug-shader** som visar en textur med två kanaler på skärmfyrhörningen (`vec4(texture(image, TexCoords).rg, 0.0,
  1.0)`), för att titta på BRDF-integrationsmappen en stund.
- Materialets fem mappar för den sista uppgiften.

Tre tal är mindre än learnopengls, eftersom den inbyggda simulatorn körs på processorn (en riktig GPU klarar learnopengls
värden lätt): förfiltermappen har 64 × 64 texlar per sida i stället för 128 × 128 (fortfarande med 5 mipnivåer),
förfilterkonvolutionen och BRDF-integrationen tar 128 samples i stället för 1024, och BRDF-integrationsmappen är 128 × 128
i stället för 512 × 512.

:::opengl
Filerna är `prefilter.fs`, `brdf.vs` (färdig), `brdf.fs`, `debug_quad.fs` (färdig) och de fem `.png`-mapparna;
`renderQuad()` ritar en triangle strip med 4 vertex, med texturkoordinaterna (0, 0) nere till vänster och (1, 1) uppe
till höger.
:::
:::vulkan
Filerna är `shaders/prefilter.frag`, `shaders/brdf.vert` (färdig), `shaders/brdf.frag`, `shaders/debug_quad.frag` (färdig)
och de fem mapparna i `textures/`. Skärmfyrhörningen är vertex 36–41 i den globala `vertices` (learnopengls fyrhörning som
två trianglar, med oförändrade texturkoordinater) och `renderQuad(VkCommandBuffer)` ritar den: `vkCmdDraw(commandBuffer,
6, 1, 36, 0)`.
:::
:::d3d12
Filerna är `prefilter.hlsl` (dess `cbuffer CaptureConstants` har en `float roughness` efter de två matriserna),
`brdf.hlsl` (`VSMain` färdig), `downsample.hlsl` (`PSMain` TODO: den gör en mipnivå av nivån ovanför – mer nedan),
`debug_quad.hlsl` (färdig) och de fem `.png`-mapparna. Skärmfyrhörningen är vertex 36–39 i `m_cubeVertexBuffer`, en
triangle strip som ritas av `RenderQuad()` (`IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)`,
`DrawInstanced(4, 1, 36, 0)`); dess texturkoordinater är learnopengls med v vänt: (0, 0) **uppe** till vänster,
(1, 1) nere till höger.
:::

## Att förfiltrera en HDR-environment map

Att förfiltrera en environment map liknar mycket hur vi konvolverade irradiansmappen. Skillnaden är att vi nu tar hänsyn
till strävheten och lagrar allt strävare reflektioner i den förfiltrerade mappens mipnivåer.

Först behöver vi en ny cube map som rymmer den förfiltrerade environment mappens data. För att se till att vi reserverar
tillräckligt minne för dess mipnivåer skapar vi den med alla nivåer:

:::opengl
```cpp
    unsigned int prefilterMap;
    glGenTextures(1, &prefilterMap);
    glBindTexture(GL_TEXTURE_CUBE_MAP, prefilterMap);
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 64, 64, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR); // be sure to set minification filter to mip_linear
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // generate mipmaps for the cubemap so OpenGL automatically allocates the required memory.
    glGenerateMipmap(GL_TEXTURE_CUBE_MAP);
```

Eftersom vi tänker sampla `prefilterMap`:s mipmaps måste minifieringsfiltret vara `GL_LINEAR_MIPMAP_LINEAR`, så att
trilinjär filtrering är påslagen. `glGenerateMipmap` anropas här bara för att reservera nivåerna: varenda en av dem
renderas efteråt.
:::
:::vulkan
```cpp
        createCubemap(64, 5, prefilterImage, prefilterImageMemory, prefilterImageView);
```

`createCubemap` skickar `mipLevels` till bilden och till kubvyn, som därför täcker alla fem nivåerna; samplern
`clampSampler` filtrerar redan linjärt mellan mipnivåer, så att sampla den med en nivå med decimaler är trilinjär
filtrering.
:::
:::d3d12
```cpp
        CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16B16A16_FLOAT, 64, 64, 6, 5, 1, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
```

– sex array-skivor med fem mipnivåer var, skapade i `RENDER_TARGET`. Dess `TEXTURECUBE`-SRV på heap-plats 4 har
`MipLevels = 5`, och den statiska samplern s0 (`MIN_MAG_MIP_LINEAR`) filtrerar mellan nivåerna: trilinjär filtrering.
:::

Vi lagrar de förfiltrerade spekulära reflektionerna i nivåerna: nivå `mip` innehåller omgivningen suddad för strävheten
`mip / 4`, från 0 (64 × 64, en skarp reflektion) till 1.0 (4 × 4, helt sträv). Ju suddigare reflektionen är, desto mindre
upplösning behöver den, så de krympande mipnivåerna passar bra.

I förra kapitlet konvolverade vi environment mappen genom att generera samplingsvektorer jämnt fördelade över halvsfären Ω
med sfäriska koordinater. Det fungerar utmärkt för irradians, men för spekulära reflektioner är det mindre effektivt.
Vid spekulära reflektioner reflekteras ljuset, beroende på ytans strävhet, tätt eller brett kring en reflektionsvektor r
runt en normal n, men (om ytan inte är extremt sträv) ändå kring reflektionsvektorn. Den allmänna formen på möjliga
utgående ljusreflektioner kallas *spekulär lob* (specular lobe). När strävheten ökar blir loben större, och lobens form
ändras med den inkommande ljusriktningen. Lobens form beror alltså starkt på materialet.

I mikroytmodellen kan vi föreställa oss den spekulära loben som reflektionsriktningen kring mikrofasetternas
halvvägsvektorer för en given inkommande ljusriktning. Eftersom de flesta ljusstrålar hamnar i en spekulär lob, reflekterade
kring mikrofasetternas halvvägsvektorer, är det rimligt att generera samplingsvektorerna på liknande sätt, annars skulle
de flesta gå till spillo. Den processen kallas *importance sampling* (viktad sampling).

### Monte Carlo-integration och importance sampling

För att riktigt förstå importance sampling behöver vi först titta på den matematiska konstruktion som kallas *Monte
Carlo-integration*. Monte Carlo-integration bygger mest på en kombination av statistik och sannolikhetsteori. Monte Carlo
hjälper oss att diskret lösa problemet att ta reda på en statistisk storhet eller ett värde för en population utan att
behöva ta med *hela* populationen.

Säg till exempel att du vill räkna ut medellängden hos alla invånare i ett land. För att få ditt resultat kan du mäta
varje invånare och ta medelvärdet av deras längd, vilket ger exakt det svar du söker. Men eftersom de flesta länder har en
ansenlig befolkning är det inte realistiskt: det skulle ta för mycket arbete och tid.

Ett annat sätt är att välja en mycket mindre, helt slumpmässig (opartisk) delmängd av befolkningen, mäta deras längd och ta
medelvärdet. Delmängden kan vara så liten som 100 personer. Även om svaret inte är lika exakt som det exakta svaret får du
ett svar som ligger ganska nära sanningen. Det kallas *de stora talens lag*. Tanken är att om du mäter en mindre mängd
av storleken N med verkligt slumpmässiga samples ur hela befolkningen kommer resultatet att ligga ganska nära det rätta
svaret, och det kommer närmare ju större N är.

Monte Carlo-integration bygger på de stora talens lag och använder samma angreppssätt för att lösa en integral. I stället
för att lösa integralen för alla möjliga (teoretiskt oändligt många) samplingsvärden x genererar man helt enkelt N
samplingsvärden slumpmässigt valda ur hela populationen och tar medelvärdet. När N ökar får vi garanterat ett resultat
närmare integralens exakta svar:

```text
                                       1    N−1  f(xi)
  O  =  ∫(a..b) f(x) dx   ≈   ---  ·   Σ    -------
                                       N    i=0  pdf(xi)
```

För att lösa integralen tar vi N slumpmässiga samples över populationen a till b, lägger ihop dem och delar med det totala
antalet samples för att få medelvärdet. pdf står för *probability density function* (täthetsfunktion), som anger
sannolikheten att ett visst sample förekommer i hela samplingsmängden. Täthetsfunktionen för en befolknings längd skulle
till exempel visa att längder kring medelvärdet är mycket vanligare än mycket korta eller mycket långa.

I Monte Carlo-integration kan vissa samples ha högre sannolikhet att genereras än andra. Därför delar eller multiplicerar
vi i varje allmän Monte Carlo-skattning det samplade värdet med samplets sannolikhet enligt en pdf. Hittills har de samples
vi genererat i alla våra skattningar av integraler varit jämnt fördelade, med exakt samma chans att genereras. Våra
skattningar har varit *väntevärdesriktiga* (unbiased), vilket betyder att vi med ett ständigt ökande antal samples till
slut *konvergerar* mot integralens exakta lösning.

Vissa Monte Carlo-skattningar är dock *biased*, vilket betyder att samplen inte är helt slumpmässiga utan fokuserade mot
ett visst värde eller en viss riktning. De har *snabbare konvergens*, alltså kan de närma sig den exakta lösningen mycket
snabbare, men på grund av sin partiskhet når de troligen aldrig ända fram. Det är i regel en godtagbar avvägning, särskilt
inom datorgrafik, eftersom den exakta lösningen inte är så viktig så länge resultatet ser bra ut. Som vi snart ser med
importance sampling (som använder en biased skattning) är samplen förskjutna mot vissa riktningar, och det tar vi hänsyn
till genom att multiplicera eller dela varje sample med dess pdf.

Monte Carlo-integration är vanlig inom datorgrafik eftersom det är ett ganska intuitivt sätt att approximera kontinuerliga
integraler diskret och effektivt: ta en area eller volym att sampla över (som halvsfären Ω), generera N slumpmässiga
samples inom den och summera och vikta varje samples bidrag till slutresultatet.

Monte Carlo-integration är ett omfattande matematiskt ämne och jag går inte närmare in på detaljerna, men vi kan nämna att
det finns flera sätt att generera de *slumpmässiga samplen*. Som standard är varje sample helt (pseudo)slumpmässigt som vi
är vana vid, men genom att utnyttja vissa egenskaper hos halvslumpmässiga sekvenser kan vi generera samplingsvektorer som
fortfarande är slumpmässiga men har intressanta egenskaper. Vi kan till exempel göra Monte Carlo-integration med så kallade
*lågdiskrepanssekvenser* (low-discrepancy sequences), som fortfarande genererar slumpmässiga samples, men där samplen är
jämnare fördelade. När en lågdiskrepanssekvens används för att generera Monte Carlo-samplingsvektorerna kallas processen
*Quasi-Monte Carlo-integration*. Quasi-Monte Carlo-metoder konvergerar snabbare, vilket gör dem intressanta för
prestandakrävande tillämpningar.

Med vår nya kunskap om Monte Carlo- och Quasi-Monte Carlo-integration finns det en intressant egenskap vi kan använda för
ännu snabbare konvergens: *importance sampling*. Vi har nämnt det tidigare i kapitlet: vid spekulära reflektioner är de
reflekterade ljusvektorerna begränsade till en spekulär lob vars storlek bestäms av ytans strävhet. Eftersom alla
(kvasi)slumpmässiga samples utanför loben saknar betydelse för den spekulära integralen är det rimligt att fokusera
genereringen av samples till insidan av loben, till priset av en biased Monte Carlo-skattning.

Det är i grunden vad importance sampling handlar om: generera samplingsvektorer inom ett område, begränsat av strävheten,
kring mikrofasettens halvvägsvektor. Genom att kombinera Quasi-Monte Carlo-sampling med en lågdiskrepanssekvens och
förskjuta samplingsvektorerna med importance sampling får vi snabb konvergens. Eftersom vi når lösningen snabbare behöver vi
betydligt färre samples för en tillräckligt bra approximation.

```quiz
Varför genererar förfilterkonvolutionen sina samplingsriktningar med GGX-importance sampling i stället för att sprida dem jämnt över halvsfären, som irradianskonvolutionen gör?
- [x] För en spekulär reflektion spelar bara riktningarna inom den spekulära loben kring reflektionsvektorn roll; att generera samplen där GGX-fördelningen är stor lägger nästan alla där, så 128 samples ger ett användbart resultat där jämnt spridda till största delen skulle gå till spillo
- [ ] Eftersom jämnt spridda samples inte kan räknas ut i en shader
- [ ] Eftersom importance sampling gör resultatet exakt rätt, utan approximation
- [ ] Eftersom förfiltermappen är mindre än irradiansmappen
---
Ju smalare lob – ju slätare yta –, desto mer skulle en jämn spridning slösa. Varje samples bidrag måste vägas med dess sannolikhet (pdf:en) för att skattningen ska bli rätt; förfiltershadern viktar med `NdotL` och använder pdf:en för att välja en mipnivå.
```

### En lågdiskrepanssekvens

I det här kapitlet räknar vi ut den indirekta reflektansekvationens spekulära del i förväg med importance sampling och en
slumpmässig lågdiskrepanssekvens enligt Quasi-Monte Carlo-metoden. Sekvensen vi använder kallas *Hammersley-sekvensen*,
noggrant beskriven av Holger Dammertz. Hammersley-sekvensen bygger på *Van der Corput*-sekvensen, som speglar ett tals
binära representation kring binärpunkten.

Med några smarta bittrick kan vi generera Van der Corput-sekvensen ganska effektivt i ett shaderprogram, och den använder
vi för att få Hammersley-samplet i av totalt N samples – funktionerna finns redan i projektet:

:::opengl vulkan
```glsl
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits)
{
     bits = (bits << 16u) | (bits >> 16u);
     bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
     bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
     bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
     bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
     return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
vec2 Hammersley(uint i, uint N)
{
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}
```

GLSL-funktionen `Hammersley` ger oss lågdiskrepans-samplet i av hela samplingsmängden med storleken N.
Heltalsoperationerna – skift, masker, `uint` – kräver GLSL 1.30 eller senare, vilket både OpenGL 3.3 och Vulkans GLSL 4.50
har.
:::
:::d3d12
```hlsl
// http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
// efficient VanDerCorpus calculation.
float RadicalInverse_VdC(uint bits)
{
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}
// ----------------------------------------------------------------------------
float2 Hammersley(uint i, uint N)
{
    return float2(float(i) / float(N), RadicalInverse_VdC(i));
}
```

Funktionen `Hammersley` ger oss lågdiskrepans-samplet i av hela samplingsmängden med storleken N. `uint`-aritmetik med
skift och masker är vanlig HLSL från shader model 4 och framåt (projektet kompilerar `ps_5_0`).
:::

Att vända bitarna i i speglar dess binära siffror kring binärpunkten: 1 = 0.1₂ blir 0.5, 2 = 0.01₂ blir 0.25, 3 = 0.11₂ blir
0.75 och så vidare. Varje nytt sample hamnar i den största lucka som de tidigare lämnade, så punkterna täcker kvadraten
jämnt, utan slumptalens klumpar.

```quiz
`Hammersley(i, N)` returnerar `(i / N, RadicalInverse_VdC(i))`. Vad gör `RadicalInverse_VdC` med samplets nummer, och varför är det användbart?
- [ ] Den returnerar ett pseudoslumptal från en hash av i, olika i varje bildruta
- [ ] Den omvandlar i från sRGB till linjärt
- [ ] Den returnerar i / N en gång till, så att båda koordinaterna växer tillsammans
- [x] Den speglar de binära siffrorna i i kring binärpunkten (bitreversering): 1, 2, 3 blir 0.5, 0.25, 0.75 …; tillsammans med i / N ger det punkter som täcker enhetskvadraten jämnt – en lågdiskrepanssekvens – och samma punkter vid varje körning
---
Det är Van der Corput-sekvensen i bas 2. Jämnt spridda samplingspunkter gör att Monte Carlo-skattningen konvergerar snabbare än med slumpmässiga (Quasi-Monte Carlo), och eftersom den är deterministisk blir den förfiltrerade mappen likadan varje gång.
```

### GGX-importance sampling

I stället för att generera samplingsvektorer jämnt eller slumpmässigt (Monte Carlo) över integralens halvsfär Ω
genererar vi samplingsvektorer som är förskjutna mot mikroytans halvvägsvektors allmänna reflektionsriktning, utifrån
ytans strävhet. Samplingsprocessen liknar den vi har sett förut: börja en stor loop, generera ett slumpmässigt
(lågdiskrepans-)sekvensvärde, använd sekvensvärdet för att generera en samplingsvektor i tangentrummet, omvandla den till
världsrummet och sampla scenens radians. Det som skiljer är att vi nu använder ett lågdiskrepans-sekvensvärde som indata
för att generera en samplingsvektor:

```glsl
const uint SAMPLE_COUNT = 128u;
for(uint i = 0u; i < SAMPLE_COUNT; ++i)
{
    vec2 Xi = Hammersley(i, SAMPLE_COUNT);
```

För att bygga en samplingsvektor behöver vi dessutom ett sätt att rikta och förskjuta samplingsvektorn mot den spekulära
loben för en viss strävhet. Vi kan ta NDF:en från kapitlet *PBR-teori* och kombinera GGX-NDF:en med processen för sfäriska
samplingsvektorer, som Epic Games beskriver:

:::opengl vulkan
```glsl
vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
    float a = roughness*roughness;

    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    // from spherical coordinates to cartesian coordinates - halfway vector
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space H vector to world-space sample vector
    vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent   = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);

    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}
```
:::
:::d3d12
```hlsl
float3 ImportanceSampleGGX(float2 Xi, float3 N, float roughness)
{
    float a = roughness * roughness;

    float phi = 2.0f * PI * Xi.x;
    float cosTheta = sqrt((1.0f - Xi.y) / (1.0f + (a * a - 1.0f) * Xi.y));
    float sinTheta = sqrt(1.0f - cosTheta * cosTheta);

    // from spherical coordinates to cartesian coordinates - halfway vector
    float3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    // from tangent-space H vector to world-space sample vector
    float3 up        = abs(N.z) < 0.999f ? float3(0.0f, 0.0f, 1.0f) : float3(1.0f, 0.0f, 0.0f);
    float3 tangent   = normalize(cross(up, N));
    float3 bitangent = cross(N, tangent);

    float3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}
```
:::

Det ger oss en samplingsvektor som är någorlunda riktad kring den förväntade mikroytans halvvägsvektor utifrån en
strävhet och lågdiskrepans-sekvensvärdet Xi. Observera att Epic Games använder den kvadrerade strävheten för bättre
visuella resultat, enligt Disneys ursprungliga PBR-forskning. Formeln för cos θ är inversen till GGX-fördelningens
kumulativa fördelningsfunktion: jämnt spridda värden på Xi.y blir värden på θ som är spridda som NDF:en – tätt nära
normalen för en slät yta, brett för en sträv. Xi.x vrider helt enkelt samplet runt normalen.

Med den lågdiskrepanta Hammersley-sekvensen och genereringen av samples på plats kan vi göra färdigt förfilterkonvolutionens
shader. Den samplade halvvägsvektorn görs om till en ljusriktning genom att spegla vyvektorn kring den, och omgivningen
samplas i den riktningen:

:::opengl
```glsl
void main()
{
    vec3 N = normalize(WorldPos);

    // make the simplifying assumption that V equals R equals the normal
    vec3 R = N;
    vec3 V = R;

    const uint SAMPLE_COUNT = 128u;
    vec3 prefilteredColor = vec3(0.0);
    float totalWeight = 0.0;

    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0)
        {
            // sample from the environment's mip level based on roughness/pdf
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);

            prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;

    FragColor = vec4(prefilteredColor, 1.0);
}
```

`roughness` är en uniform som sätts per mipnivå.
:::
:::vulkan
`prefilter.frag` är samma GLSL som learnopengls, med `fragWorldPos` som indata, `outColor` som utdata och strävheten från
capture-passets push constants:

```glsl
// the push constants of a capture pass: the roughness comes after the matrix
layout(push_constant) uniform CapturePushConstants {
    mat4 projectionView;
    float roughness;
} pc;
```

`main` börjar med att kopiera strävheten till en lokal variabel, så att resten läses som learnopengls:

```glsl
    vec3 N = normalize(fragWorldPos);
    float roughness = pc.roughness;
```

och loopens kärna – för vart och ett av de 128 samplen – är:

```glsl
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if (NdotL > 0.0) {
            // sample from the environment's mip level based on roughness/pdf
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);

            prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
```

och i slutet skrivs `prefilteredColor / totalWeight`.
:::
:::d3d12
```hlsl
    float3 N = normalize(input.worldPos);

    // make the simplifying assumption that V equals R equals the normal
    float3 R = N;
    float3 V = R;

    const uint SAMPLE_COUNT = 128u;
    float3 prefilteredColor = float3(0.0f, 0.0f, 0.0f);
    float totalWeight = 0.0f;

    for (uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
        float2 Xi = Hammersley(i, SAMPLE_COUNT);
        float3 H = ImportanceSampleGGX(Xi, N, roughness);
        float3 L = normalize(2.0f * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0f);
        if (NdotL > 0.0f)
        {
            // sample from the environment's mip level based on roughness/pdf
            float D     = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0f);
            float HdotV = max(dot(H, V), 0.0f);
            float pdf = D * NdotH / (4.0f * HdotV) + 0.0001f;

            float resolution = 128.0f; // resolution of source cubemap (per face)
            float saTexel  = 4.0f * PI / (6.0f * resolution * resolution);
            float saSample = 1.0f / (float(SAMPLE_COUNT) * pdf + 0.0001f);

            float mipLevel = roughness == 0.0f ? 0.0f : 0.5f * log2(saSample / saTexel);

            prefilteredColor += environmentMap.SampleLevel(clampSampler, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;
```

`roughness` kommer från cbuffern `CaptureConstants` (root-konstanter) och sätts per mipnivå. Nivån räknas ut, så
`SampleLevel` är det naturliga anropet här – och en loop med en databeroende gren tillåter ändå inte `Sample`.
:::

Vi förfiltrerar omgivningen utifrån en strävhet som varierar över förfilter-cube mappens mipnivåer (från 0.0 till 1.0) och
lagrar resultatet i `prefilteredColor`. Det resulterande `prefilteredColor` delas med den totala samplingsvikten, där
samples med mindre inverkan på slutresultatet (för litet NdotL) bidrar mindre till den slutliga vikten.

### Artefakter i förfilterkonvolutionen

Förfiltreringen ovan fungerar bra för de flesta ändamål, men det finns några artefakter att känna till; learnopengl tar
upp dem tillsammans med sina lösningar, och kursens kod innehåller redan båda lösningarna.

#### Cube map-sömmar vid hög strävhet

Att sampla förfiltermappen på sträva ytor betyder att sampla dess lägre mipnivåer. När OpenGL samplar cube maps
interpolerar det som standard inte linjärt över sidornas gränser. Eftersom de lägre mipnivåerna både har lägre upplösning
och förfiltermappen är konvolverad med en mycket större samplingslob blir den saknade filtreringen mellan sidorna ganska
tydlig: synliga sömmar längs sidornas kanter.

:::opengl
Som tur är ger OpenGL oss möjlighet att filtrera ordentligt över cube map-sidorna genom att slå på
`GL_TEXTURE_CUBE_MAP_SEAMLESS`:

```cpp
    glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS);
```

Slå bara på egenskapen någonstans i början av programmet, så är sömmarna borta.
:::
:::vulkan
Vulkan har inget att slå på: det filtrerar alltid över kanterna mellan en cube maps sidor, som OpenGL gör med
`GL_TEXTURE_CUBE_MAP_SEAMLESS` påslaget.
:::
:::d3d12
Direct3D har inget att slå på: det filtrerar alltid över kanterna mellan en cube maps sidor, som OpenGL gör med
`GL_TEXTURE_CUBE_MAP_SEAMLESS` påslaget.
:::

#### Ljusa prickar i förfilterkonvolutionen

På grund av högfrekventa detaljer och kraftigt varierande ljusstyrkor i spekulära reflektioner krävs ett stort antal
samples för att konvolvera dem och ta hänsyn till HDR-omgivningens kraftigt varierande reflektioner. Vi tar redan ett
mycket stort antal samples, men i vissa miljöer räcker det ändå inte på några av de strävare mipnivåerna, och då börjar
prickiga mönster dyka upp kring ljusa områden. Kursens omgivning är just ett sådant fall: dess sol är liten och ungefär 60
gånger ljusare än vitt, och med 128 samples per texel träffar vissa texlar den och andra missar den.

Ett alternativ är att öka antalet samples ytterligare, men det räcker inte för alla miljöer. Som Chetan Jags beskriver kan
vi minska artefakten genom att (under förfilterkonvolutionen) inte sampla environment mappen direkt, utan sampla en
mipnivå av environment mappen utifrån integralens pdf och strävheten:

```glsl
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

            float resolution = 128.0; // resolution of source cubemap (per face)
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel);
```

Varje sample står för en del av riktningarnas sfär: ungefär `1 / (SAMPLE_COUNT · pdf)` steradianer (`saSample`), stor där
samples är sällsynta. En texel i omgivningens nivå 0 täcker `4π / (6 · 128²)` steradianer (`saTexel`). Om ett sample står
för 4 texlars riktningar bör det läsa medelvärdet av de 4 – en mipnivå upp, eftersom varje nivå tar medelvärdet av 2 × 2
texlar i den förra: därav `0.5 · log2(saSample / saTexel)`. En liten ljus sol sprids då över samplets yta i stället för att
träffas eller missas. (Ett GGX-samples pdf, omräknad från halvvägsvektorn till ljusriktningen, är `D · (n · h) / (4 ·
(h · v))`.)

Glöm inte att slå på trilinjär filtrering för den environment map du vill sampla mipnivåer från – och framför allt att ge
den mipnivåer över huvud taget: hittills hade environment-cube mappen bara nivå 0.

:::opengl
```cpp
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR); // enable pre-filter mipmap sampling (combatting visible dots artifact)
```

(i blocket som skapar `envCubemap`, i stället för `GL_LINEAR`). Och låt OpenGL generera mipmaps när cube mappens bastextur
är satt:

```cpp
    // then let OpenGL generate mipmaps from first mip face (combatting visible dots artifact)
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
    glGenerateMipmap(GL_TEXTURE_CUBE_MAP);
```

`glGenerateMipmap` bygger varje nivå från den förra med ett boxfilter: varje texel är medelvärdet av 2 × 2 texlar i den
större nivån. Irradianskonvolutionen, som körs efter den, läser nu också omgivningen genom dess mipnivåer (`texture`
väljer en utifrån derivatorna i skärmrummet); dess bild ändras med ungefär en nivå.
:::
:::vulkan
Vulkan har inte heller någon `glGenerateMipmap`, men projektet har haft dess motsvarighet sedan kapitlet PBR-belysning:
`generateMipmaps`, vulkan-tutorials funktion, som fyller varje nivå med en `vkCmdBlitImage` av nivån ovanför (en skalad
kopia med linjär filtrering). Den tar ett antal lager, så den gör alla sex sidor på en gång. Environment-cube mappen skapas
med 8 nivåer (128, 64 … 1) och med två användningar till – en blit läser en nivå av bilden och skriver en annan, så bilden
måste vara både källa och mål för överföringar:

```cpp
        createCubemap(128, 8, envCubemapImage, envCubemapImageMemory, envCubemapImageView);
```

med `VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT` tillagt i usage i `createCubemap`, och direkt
efter konverteringen:

```cpp
        // then generate mipmaps from first mip face (combatting visible dots artifact) - learnopengl: glGenerateMipmap(GL_TEXTURE_CUBE_MAP)
        generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6);
```

Konverteringens render pass lämnar nivå 0 i `SHADER_READ_ONLY_OPTIMAL`; `generateMipmaps` gör varje nivå till
överföringskälla, nästa till mål, blittar och lämnar båda redo för sampling igen. Samplern filtrerar redan mellan
mipnivåer. Irradianskonvolutionen, som körs efter den, läser nu också omgivningen genom dess mipnivåer (`texture` väljer
en utifrån derivatorna); dess bild ändras med ungefär en nivå.
:::
:::d3d12
Direct3D 12 har ingen `glGenerateMipmap`: projektet gör nivåerna genom att rita. `m_envCubemap` får `EnvMipLevels = 8`
nivåer (128, 64 … 1; `Tex2D(…, 6, EnvMipLevels, …)`, och dess SRV `TextureCube.MipLevels = EnvMipLevels`). När
konverteringen har ritat nivå 0 ritas varje nivå `mip` = 1 … 7 från nivå `mip - 1` med de sex capture-vyerna och
`downsample.hlsl`, vars pixel shader är en enda uppslagning:

```hlsl
    float3 color = environmentMap.Sample(clampSampler, input.worldPos).rgb;
```

En pixel i den mindre sidan ligger exakt mitt emellan 2 × 2 texlar i den större, så det linjära filtret ger deras
medelvärde – `glGenerateMipmap`s boxfilter. Två regler i Direct3D 12 formar loopen:

- **En nivå kan inte läsas medan den ritas i.** Passet läser inte genom cube mappens SRV för alla nivåer utan genom en som
  bara visar nivån ovanför: `TextureCube.MostDetailedMip = mip - 1`, `TextureCube.MipLevels = 1`, skapad på heap-plats
  `6 + (mip - 1)` (platserna 6–12; heapen växer till 13 descriptorer) och satt som tabell 2.
- **Resurstillstånd gäller per subresurs.** Varje sida i varje nivå är en egen subresurs,
  `D3D12CalcSubresource(mip, face, 0, EnvMipLevels, 6)` = `mip + face · 8`. När en nivås sex sidor är ritade gör sex
  barriärer just dem från `RENDER_TARGET` till `PIXEL_SHADER_RESOURCE` – de mindre nivåerna ska fortfarande ritas:

```cpp
            CD3DX12_RESOURCE_BARRIER barriers[6];
            for (UINT i = 0; i < 6; ++i)
            {
                barriers[i] = CD3DX12_RESOURCE_BARRIER::Transition(m_envCubemap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12CalcSubresource(mip, i, 0, EnvMipLevels, 6));
            }
            m_commandList->ResourceBarrier(6, barriers);
```

(efter konverteringen likadant för nivå 0). Per nivå: `SetCaptureTarget(m_envCubemap.Get(), i, mip)` och viewporten
`128 >> mip`. Pipeline staten `m_downsamplePipelineState` är konverteringens med `downsample.hlsl` som pixel shader.
Irradianskonvolutionen fortsätter att läsa nivå 0 (`SampleLevel(…, 0.0f)`), till skillnad från OpenGL:s `texture`, som nu
väljer en suddigare nivå där; irradiansmappen skiljer sig som mest med några nivåer.
:::

:::opengl
```quiz
learnopengls lösning på de ljusa prickarna samplar omgivningen på en mipnivå som väljs utifrån varje samples pdf. Vad behöver environment-cube mappen för det, och hur ger OpenGL-projektet den det?
- [ ] Ingenting: förfiltermappens egna mipnivåer samplas
- [x] Egna mipnivåer, var och en medelvärdet av 2 × 2 i nivån ovanför; OpenGL gör dem med `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` direkt efter att de sex sidorna har spelats in, och minifieringsfiltret `GL_LINEAR_MIPMAP_LINEAR` låter `textureLod` blanda mellan dem
- [ ] En andra, suddad kopia av omgivningen, renderad med en gaussisk blur
- [ ] Högre upplösning: mipnivå-tricket fungerar bara med sidor på 512 × 512
---
Utan mipnivåer skulle `textureLod(environmentMap, L, mipLevel)` läsa nivå 0 vad `mipLevel` än säger, och prickarna skulle komma tillbaka.
```
:::
:::vulkan
```quiz
learnopengls lösning på de ljusa prickarna samplar omgivningen på en mipnivå som väljs utifrån varje samples pdf. Vad behöver environment-cube mappen för det, och hur ger Vulkan-projektet den det?
- [ ] Ingenting: förfiltermappens egna mipnivåer samplas
- [ ] En andra, suddad kopia av omgivningen, renderad med en gaussisk blur
- [ ] Bara en annan sampler: `VK_SAMPLER_MIPMAP_MODE_LINEAR` räknar ut nivåerna under samplingen
- [x] Egna mipnivåer: bilden skapas med 8 nivåer och usage `TRANSFER_SRC | TRANSFER_DST`, och `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6)` blittar varje nivå till nästa för alla sex lager, direkt efter konverteringen
---
En sampler väljer bara och blandar mellan nivåer som finns. `vkCmdBlitImage` med linjär filtrering halverar varje nivå, som `glGenerateMipmap` gör; barriärerna i `generateMipmaps` får varje blit att vänta på den förra.
```
:::
:::d3d12
```quiz
learnopengls lösning på de ljusa prickarna samplar omgivningen på en mipnivå som väljs utifrån varje samples pdf. Vad behöver environment-cube mappen för det, och hur ger Direct3D 12-projektet den det?
- [x] Egna mipnivåer: 8 nivåer i resursen, var och en ritad från den ovanför med `downsample.hlsl` genom en SRV som bara visar den nivån (`MostDetailedMip = mip - 1`, `MipLevels = 1`), med barriärer per subresurs som gör varje färdig nivå till shader resource
- [ ] Ingenting: förfiltermappens egna mipnivåer samplas
- [ ] Ett anrop till `GenerateMips` på command listen efter konverteringen
- [ ] En andra, suddad kopia av omgivningen, renderad med en gaussisk blur
---
Direct3D 12 har inget anrop för att generera mipmaps; att rita (eller en compute shader) gör det. En nivå som ritas i är i tillståndet RENDER_TARGET och får inte läsas, vilket vyerna med en enda nivå och tillstånden per subresurs ser till.
```
:::

### Att spela in förfiltrets mipnivåer

Det som återstår är att låta API:et förfiltrera environment mappen med olika strävhet över flera mipnivåer. Det är faktiskt
ganska enkelt med irradianskapitlets ursprungliga upplägg:

:::opengl
```cpp
    prefilterShader.use();
    prefilterShader.setInt("environmentMap", 0);
    prefilterShader.setMat4("projection", captureProjection);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);

    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    unsigned int maxMipLevels = 5;
    for (unsigned int mip = 0; mip < maxMipLevels; ++mip)
    {
        // resize framebuffer according to mip-level size.
        unsigned int mipWidth  = static_cast<unsigned int>(64 * std::pow(0.5, mip));
        unsigned int mipHeight = static_cast<unsigned int>(64 * std::pow(0.5, mip));
        glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, mipWidth, mipHeight);
        glViewport(0, 0, mipWidth, mipHeight);

        float roughness = (float)mip / (float)(maxMipLevels - 1);
        prefilterShader.setFloat("roughness", roughness);
        for (unsigned int i = 0; i < 6; ++i)
        {
            prefilterShader.setMat4("view", captureViews[i]);
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, prefilterMap, mip);

            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            renderCube();
        }
    }
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Processen liknar irradiansmappens konvolution, men den här gången skalar vi framebufferns mått till rätt mipnivå, där
varje nivå halverar måtten. Dessutom anger vi mipnivån vi renderar i som `glFramebufferTexture2D`:s sista parameter och
skickar strävheten vi förfiltrerar för till förfiltershadern.
:::
:::vulkan
`renderToCubemap` får tre parametrar i stället för `size`: mipnivån att rita i, nivåns storlek och strävheten. Sidornas
vyer använder nivån – `viewInfo.subresourceRange.baseMipLevel = mipLevel;` – och push constants bär strävheten –
`constants.roughness = roughness;` (`CapturePushConstants` har nu `float roughness` efter matrisen). Förra kapitlets anrop
blir `(…, envCubemapImage, 0, 128, 0.0f)` och `(…, irradianceImage, 0, 32, 0.0f)`, och efter irradianspasset kör
`initVulkan()` learnopengls loop:

```cpp
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip) {
            // the size of the mip level: each one half the one before
            unsigned int mipWidth = static_cast<unsigned int>(64 * std::pow(0.5, mip));

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            renderToCubemap(prefilterPipeline, envDescriptorSet, prefilterImage, mip, mipWidth, roughness);
        }
```

`prefilterPipeline` är `createPipeline("shaders/cubemap.vert.spv", "shaders/prefilter.frag.spv", captureRenderPass,
VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST, prefilterPipeline)`; passet läser omgivningen genom `envDescriptorSet`, vars kubvy nu
täcker alla 8 nivåer. Varje anrop är en egen engångs-command buffer som skickas iväg och väntas på.
:::
:::d3d12
```cpp
        m_commandList->SetPipelineState(m_prefilterPipelineState.Get());
        // The texture the pass reads (root parameter 2): the environment cube map with all
        // its mip levels, heap slot 2.
        CD3DX12_GPU_DESCRIPTOR_HANDLE envCubemap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 2, m_cbvSrvDescriptorSize);
        m_commandList->SetGraphicsRootDescriptorTable(2, envCubemap);

        CaptureConstants captureConstants = {};
        XMStoreFloat4x4(&captureConstants.captureProjection, XMMatrixTranspose(captureProjection));
        unsigned int maxMipLevels = 5;
        for (unsigned int mip = 0; mip < maxMipLevels; ++mip)
        {
            // resize the viewport according to mip-level size.
            unsigned int mipWidth  = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            unsigned int mipHeight = static_cast<unsigned int>(64 * std::pow(0.5, mip));
            CD3DX12_VIEWPORT viewport(0.0f, 0.0f, static_cast<float>(mipWidth), static_cast<float>(mipHeight));
            CD3DX12_RECT scissorRect(0, 0, static_cast<LONG>(mipWidth), static_cast<LONG>(mipHeight));
            m_commandList->RSSetViewports(1, &viewport);
            m_commandList->RSSetScissorRects(1, &scissorRect);

            float roughness = (float)mip / (float)(maxMipLevels - 1);
            captureConstants.roughness = roughness;
            for (unsigned int i = 0; i < 6; ++i)
            {
                XMStoreFloat4x4(&captureConstants.captureView, XMMatrixTranspose(captureViews[i]));
                m_commandList->SetGraphicsRoot32BitConstants(0, sizeof(CaptureConstants) / 4, &captureConstants, 0);
                // The render target: face i of mip level mip.
                SetCaptureTarget(m_prefilterMap.Get(), i, mip);

                RenderCube();
            }
        }

        // The pre-filter map is complete, all its levels: from now on shaders read it.
        CD3DX12_RESOURCE_BARRIER barrier = CD3DX12_RESOURCE_BARRIER::Transition(m_prefilterMap.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
        m_commandList->ResourceBarrier(1, &barrier);
```

`SetCaptureTarget`:s parameter `mip`, oanvänd hittills, anger nu nivån: render target viewns `Texture2DArray.MipSlice`.
`CaptureConstants` har en tredje medlem, `float roughness`, så den rymmer 33 värden. Förfiltermappen är enklare än
omgivningens mipkedja: alla dess nivåer skrivs bara i det här passet, så en enda barriär för hela resursen i slutet räcker.
:::

Visa tills vidare förfiltermappen som bakgrund: bind den i stället för environment mappen när bakgrunden ritas och låt
bakgrundens shader sampla mipnivå **1.2** i stället för 0.0 – mellan nivåerna för strävheten 0.25 och 0.5. Gör nu den
första uppgiften, **prefilter-map**.

Tryck på **Build & run**: bakgrunden är **en suddig omgivning**. Himlen är fortfarande blågrå upptill, kullarna är
utsmetade, och nere till vänster finns ett stort varmt sken: en orange lampa i omgivningen, strax utanför bilden till
vänster, utspridd av oskärpan. Det finns inga ljusa prickar någonstans – mipnivå-tricket i arbete. Sfärerna ändras knappt;
irradiansmappen görs nu av en omgivning med mipnivåer.

## Att räkna ut BRDF:en i förväg

Med den förfiltrerade omgivningen på plats kan vi fokusera på split sum-approximationens andra del: BRDF:en. Låt oss kort
se på den spekulära split sum-approximationen igen:

```text
  Lo(p, ωo) ≈ ∫Ω Li(p, ωi) dωi  ·  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi
```

Vi har räknat ut split sum-approximationens vänstra del i förväg i förfiltermappen för olika strävhetsnivåer. Den högra
sidan kräver att vi konvolverar BRDF-ekvationen över vinkeln n · ωo, ytans strävhet och Fresnels F0. Det liknar att
integrera den spekulära BRDF:en med en helt vit omgivning, alltså en konstant radians Li på 1.0. Att konvolvera BRDF:en över
3 variabler är lite mycket, men vi försöker flytta ut F0 ur den spekulära BRDF-ekvationen:

```text
  ∫Ω fr(p, ωi, ωo) · (n · ωi) dωi  =  ∫Ω fr(p, ωi, ωo) · F(ωo, h) / F(ωo, h) · (n · ωi) dωi
```

där F är Fresnelekvationen. Flyttar vi Fresnel-nämnaren till BRDF:en får vi följande likvärdiga ekvation:

```text
  ∫Ω fr(p, ωi, ωo) / F(ωo, h) · F(ωo, h) · (n · ωi) dωi
```

Ersätter vi det högra F med Fresnel-Schlick-approximationen får vi:

```text
  ∫Ω fr(p, ωi, ωo) / F(ωo, h) · (F0 + (1 − F0) · (1 − ωo · h)⁵) · (n · ωi) dωi
```

Vi ersätter (1 − ωo · h)⁵ med α för att det ska bli lättare att lösa ut F0:

```text
  ∫Ω fr / F · (F0 + (1 − F0) · α) · (n · ωi) dωi
  = ∫Ω fr / F · (F0 + α − F0 · α) · (n · ωi) dωi
  = ∫Ω fr / F · (F0 · (1 − α) + α) · (n · ωi) dωi
```

Sedan delar vi upp Fresnelfunktionen F på två integraler:

```text
  = ∫Ω fr / F · F0 · (1 − α) · (n · ωi) dωi  +  ∫Ω fr / F · α · (n · ωi) dωi
```

På så sätt är F0 konstant över integralen och vi kan ta ut F0 ur integralen. Sedan sätter vi tillbaka α i sin ursprungliga
form och får den slutliga split sum-BRDF-ekvationen:

```text
  = F0 · ∫Ω fr(p, ωi, ωo) · (1 − (1 − ωo · h)⁵) · (n · ωi) dωi  +  ∫Ω fr(p, ωi, ωo) · (1 − ωo · h)⁵ · (n · ωi) dωi
```

De två resulterande integralerna står för en skala respektive en förskjutning (bias) av F0. Observera att eftersom
fr(p, ωi, ωo) redan innehåller en term för F tar de ut varandra, och F försvinner ur fr.

På samma sätt som de tidigare konvolverade environment mapparna kan vi konvolvera BRDF-ekvationerna över deras indata:
vinkeln mellan n och ωo, och strävheten. Vi lagrar de konvolverade resultaten i en 2D-uppslagstextur (LUT) som kallas
BRDF-integrationsmap, och som vi senare använder i vår PBR-belysningsshader för att få det slutliga konvolverade indirekta
spekulära resultatet.

BRDF-konvolutionens shader arbetar på ett 2D-plan och använder dess 2D-texturkoordinater direkt som indata till
BRDF-konvolutionen (NdotV och strävhet). Konvolutionskoden liknar till stor del förfilterkonvolutionen, förutom att den nu
behandlar samplingsvektorn enligt vår BRDF:s geometrifunktion och Fresnel-Schlick-approximationen:

:::opengl vulkan
```glsl
vec2 IntegrateBRDF(float NdotV, float roughness)
{
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    vec3 N = vec3(0.0, 0.0, 1.0);

    const uint SAMPLE_COUNT = 128u;
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the
        // preferred alignment direction (importance sampling).
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}
```

och `main` skriver `IntegrateBRDF(TexCoords.x, TexCoords.y)` (`fragTexCoord` i Vulkan) – utdata är en `vec2`, för ett mål
med två kanaler.
:::
:::d3d12
```hlsl
float2 IntegrateBRDF(float NdotV, float roughness)
{
    float3 V;
    V.x = sqrt(1.0f - NdotV * NdotV);
    V.y = 0.0f;
    V.z = NdotV;

    float A = 0.0f;
    float B = 0.0f;

    float3 N = float3(0.0f, 0.0f, 1.0f);

    const uint SAMPLE_COUNT = 128u;
    for (uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // generates a sample vector that's biased towards the
        // preferred alignment direction (importance sampling).
        float2 Xi = Hammersley(i, SAMPLE_COUNT);
        float3 H = ImportanceSampleGGX(Xi, N, roughness);
        float3 L = normalize(2.0f * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0f);
        float NdotH = max(H.z, 0.0f);
        float VdotH = max(dot(V, H), 0.0f);

        if (NdotL > 0.0f)
        {
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0f - VdotH, 5.0f);

            A += (1.0f - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return float2(A, B);
}

float2 PSMain(PSInput input) : SV_TARGET
{
    float2 integratedBRDF = IntegrateBRDF(input.texCoords.x, input.texCoords.y);
    return integratedBRDF;
}
```

`PSMain` returnerar en `float2`: render targeten har två kanaler.
:::

Som du ser är BRDF-konvolutionen en direkt översättning av matematiken till kod. Vi tar både vinkeln θ och strävheten som
indata, genererar en samplingsvektor med importance sampling, behandlar den med BRDF:ens geometriterm och den härledda
Fresnel-termen och ger för varje sample både en skala och en förskjutning av F0, som vi till sist tar medelvärdet av.
Vyvektorn byggs av NdotV i ett tangentrum vars normal är +z; bara vinkeln spelar roll, inte riktningen runt normalen.

Du minns kanske från kapitlet *PBR-teori* att BRDF:ens geometriterm är lite annorlunda när den används med IBL, eftersom
dess variabel k tolkas lite annorlunda:

```text
               (α + 1)²                       α²
  k_direct  =  --------           k_IBL  =  ----
                  8                           2
```

Eftersom BRDF-konvolutionen är en del av den spekulära IBL-integralen använder vi k_IBL för Schlick-GGX-geometrifunktionen:

:::opengl vulkan
```glsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    // note that we use a different k for IBL
    float a = roughness;
    float k = (a * a) / 2.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
```
:::
:::d3d12
```hlsl
float GeometrySchlickGGX(float NdotV, float roughness)
{
    // note that we use a different k for IBL
    float a = roughness;
    float k = (a * a) / 2.0f;

    float nom   = NdotV;
    float denom = NdotV * (1.0f - k) + k;

    return nom / denom;
}
```
:::

`GeometrySmith` är den från kapitlet PBR-belysning. Observera att även om k tar `a` som parameter kvadrerade vi inte
strävheten till `a` som vi gjorde för andra tolkningar av `a`; troligen eftersom `a` redan kvadreras här. Jag är inte säker
på om det är en inkonsekvens hos Epic Games eller i Disneys ursprungliga artikel, men att översätta strävheten direkt till
`a` ger en BRDF-integrationsmap som är identisk med Epic Games version.

Till sist, för att lagra BRDF-konvolutionens resultat skapar vi en 2D-textur med upplösningen 128 gånger 128 (learnopengl:
512 gånger 512) med två 16-bitars flyttalskanaler, och renderar skärmfyrhörningen i den en gång:

:::opengl
```cpp
    unsigned int brdfLUTTexture;
    glGenTextures(1, &brdfLUTTexture);

    // pre-allocate enough memory for the LUT texture.
    glBindTexture(GL_TEXTURE_2D, brdfLUTTexture);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RG16F, 128, 128, 0, GL_RG, GL_FLOAT, 0);
    // be sure to set wrapping mode to GL_CLAMP_TO_EDGE
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

Observera att vi använder ett 16-bitars flyttalsformat, som Epic Games rekommenderar. Se till att sätta wrapping-läget till
`GL_CLAMP_TO_EDGE` för att undvika samplingsartefakter vid kanterna. Sedan återanvänder vi samma framebuffer-objekt och kör
shadern över en skärmfyrhörning i NDC:

```cpp
    // then re-configure capture framebuffer object and render screen-space quad with BRDF shader.
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 128, 128);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, brdfLUTTexture, 0);

    glViewport(0, 0, 128, 128);
    brdfShader.use();
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    renderQuad();

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
```

Fyrhörningens texturkoordinat (0, 0) ligger nere till vänster, och den skriver OpenGL i texturens första rad – v = 0 är
strävhet 0, och en uppslagning med v = strävheten läser den där.
:::
:::vulkan
Bilden är `VK_FORMAT_R16G16_SFLOAT` (learnopengls `GL_RG16F`), 128 × 128, en färgattachment som kan samplas:

```cpp
createImage(128, 128, 1, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, brdfLUTImage, brdfLUTImageMemory);
```

med en vy från `createImageView(brdfLUTImage, VK_FORMAT_R16G16_SFLOAT, VK_IMAGE_ASPECT_COLOR_BIT, 1)`. En pipeline görs för
en render pass vars format den känner till, så uppslagstexturen behöver en egen render pass – samma hjälpfunktion med det
andra formatet, `createCaptureRenderPass(VK_FORMAT_R16G16_SFLOAT, brdfRenderPass)` –, och `brdfPipeline` görs för den
(`brdf.vert` + `brdf.frag`, triangellista). `renderBrdfLUT()` skapar en framebuffer med bildens vy och spelar in det enda
passet i en engångs-command buffer:

```cpp
        vkCmdBeginRenderPass(commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);

        // brdf.vert and brdf.frag read no uniform buffer, no image and no push constants: nothing else to bind
        vkCmdBindPipeline(commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, brdfPipeline);
        renderQuad(commandBuffer);

        vkCmdEndRenderPass(commandBuffer); // the lookup texture is now in VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL
```

med viewport och scissor på 128 × 128; `initVulkan()` anropar den efter förfilterloopen. Samplern är `clampSampler`
(linjär, `CLAMP_TO_EDGE`). Fyrhörningens vertex med texturkoordinaterna (0, 0) ligger på NDC (-1, -1), som Vulkan skriver i
rad 0 – v = 0, strävhet 0 –, exakt den texel som OpenGL skriver den i (dess rad 0 är den nedersta): texturen innehåller
samma data i båda API:erna, och en uppslagning med v = strävheten läser den där.
:::
:::d3d12
Texturen är `CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R16G16_FLOAT, 128, 128, 1, 1, 1, 0,
D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET)` (learnopengls `GL_RG16F`), skapad i `RENDER_TARGET`, med en `TEXTURE2D`-SRV på
heap-plats 5. `m_brdfPipelineState` har `brdf.hlsl`:s två shadrar och `RTVFormats[0] = DXGI_FORMAT_R16G16_FLOAT`. Passet
ritar fyrhörningen en gång, i en render target view skriven på capture-passens RTV-plats:

```cpp
        CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(m_rtvHeap->GetCPUDescriptorHandleForHeapStart(), FrameCount, m_rtvDescriptorSize);
        m_device->CreateRenderTargetView(m_brdfLUTTexture.Get(), nullptr, rtvHandle);
        m_commandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);

        CD3DX12_VIEWPORT viewport(0.0f, 0.0f, 128.0f, 128.0f);
        CD3DX12_RECT scissorRect(0, 0, 128, 128);
        m_commandList->RSSetViewports(1, &viewport);
        m_commandList->RSSetScissorRects(1, &scissorRect);

        m_commandList->SetPipelineState(m_brdfPipelineState.Get());
        RenderQuad();
```

följt av barriären till `PIXEL_SHADER_RESOURCE`. En vybeskrivning `nullptr` betyder: hela resursen, i sitt eget format.
Fyrhörningens texturkoordinat v = 0 ligger överst, och den skriver Direct3D i texturens första rad – så den första raden är
strävhet 0, och en uppslagning med v = strävheten läser den där, som i OpenGL, där båda "första rader" ligger nederst.
:::

Det ger oss en 2D-uppslagstextur. Dess vågräta axel är NdotV, från 0 (vänster, strykande) till 1 (höger, rakt framifrån),
och dess lodräta axel strävheten, från 0 till 1. Den röda kanalen är skalan för F0, den gröna förskjutningen: tittar man
rakt på en yta (höger) räknas F0 fullt ut och skalan ligger nära 1; i strykande vinkel på släta ytor (nere till vänster)
tar förskjutningen över – allt reflekterar, vad F0 än är; sträva ytor (överst) reflekterar mindre totalt.

För att titta på den ritar du skärmfyrhörningen över hela fönstret i slutet av bildrutan med debug-shadern, som skriver
`(lut.r, lut.g, 0.0, 1.0)` som det är – ingen tonmappning, ingen gamma:

:::opengl
```cpp
    Shader debugQuad("brdf.vs", "debug_quad.fs");
```

med `debugQuad.setInt("image", 0);`, och i slutet av bildrutan `debugQuad.use()`, `brdfLUTTexture` bunden till enhet 0 och
`renderQuad()`. Fyrhörningens v = 0 är fönstrets underkant, så bilden visar strävhet 0 nederst.
:::
:::vulkan
`debugQuadPipeline` är `brdf.vert` + `debug_quad.frag` för fönstrets render pass; `brdfLUTDescriptorSet` innehåller
uppslagstexturen (poolen växer till 6 set), och `recordCommandBuffer()` ritar `renderQuad(commandBuffer)` med dem sist.
Fönstrets y pekar nedåt, så `debug_quad.frag` vänder v för att lägga strävhet 0 nederst, som i OpenGL:s bild:

```glsl
    // v = 0 (roughness 0) at the bottom of the window, as in a graph: the window's y points down in Vulkan, so v is flipped
    outColor = vec4(texture(image, vec2(fragTexCoord.x, 1.0 - fragTexCoord.y)).rg, 0.0, 1.0);
```

Bara *visningen* är vänd; texturens data är desamma som OpenGL:s.
:::
:::d3d12
`m_debugQuadPipelineState` är `brdf.hlsl`:s `VSMain` med `debug_quad.hlsl`:s `PSMain`, `RTVFormats[0] =
DXGI_FORMAT_R8G8B8A8_UNORM` och `DSVFormat = DXGI_FORMAT_D32_FLOAT` (fönstrets pass binder djupbuffern; djuptestet förblir
avstängt, som i capture-tillstånden). Den skapas direkt efter `m_brdfPipelineState`. `PopulateCommandList` ritar
`RenderQuad()` med den sist, tabell 2 = heap-plats 5. Fyrhörningens v = 0 är fönstrets överkant, så `debug_quad.hlsl` vänder
v för att lägga strävhet 0 nederst, som i OpenGL:s bild:

```hlsl
    return float4(image.Sample(clampSampler, float2(input.texCoords.x, 1.0f - input.texCoords.y)).rg, 0.0f, 1.0f);
```

Bara *visningen* är vänd; texturens data stämmer med OpenGL:s.
:::

Gör nu uppgiften **brdf-lut**. Tryck på **Build & run**: **den rödgröna uppslagstexturen fyller fönstret** (fyrhörningen
ligger framför allt; blått är 0 överallt). Rött till höger och nederst, mörkare rött uppåt, och ett gröngult hörn nere till
vänster.

```quiz
Vad innehåller BRDF-integrationsmappens vågräta axel, lodräta axel och två kanaler?
- [ ] u = strävheten, v = NdotV; röd = den diffusa delen, grön = den spekulära delen
- [x] u = NdotV, v = strävheten; röd = skalan som tillämpas på F0, grön = förskjutningen som läggs till – så att den spekulära IBL-termen blir `prefilteredColor * (F * brdf.x + brdf.y)`
- [ ] u = sfärens texturkoordinat u, v = dess v; röd och grön är ljusets färg
- [ ] u = NdotL, v = NdotH; röd = D, grön = G
---
F0 kunde flyttas ut ur integralen eftersom Fresnel-Schlick-termen är linjär i F0: det som återstår är två integraler av två variabler var, lagrade som två kanaler i en 2D-textur.
```

:::opengl
```quiz
OpenGL skriver skärmfyrhörningens texturkoordinat (0, 0) i uppslagstexturens första rad. Varför läser uppslagningen i PBR-shadern, `texture(brdfLUT, vec2(NdotV, roughness))`, rätt texel?
- [ ] Det gör den inte: shadern måste använda `1.0 - roughness`
- [ ] Eftersom texturen är symmetrisk i v
- [x] Eftersom i OpenGL både fyrhörningens v = 0 (dess underkant, NDC y = -1) och en texturs v = 0 är första raden, så raden som skrivs för strävhet 0 är raden som läses för strävhet 0; debug-fyrhörningen visar den åt samma håll, strävhet 0 nederst i fönstret
- [ ] Eftersom `GL_CLAMP_TO_EDGE` avbildar v = strävheten på rätt rad
---
Skrivning och läsning är överens om vad "rad 0" är, och det är allt som spelar roll. Vulkan- och Direct3D 12-projekten får samma data, men måste vända v när de *visar* texturen, eftersom deras fönsters första rad är den översta.
```
:::
:::vulkan
```quiz
`debug_quad.frag` samplar uppslagstexturen på `1.0 - fragTexCoord.y`, men PBR-shadern slår upp den på `vec2(NdotV, roughness)` utan vändning. Varför är det ingen motsägelse?
- [x] Texturens data är desamma som OpenGL:s: fyrhörningens v = 0 ligger på NDC y = -1, som Vulkan skriver i rad 0, så rad 0 är strävhet 0, och uppslagningen läser den där; bara att visa den i fönstret, vars första rad är den översta, kräver vändningen för att lägga strävhet 0 nederst som i OpenGL:s bild
- [ ] Det är en: sfärernas reflektioner blir upp och ner
- [ ] PBR-shadern vänder v någon annanstans, i `fresnelSchlickRoughness`
- [ ] `clampSampler` vänder v för 2D-bilder
---
Capture-passet och uppslagningen är överens om vad rad 0 betyder. Att vända v i PBR-shadern skulle läsa strävhet 1 för en slät yta – de släta sfärerna skulle få de sträva sfärernas matta reflektioner.
```
:::
:::d3d12
```quiz
Direct3D 12-skärmfyrhörningen har sin texturkoordinat (0, 0) uppe till vänster, learnopengls har den nere till vänster. Varför läser uppslagningen `brdfLUT.Sample(clampSampler, float2(NdotV, roughness))` ändå rätt texel?
- [ ] Det gör den inte: PBR-shadern måste använda `1.0f - roughness`
- [ ] Eftersom den statiska samplern vänder v för 2D-texturer
- [x] Eftersom Direct3D skriver fyrhörningens överkant – v = 0 – i texturens första rad, och en uppslagning med v = 0 läser också första raden: rad 0 är strävhet 0 både när den skrivs och när den läses; bara att visa texturen i fönstret kräver vändningen i `debug_quad.hlsl`, för att lägga strävhet 0 nederst som i OpenGL:s bild
- [ ] Eftersom `R16G16_FLOAT`-texturer lagras nerifrån och upp
---
Att vända fyrhörningens v var det som fick datan att stämma med OpenGL:s: i båda API:erna innehåller första raden strävhet 0. Debug-vyn är till för människor, som väntar sig grafens origo nere till vänster.
```
:::

## Att göra IBL-reflektansen färdig

För att få reflektansekvationens indirekta spekulära del att fungera måste vi foga ihop split sum-approximationens båda
delar. Vi börjar med att lägga till de förberäknade belysningsdata överst i PBR-shadern:

:::opengl
```glsl
uniform samplerCube prefilterMap;
uniform sampler2D brdfLUT;
```

på texturenheterna 1 och 2 (`pbrShader.setInt("prefilterMap", 1);`, `pbrShader.setInt("brdfLUT", 2);`, och i loopen
`prefilterMap` bunden till `GL_TEXTURE1` och `brdfLUTTexture` till `GL_TEXTURE2`, efter irradiansmappen på enhet 0).
:::
:::vulkan
```glsl
layout(binding = 2) uniform samplerCube prefilterMap;
layout(binding = 3) uniform sampler2D brdfLUT;
```

Layouten får tre bildbindningar – 1, 2, 3: `irradianceMap`, `prefilterMap`, `brdfLUT`, learnopengls texturenheter 0, 1, 2 –
(`std::array<VkDescriptorSetLayoutBinding, 4>`), poolen `5 * 3` image samplers, och `createDescriptorSet()` skriver de tre
vyerna i en loop (`dstBinding = i + 1`, `clampSampler` för var och en). Capture-passens och bakgrundens set med en enda
bild lämnar de andra bindningarna tomma; deras shadrar använder dem inte.
:::
:::d3d12
```hlsl
TextureCube prefilterMap : register(t1);
Texture2D brdfLUT : register(t2);
```

De får en egen tabell: `ranges[2].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 1)` (två SRV:er från t1) och
`rootParameters[3].InitAsDescriptorTable(1, &ranges[2], D3D12_SHADER_VISIBILITY_PIXEL)`. Förfiltermappen och
uppslagstexturen ligger bredvid varandra i heapen (platserna 4 och 5), så ett handtag täcker båda:

```cpp
    CD3DX12_GPU_DESCRIPTOR_HANDLE prefilterMap(m_cbvSrvHeap->GetGPUDescriptorHandleForHeapStart(), 4, m_cbvSrvDescriptorSize);
    m_commandList->SetGraphicsRootDescriptorTable(3, prefilterMap);
```

före sfärerna. t0 behåller sin egen tabell: capture-passen läser sin enda textur där, och en tabell som också täckte t1 och
t2 skulle peka på texturer som fortfarande ritas i medan de passen körs.
:::

Först hämtar vi ytans indirekta spekulära reflektioner genom att sampla den förfiltrerade environment mappen med
reflektionsvektorn `R = reflect(-V, N)`. Observera att vi samplar rätt mipnivå utifrån ytans strävhet, så att strävare ytor
får suddigare spekulära reflektioner:

```glsl
void main()
{
    [...]
    vec3 R = reflect(-V, N);

    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureLod(prefilterMap, R,  roughness * MAX_REFLECTION_LOD).rgb;
    [...]
}
```

I förfiltersteget konvolverade vi environment mappen upp till högst 5 mipnivåer (0 till 4), vilket vi här betecknar
`MAX_REFLECTION_LOD`, så att vi inte samplar en mipnivå där det inte finns några (relevanta) data. Strävheten 0.3 läser nivå
1.2, mellan nivåerna för 0.25 och 0.5 – det trilinjära filtret blandar dem.

Sedan samplar vi BRDF-uppslagstexturen med materialets strävhet och vinkeln mellan normalen och vyvektorn:

```glsl
vec3 F        = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
vec2 envBRDF  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
```

Med skalan och förskjutningen av F0 (här använder vi direkt det indirekta Fresnel-resultatet F) från
BRDF-uppslagstexturen kombinerar vi det med den vänstra förfilterdelen av IBL-reflektansekvationen och bygger upp det
approximerade integralresultatet som `specular`.

Det ger oss reflektansekvationens indirekta spekulära del. Kombinera nu det med den diffusa IBL-delen från förra kapitlet,
så får vi hela PBR-IBL-resultatet:

:::opengl vulkan
```glsl
    // ambient lighting (we now use IBL as the ambient term)
    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);

    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;

    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse    = irradiance * albedo;

    // sample both the pre-filter map and the BRDF lut and combine them together as per the Split-Sum approximation to get the IBL specular part.
    const float MAX_REFLECTION_LOD = 4.0;
    vec3 prefilteredColor = textureLod(prefilterMap, R,  roughness * MAX_REFLECTION_LOD).rgb;
    vec2 brdf  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    vec3 ambient = (kD * diffuse + specular) * ao;
```
:::
:::d3d12
```hlsl
    // ambient lighting (we now use IBL as the ambient term)
    float3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness);

    float3 kS = F;
    float3 kD = 1.0f - kS;
    kD *= 1.0f - metallic;

    float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb;
    float3 diffuse    = irradiance * albedo;

    // sample both the pre-filter map and the BRDF lut and combine them together as per the Split-Sum approximation to get the IBL specular part.
    const float MAX_REFLECTION_LOD = 4.0f;
    float3 prefilteredColor = prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD).rgb;
    float2 brdf = brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg;
    float3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    float3 ambient = (kD * diffuse + specular) * ao;
```

med `float3 R = reflect(-V, N);` efter `V`. `textureLod` blir `SampleLevel`.
:::

Observera att vi inte multiplicerar `specular` med kS, eftersom det redan finns en Fresnel-multiplikation i den.

```quiz
Shadern läser förfiltermappen med `textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD)` och `MAX_REFLECTION_LOD = 4.0`. Vad läser en sfär med strävheten 0.3?
- [ ] Mipnivå 0.3, den skarpaste nivån med lite oskärpa från filtret
- [ ] Mipnivå 4, den suddigaste, eftersom varje strävhet över 0 är sträv
- [ ] Nivån vars storlek är 0.3 × 64 texlar
- [x] Mipnivå 1.2: det trilinjära filtret blandar nivå 1 och 2, som förfiltrerades för strävheten 0.25 och 0.5 – varje nivå innehåller omgivningen suddad för strävhet = nivå / 4, så strävhet × 4 hittar rätt ställe mellan dem
---
Förfilterloopen renderade nivå `mip` med `roughness = mip / 4`; att läsa nivå `roughness * 4` inverterar det. Bakgrunden i uppgiften prefilter-map visade just nivå 1.2.
```

Ta bort debug-fyrhörningen igen (dess shaderobjekt eller pipeline och dess ritanrop), och visa environment mappen som
bakgrund igen på nivå 0.0. Gör nu uppgiften **specular**.

Tryck på **Build & run**: **sfärerna speglar omgivningen**. På de släta sfärerna i de vänstra kolumnerna ser du himlen i den
övre halvan och den mörkare marken i den nedre, med horisonten emellan; en stor vit fläck upp och till höger om mitten är
solen, som står bakom kameran; små färgade fläckar nära kanterna är lamporna; och de fyra punktljusens prickar finns kvar.
Åt höger suddas reflektionen ut till en mjuk glans. Metallraderna speglar i sin egen röda färg, och grönt och blått syns på
sfärerna för första gången: icke-metallers spekulära reflektion färgas inte av albedot. Det här är learnopengls
`2.2.1.ibl_specular`.

Hela scenen – direkt ljus, diffus IBL, spekulär IBL – kostar sfärernas fragment shader tre texturuppslagningar för
omgivningen; allt dyrt hände en gång, före första bildrutan.

## Texturerade sfärer

learnopengls sista demo, `2.2.2.ibl_specular_textured`, lägger texturerade material på sfärerna: fem sfärer av fem material
(rostigt järn, guld, gräs, plast och en vägg). Kursen har ett material, sitt nitade stål med rost, och visar det på
PBR-belysningskapitlets 3 × 3-rutnät av stora sfärer från sista uppgiften, så att reflektionerna kan jämföras på olika
ställen i omgivningen. Ändringarna är desamma som där – de fem mapparna, `getNormalFromMap()` med vertexens tangent,
albedot omvandlat med `pow(…, 2.2)`, rutnätet med avståndet 6.0, varje sfär skalad med 2.4 och vriden 90° kring y – utom var
mapparna hamnar, eftersom IBL-texturerna kommer först:

:::opengl
Mapparna tar texturenheterna 3–7 (learnopengls numrering): `pbrShader.setInt("albedoMap", 3);` …
`pbrShader.setInt("aoMap", 7);`, och i loopen `glActiveTexture(GL_TEXTURE3)` … `glActiveTexture(GL_TEXTURE7)` efter
IBL-texturerna.
:::
:::vulkan
Mapparna tar bindningarna 4–8 (learnopengls enheter 3–7) med `textureSampler` (repeat), IBL-bilderna behåller 1–3 med
`clampSampler`: layouten har 9 bindningar, poolen `5 * 8` image samplers, och `createDescriptorSet()` skriver åtta bilder –
`imageViews = {irradianceImageView, prefilterImageView, brdfLUTImageView, albedoImageView, normalImageView,
metallicImageView, roughnessImageView, aoImageView}` med `samplers = {clampSampler, clampSampler, clampSampler,
textureSampler, textureSampler, textureSampler, textureSampler, textureSampler}`.
:::
:::d3d12
Mapparna tar heap-platserna 13–17 (heapen växer till 18) och registren t3–t7, i en egen tabell:
`ranges[3].Init(D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 5, 3)`, `rootParameters[4].InitAsDescriptorTable(1, &ranges[3],
D3D12_SHADER_VISIBILITY_PIXEL)`, satt med handtaget på plats 13. De behöver en sampler med wrapping, IBL-texturerna en med
clamping, så det finns en andra statisk sampler, `samplers[1] = samplers[0];` med WRAP i u, v och w och `ShaderRegister =
1` (`SamplerState wrapSampler : register(s1);`). `ModelConstants` krymper till de två matriserna, 32 värden – ett färre än
`CaptureConstants` 33 –, så root-parameter 0 blir `InitAsConstants(sizeof(CaptureConstants) / 4, …)`: root-konstanterna
måste rymma den största struct som skickas genom dem.
:::

Gör nu den sista uppgiften, **textured**. Tryck på **Build & run**: nio stora sfärer av **nitat stål med rost framför
himlen**. Stålplåtarna speglar omgivningen mjukt – blåaktigt från himlen i de övre halvorna, mörkare nedtill, en ljus glans
där solen och punktljusen speglas –, spåren och de fyra nitarna runt varje sfärs mitt fångar ljuset på sidorna som vetter
mot det, och rostfläckarna förblir matt orangebruna, nu belysta av irradiansmappen (ljusare än i kapitlet PBR-belysning,
där bara den konstanta ambienta termen nådde dem). Jämför sfärerna: de översta speglar mer himmel, de nedersta mer mark.
Det här är lösningen, och slutet på learnopengls PBR-kapitel.

## Vad händer härnäst?

Förhoppningsvis har du i slutet av det här kapitlet en ganska klar bild av vad PBR handlar om, och till och med en
fungerande PBR-renderare. I de här kapitlen har vi räknat ut alla relevanta data för bildbaserad PBR-belysning i början av
programmet, före renderloopen. Det fungerade bra i undervisningssyfte, men inte så bra för praktiskt bruk av PBR. För det
första behöver förberäkningen egentligen bara göras en gång, inte vid varje start. Och för det andra måste du, så fort du
använder flera environment maps, räkna ut var och en av dem vid varje start, och det blir mycket.

Därför räknar man i regel ut en environment maps irradians- och förfiltermap en enda gång och sparar dem på disk
(observera att BRDF-integrationsmappen inte beror på någon environment map, så den behöver bara räknas ut eller laddas en
gång). Det betyder att du behöver ett eget bildformat för att lagra HDR-cube maps, med deras mipnivåer. Eller så sparar
(och laddar) du dem i något av de befintliga formaten (som `.dds`, som kan lagra mipnivåer).

Dessutom har vi i de här kapitlen beskrivit hela processen, inklusive att generera de förberäknade IBL-bilderna, för att
fördjupa förståelsen av PBR-pipelinen. Men det går lika bra att använda bra verktyg som cmftStudio eller IBLBaker för att
generera de förberäknade mapparna åt dig.

En sak vi har hoppat över är förberäknade cube maps som *reflection probes*: interpolation mellan cube maps och
parallaxkorrigering. Det handlar om att placera flera reflection probes i scenen som tar en cube map-ögonblicksbild av
scenen på just det stället, som vi sedan kan konvolvera till IBL-data för den delen av scenen. Genom att interpolera mellan
flera sådana prober utifrån kamerans närhet kan vi få lokal, detaljerad bildbaserad belysning, som bara begränsas av hur
många reflection probes vi är villiga att placera. På så sätt kan den bildbaserade belysningen uppdateras rätt när man till
exempel går från en ljus utomhusdel av en scen till en mörkare inomhusdel.

## Mer att läsa

- *Real Shading in Unreal Engine 4* av Brian Karis: förklarar Epic Games split sum-approximation, som det här kapitlet
  följer, och importance sampling av GGX.
- *Physically Based Shading and Image Based Lighting* av Trent Reed, *Implementation Notes: Runtime Environment Map
  Filtering for Image Based Lighting* av Padraic Hennessy och Holger Dammertz anteckningar om Hammersley-punkterna på
  halvsfären – alla länkade från learnopengls kapitel.

:::opengl
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengls kapitel som det här kapitlet
  följer, med bilder av förfilternivåerna, de ljusa prickarna och BRDF-integrationsmappen.
- [ibl_specular.cpp](https://github.com/JoeyDeVries/LearnOpenGL/blob/master/src/6.pbr/2.2.1.ibl_specular/ibl_specular.cpp):
  learnopengls program.
- [glGenerateMipmap](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glGenerateMipmap.xhtml): vad den gör för en
  cube map.
:::
:::vulkan
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengls kapitel som det här kapitlet
  följer, med bilder av förfilternivåerna, de ljusa prickarna och BRDF-integrationsmappen.
- [Generating Mipmaps](https://vulkan-tutorial.com/Generating_Mipmaps): vulkan-tutorials `generateMipmaps`, som här
  används för environment-cube mappens sex lager.
- [vkCmdBlitImage](https://registry.khronos.org/vulkan/specs/latest/man/html/vkCmdBlitImage.html): den skalade,
  filtrerade kopian som gör varje mipnivå.
:::
:::d3d12
- [PBR / IBL / Specular IBL](https://learnopengl.com/PBR/IBL/Specular-IBL): learnopengls kapitel som det här kapitlet
  följer, med bilder av förfilternivåerna, de ljusa prickarna och BRDF-integrationsmappen.
- [Subresources](https://learn.microsoft.com/en-us/windows/win32/direct3d12/subresources): mip slices, array slices och
  `D3D12CalcSubresource`.
- [Using resource barriers to synchronize resource states](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12):
  barriärer, även för enskilda subresurser.
:::
