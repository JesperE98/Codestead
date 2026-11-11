# Sammanfattning: PBR

Grattis, du har nått slutet av delen *PBR* – och av learnopengls belysningskapitel. Du började med teorin om
mikrofasetter och reflektansekvationen; sedan dess har du gjort Cook-Torrance-BRDF:en till en shader för fyra punktljus,
steg för steg från en matt Lambertsk sfär till learnopengls rutnät av plast- och metallsfärer, gett sfärerna ett
texturerat material av nitat stål med rost, omvandlat en HDR-bild till en environment-cube map, konvolverat den till en
irradiansmap för det diffusa ambienta ljuset och lagt till det spekulära ambienta ljuset med en förfiltrerad environment
map och en BRDF-integrationsmap – Epic Games split sum-approximation. Den här sidan är en ordlista över delens viktigaste
begrepp, kapitel för kapitel, som de genomgångar learnopengl.com har i slutet av sina delar. Använd den för att slå upp
saker, och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet den kommer från.

PBR är matematik i shadrarna plus texturer som räknas ut i förväg; matematiken är densamma i alla API:er, så det mesta på
den här sidan står utanför rutorna. Det som skiljer är hur {{api}} gör arbetet som sker en gång före första bildrutan:
att rendera i sidorna och mipnivåerna i cube maps, att göra mipnivåer och att rita i en uppslagstextur med två kanaler. I
OpenGL får ett framebuffer-objekt en annan sida eller nivå inkopplad för varje pass, och allt körs direkt när det anropas.
I Vulkan får varje sida (och nivå) en bildvy och en framebuffer, passen spelas in i engångs-command buffers i
`initVulkan()` och skickas iväg och väntas på, och pipelines görs för en render pass och en topologi. I Direct3D 12 får
varje sida (och nivå) en render target view som skrivs i en återanvänd descriptor, passen spelas in i command listen i
`LoadAssets` och körs före första bildrutan, och barriärer – per subresurs där det behövs – gör render targets till shader
resources. När du är klar kontrollerar provet i slutet av delen vad du har lärt dig.

## PBR-teori

- **Fysikaliskt baserad rendering**: en belysningsmodell som approximerar hur ljus beter sig, så att en uppsättning
  materialparametrar ser rätt ut under alla ljus. Tre villkor: bygger på **mikrofasettmodellen**, **bevarar energin**, och
  använder en **fysikaliskt baserad BRDF**. Kursen följer Disneys och Epic Games angreppssätt, det **metalliska
  arbetsflödet**.
- **Mikrofasetter**: en yta modelleras som små perfekta speglar; **strävheten** (0 till 1) beskriver statistiskt hur
  kaotiskt de är riktade. En sträv yta sprider sin reflektion – bredare och svagare –, en slät koncentrerar den – liten
  och ljus. **Halvvägsvektorn** h = normalize(l + v) är den mikrofasettriktning som reflekterar l mot v.
- **Energibevarande**: det utgående ljuset blir aldrig större än det inkommande. Reflekterat (spekulärt) och brutet
  (diffust) ljus utesluter varandra: `kD = 1.0 - kS`. Metaller absorberar allt brutet ljus – ingen diffus färg. Brutet ljus
  som sprids inuti och kommer ut någon annanstans är **subsurface scattering**, som PBR här bortser från.
- **Radiometri**: **strålningsflöde** Φ (energi per tid, watt; i grafik en RGB-trippel), **rymdvinkel** ω (arean av en
  form projicerad på enhetssfären, i steradianer; en halvsfär är 2π), **strålningsintensitet** I = dΦ/dω, **radians** L =
  d²Φ / (dA · dω · cos θ) (ljuset längs en stråle, skalat med infallsvinkeln), **irradians** (summan av all inkommande
  radians i en punkt).
- **Reflektansekvationen**: `Lo(p, ωo) = ∫Ω fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi) dωi` – den utgående radiansen i
  vyriktningen är integralen över halvsfären Ω av den inkommande radiansen, viktad med BRDF:en fr och cosinus n · ωi.
  Den saknar analytisk lösning och löses numeriskt – en **Riemannsumma** av diskreta steg.
- **BRDF**: bidirectional reflective distribution function fr(ωi, ωo) – hur mycket ljus från ωi som reflekteras mot ωo.
  Blinn-Phong är också en BRDF, men bevarar inte energin.
- **Cook-Torrance**: `fr = kd · c / π + ks · (D · F · G) / (4 · (ωo · n) · (ωi · n))`. Den diffusa delen är
  **Lambertsk**, c / π – π normaliserar den; cosinus står utanför BRDF:en, i ekvationen. Eftersom F redan är den
  reflekterade andelen multipliceras ks inte in igen: `(kd · c / π + D · F · G / (4 · (ωo · n) · (ωi · n))) · Li ·
  (n · ωi)`.
- **NDF D, Trowbridge-Reitz GGX**: `α² / (π · ((n · h)² · (α² − 1) + 1)²)` – andelen mikrofasetter riktade längs h. Med
  α = roughness² (Disneys och Epics omräkning, så att strävheten ändrar utseendet jämnt).
- **Geometrifunktionen G, Schlick-GGX med Smiths metod**: `G_sub(n, v, k) = (n · v) / ((n · v) · (1 − k) + k)`,
  `G = G_sub(n, v, k) · G_sub(n, l, k)` – mikrofasetternas självskuggning (ljusriktningen) och skymning (vyriktningen).
  `k_direct = (α + 1)² / 8`, `k_IBL = α² / 2`, med α = strävheten i koden.
- **Fresnel F, Fresnel-Schlick**: `F0 + (1 − F0) · (1 − (h · v))⁵` – alla ytor reflekterar mer i strykande vinkel.
  **F0**, grundreflektiviteten vid vinkelrätt infall: dielektrika 0.02–0.17 och ofärgade, metaller 0.5–1.0 och färgade.
- **Metalliskt arbetsflöde**: `F0 = mix(vec3(0.04), albedo, metallic)` – 0.04 för alla icke-metaller, albedot för
  metaller – och `kD *= 1.0 - metallic`.
- **PBR-material**: **albedo** (färgen eller, för metaller, F0; ingen belysning i den; sRGB, så den omvandlas till
  linjär), **normal** (normal map i tangentrum), **metallic**, **roughness** (vissa motorer använder smoothness = 1 −
  roughness), **AO** (materialets ambient occlusion). Metallic, roughness och AO är linjära data. Kursens material är
  nitat stål med rost (learnopengl: rostigt järn): stålet metalliskt och slätare, rosten ett strävt dielektrikum.

## PBR-belysning

- **Ett punktljus radians**: bara en riktning ωi bär ljus, så integralen blir en summa över ljusen: `radiance =
  lightColor * attenuation`, multiplicerad med `NdotL` i ekvationen. Ett riktat ljus har en konstant ωi och ingen
  dämpning; en spotlights intensitet beror på dess riktning.
- **Omvända kvadratlagen**: `attenuation = 1.0 / (distance * distance)`, fysikaliskt korrekt i linjärt rum. Därav ljusens
  (300, 300, 300): på ungefär 17 enheters avstånd för 1/300 tillbaka dem till ungefär 1.0.
- **Scenen**: learnopengls 7 × 7 sfärer, 2.5 isär, `metallic = row / 7` (nederst 0),
  `roughness = clamp(col / 7, 0.05, 1.0)` (strävheten exakt 0 skulle göra ett punktljus högdager oändligt liten), albedo
  (0.5, 0, 0), ao 1.0; fyra ljus på (±10, ±10, 10). Kursens kamera står på (0, 0, 22) (learnopengl: (0, 0, 3), inne i
  rutnätet), sfären har 24 × 24 segment (learnopengl: 64 × 64 – kursen ritar sina kontroller och förväntade resultat på
  CPU:n), ingen multisampling.
- **UV-sfären**: 25 × 25 vertex på ett rutnät i (u, v), normal = position, och här en **tangent** per vertex
  (-sin 2πu, 0, cos 2πu) – riktningen där u växer. **Indexerad triangle strip**: raderna gås igenom i sicksack, 1200
  index; varje index efter de två första bildar en triangel med de två före det.
- **Shaderns steg**: `lambert` (matt rött, alla sfärer likadana), `ndf` (vita högdagrar som växer med strävheten – NDF:en
  ensam reflekterar mer än som kommer in), `geometry` (G och nämnaren: de sträva sfärerna inte längre vita), `fresnel`
  (F, F0 och kD: raderna skiljer sig, metaller förlorar sitt diffusa ljus och får röda högdagrar), `tone-map` (Reinhard
  och gamma: learnopengls bild), `textured`.
- **Linjärt och HDR**: belysningen räknas ut med linjära, obegränsade värden; `color / (color + 1.0)` (Reinhard) avbildar
  den på 0..1, sedan kodar `pow(color, 1.0 / 2.2)` den – en gång, sist. Utan efterbehandlingspass sker båda i slutet av
  forward-shadern.
- **Texturerad PBR**: albedo `pow(…, 2.2)` (en sRGB-textur skulle göra samma sak i samplern), metallic, roughness och ao
  från den röda kanalen. Normalen via en **TBN** byggd av den interpolerade normalen och vertexens tangent:
  `T = normalize(T - dot(T, N) * N)` (Gram-Schmidt), `B = cross(N, T)`. learnopengl härleder T från derivator i
  skärmrummet (`dFdx` / `dFdy`) i stället; vertexens tangent är jämn, behöver inga derivator och fungerar likadant i alla
  API:er. 3 × 3 stora sfärer (avstånd 6, skala 2.4, vridna 90° kring y så att texturens mitt vetter mot kameran).

:::opengl
- **Strippen**: `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – primitivtypen är en del av
  ritanropet.
- **Uniforms**: ljusen som `lightPositions[i]` / `lightColors[i]` – varje element i en uniform-array har sin egen
  location; `normalMatrix` en `mat3`-uniform per sfär.
- **Mapparna**: `loadTexture` (vänder vid laddning, mipmaps, `GL_REPEAT`), samplers på texturenheterna 0–4.
:::
:::vulkan
- **Strippen**: `inputAssembly.topology = VK_PRIMITIVE_TOPOLOGY_TRIANGLE_STRIP` – topologin är en del av pipelinen;
  `cullMode = VK_CULL_MODE_NONE`.
- **Per sfär**: push constants `{ mat4 model; float metallic; float roughness; }` (72 byte, vertex- och fragmentsteget);
  vertex shadern räknar ut normalmatrisen själv.
- **std140**: ljusens arrayer är `vec4` (arrayelement 16 byte isär); en float får plats efter en `vec3` (`albedo` + `ao`,
  `camPos` + `pad1`).
- **Mapparna**: `loadTexture` vänder vid laddning och gör alla mipnivåer med `generateMipmaps` (`vkCmdBlitImage`, Vulkans
  `glGenerateMipmap`); fem combined image samplers på bindningarna 1–5 med en REPEAT-`textureSampler`.
:::
:::d3d12
- **Strippen**: `IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP)` i command listen; pipeline statens
  `PrimitiveTopologyType` är `TRIANGLE` för både listor och strips.
- **Per sfär**: 38 root-konstanter (`model`, `normalMatrix` = `XMMatrixInverse(nullptr, model)` lagrad för HLSL,
  materialet); `albedo` och `metallic` delar en 16-bytesrad.
- **Ljusens arrayer**: `float4` i constant buffern – varje arrayelement börjar på en ny 16-bytesrad.
- **Texturkoordinater**: `(xSegment, 1 - ySegment)`, eftersom bilderna inte vänds (Direct3D:s v = 0 är översta raden).
  `float3x3(T, B, N)` har T, B, N som rader: `mul(tangentNormal, TBN)`.
- **Mapparna**: `LoadTexture` med en mipnivå (ingen `glGenerateMipmap`), fem SRV:er på heap-platserna 1–5, en tabell
  t0–t4 och en statisk WRAP-sampler.
:::

## Diffus irradians

- **Bildbaserad belysning (IBL)**: omgivningen som en enda stor ljuskälla – varje texel i en environment-cube map en
  ljuskälla. En form av ambient ljus som tar hänsyn till omgivningen.
- **Att dela integralen**: reflektansekvationens diffusa och spekulära delar är oberoende; den diffusa är
  `kd · c / π · ∫Ω Li(p, ωi) · (n · ωi) dωi`, en integral som bara beror på normalens riktning.
- **Konvolution och irradiansmappen**: att räkna ut den integralen en gång för varje riktning och lagra den i en cube map
  – **irradiansmappen**, samplad med normalen: `texture(irradianceMap, N)`. 32 × 32 per sida räcker: den ändras långsamt.
  Den förutsätter att p ligger i mappens mitt; motorer placerar **reflection probes** för att belysa olika ställen.
- **HDR-omgivning**: **Radiance-formatet `.hdr`** lagrar flyttal (8 bitar per kanal med gemensam exponent); de flesta
  omgivningar är **ekvirektangulära** – longituden åt sidan, latituden uppåt. `stbi_loadf` ger flyttal; kursens
  `environment.hdr` (512 × 256: himmel, en disig sol med radiansen ungefär 60, kullar, mark, tre lampor; learnopengl:
  `newport_loft.hdr`). Varje textur på vägen har flyttal, annars skulle solen klippas vid 1.0.
- **Från ekvirektangulär till cube map**: en kub ritad från sin mittpunkt med 90° projektion, bildförhållande 1, och sex
  vyer (+x, -x, +y, -y, +z, -z med uppvektorerna (0, -1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, -1, 0) –
  cube map-sidorna har bildens origo uppe till vänster); `SampleSphericalMap`: `uv = (atan(z, x), asin(y)) · (1/2π, 1/π)
  + 0.5`. 128 × 128 per sida här (learnopengl 512 × 512).
- **Bakgrunden**: kuben runt kameran med bara vyns rotation, `xyww` (djup 1.0), djupfunktionen mindre än eller lika med,
  ritad sist; HDR-färgen tonmappad och gammakorrigerad.
- **Konvolutionen**: för varje texel är N riktningen; halvsfären runt den i sfäriska koordinater, φ i 0..2π, θ i 0..π/2,
  steg `sampleDelta = 0.1` (learnopengl 0.025: 1008 samples per texel i stället för ungefär 16 000); varje sample viktat
  med `cos θ` (n · ωi) och `sin θ` (den mindre ytan nära toppen: dω = sin θ dθ dφ); resultatet `PI * irradiance /
  nrSamples` – π från stegstorlekarna tar ut den Lambertska 1/π.
- **Den ambienta termen**: `kS = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)` (ingen enskild
  halvvägsvektor; strävhetstermen `max(1 − roughness, F0)` hindrar sträva kanter från att glänsa), `kD = (1 − kS) ·
  (1 − metallic)`, `ambient = kD · irradiance · albedo · ao`. Icke-metaller belyses av himlen; metaller ändras knappt –
  deras ambienta ljus är spekulärt.

:::opengl
- **Inspelningen**: en `captureFBO` med en djup-renderbuffer; per sida `glFramebufferTexture2D(GL_FRAMEBUFFER,
  GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemap, 0)`; viewporten satt till sidans storlek och efteråt
  tillbaka till fönstrets. Allt före renderloopen.
- **Format**: `GL_RGB16F` för HDR-texturen och cube mapparna, `GL_CLAMP_TO_EDGE`, `GL_LINEAR`.
- **Djup**: `glDepthFunc(GL_LEQUAL)` för bakgrunden.
:::
:::vulkan
- **Inspelningen**: `createCaptureRenderPass(format, …)` – en färgattachment, inget djup, loadOp DONT_CARE (kuben täcker
  varje pixel), finalLayout `SHADER_READ_ONLY_OPTIMAL`; `createCubemap` – sex array-lager,
  `VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT`, en vy av typen `VK_IMAGE_VIEW_TYPE_CUBE`; `renderToCubemap` – en 2D-vy av ett
  lager (`baseArrayLayer = i`) och en framebuffer per sida, sex render passes i en engångs-command buffer
  (`beginSingleTimeCommands` / `endSingleTimeCommands`), anropad i `initVulkan()` före första bildrutan.
- **Per sida**: matrisen som push constant (`CapturePushConstants`) – en uniform buffer kan inte ändras mellan ritanropen
  i en command buffer.
- **Ingen y-vändning i capture-projektionen**: ett capture-pass skriver NDC y = -1 i rad 0 i Vulkan, som OpenGL gör i sin
  egen rad 0, och båda slår upp cube maps med samma tabell – lagren innehåller samma texlar.
- **Format**: `R32G32B32A32_SFLOAT` för HDR-bilden (`STBI_rgb_alpha`; linjär filtrering kontrollerad med
  `findSupportedFormat`), `R16G16B16A16_SFLOAT` för cube mapparna. `createPipeline` tar render passen och topologin;
  djupjämförelse `LESS_OR_EQUAL`; descriptor sets med en bild på bindning 1.
:::
:::d3d12
- **Inspelningen**: `SetCaptureTarget(cubemap, face, mip)` skriver en RTV av en array-skiva (`TEXTURE2DARRAY`,
  `FirstArraySlice = face`, `ArraySize = 1`) i den lediga RTV-descriptorn och binder den – `OMSetRenderTargets` kopierar
  descriptorn när anropet spelas in. Inspelad i `LoadAssets` med texturuppladdningarna, körd före första bildrutan; ingen
  djupbuffer, ingen rensning; en barriär RENDER_TARGET → PIXEL_SHADER_RESOURCE i slutet.
- **Y-vändningen**: `captureProjection = XMMatrixPerspectiveFovRH(…) * XMMatrixScaling(1, -1, 1)` – Direct3D skriver NDC
  y = +1 i en render targets första rad, OpenGL y = -1.
- **Format**: `R32G32B32A32_FLOAT` för HDR-texturen (filtrerbar på feature level 11.0; inte vänd, `uv.y = 1 - uv.y` i
  `SampleSphericalMap`), cube maps i `R16G16B16A16_FLOAT` med `TEXTURECUBE`-SRV:er.
- **En SRV-tabell (t0)** för texturen som varje pass läser; root-parameter 0 bär `ModelConstants` eller
  `CaptureConstants`.
- **`SampleLevel(…, 0.0f)`** i konvolutionens loop: `Sample` behöver derivator, som en loop med varierande antal varv inte
  tillåter.
:::

## Spekulär IBL

- **Split sum-approximationen** (Epic Games): `∫ Li · fr · (n · ωi) dωi ≈ ∫ Li dωi · ∫ fr · (n · ωi) dωi` – den första
  faktorn är den **förfiltrerade environment mappen**, den andra **BRDF-integrationsmappen**.
- **Förfiltrerad environment map**: omgivningen konvolverad med GGX-loben, en strävhet per mipnivå (mip / 4), med
  antagandet n = v = r (inga utdragna reflektioner i strykande vinkel). 64 × 64 med 5 nivåer här (learnopengl 128 × 128).
- **Monte Carlo-integration**: `∫ f(x) dx ≈ (1/N) Σ f(xi) / pdf(xi)` – slumpmässiga samples i stället för hela
  populationen. **Quasi-Monte Carlo**: samples från en **lågdiskrepanssekvens**, jämnare spridda, snabbare konvergens.
- **Hammersley-sekvensen**: `(i / N, RadicalInverse_VdC(i))`, **Van der Corput**-sekvensen genom bitreversering –
  heltalsoperationer på bitar i shadern.
- **Importance sampling**: samples genererade där GGX-NDF:en är stor – inom den spekulära loben: `phi = 2π · Xi.x`,
  `cosTheta = sqrt((1 − Xi.y) / (1 + (a² − 1) · Xi.y))` med a = roughness², H omvandlad till världsrummet,
  `L = 2 · dot(V, H) · H − V`; varje sample viktat med `NdotL`. 128 samples här (learnopengl 1024).
- **Sömmar**: låga mipnivåer behöver filtrering över kubsidorna – OpenGL:s `GL_TEXTURE_CUBE_MAP_SEAMLESS`; Vulkan och
  Direct3D gör det alltid.
- **Ljusa prickar och mipnivå-tricket**: få samples träffar eller missar en liten, mycket ljus källa; i stället läser
  varje sample omgivningen på nivån `0.5 · log2(saSample / saTexel)` med `saSample = 1 / (N · pdf)`, `saTexel = 4π /
  (6 · res²)` och `pdf = D · NdotH / (4 · HdotV)` – environment-cube mappen behöver mipnivåer för det.
- **BRDF-integrationsmappen**: F0 flyttat ut ur integralen, `F0 · A + B`, med A = ∫ fr / F · (1 − (1 − v · h)⁵) · (n · ωi)
  och B = ∫ fr / F · (1 − v · h)⁵ · (n · ωi); en 2D-textur med u = NdotV och v = strävheten, röd = skala, grön = bias;
  `V = (sqrt(1 − NdotV²), 0, NdotV)`, `G_Vis = G · VdotH / (NdotH · NdotV)`, `Fc = (1 − VdotH)⁵`, med `k_IBL = α² / 2`.
  128 × 128 med två 16-bitars flyttalskanaler, 128 samples (learnopengl 512 × 512, 1024). Oberoende av omgivningen.
- **Split sum i shadern**: `R = reflect(-V, N)`, `prefilteredColor = textureLod(prefilterMap, R, roughness ·
  MAX_REFLECTION_LOD)` (4.0), `brdf = texture(brdfLUT, (NdotV, roughness)).rg`, `specular = prefilteredColor · (F ·
  brdf.x + brdf.y)` med F från `fresnelSchlickRoughness`, `ambient = (kD · diffuse + specular) · ao` – specular
  multipliceras inte med kS igen.
- **Det du såg**: bakgrunden på förfilternivå 1.2 (suddig, ett varmt sken från en lampa, inga prickar), LUT:en över
  fönstret (rött till höger och nederst, gröngult nere till vänster), sedan sfärer som speglar himmel, mark, sol och
  lampor; icke-metallers reflektioner ofärgade. learnopengls sista demo har fem material; kursen visar sitt enda material
  på nio sfärer.
- **I praktiken**: räkna ut mapparna en gång och spara dem (med mipnivåer, t.ex. `.dds`), använd verktyg (cmftStudio,
  IBLBaker), och placera **reflection probes** med interpolation och parallaxkorrigering.

:::opengl
- **Mipnivåer**: omgivningens `GL_LINEAR_MIPMAP_LINEAR` och `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` efter inspelningen;
  för förfiltermappen reserverar `glGenerateMipmap` bara nivåerna.
- **Att rendera i en nivå**: `glFramebufferTexture2D(…, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, prefilterMap, mip)`,
  renderbuffern och viewporten med storleken `64 · 0.5^mip`, `roughness` en uniform.
- **LUT:en**: `GL_RG16F`, renderad på `renderQuad()` i `captureFBO`; dess v = 0 är första raden både vid skrivning och
  läsning. Texturenheter: irradians 0, förfilter 1, LUT 2, mapparna 3–7.
:::
:::vulkan
- **Mipnivåer**: omgivningen skapad med 8 nivåer och usage `TRANSFER_SRC | TRANSFER_DST`; `generateMipmaps(…, 128, 128, 8,
  6)` blittar varje nivå till nästa för alla sex lager.
- **Att rendera i en nivå**: `renderToCubemap(…, mipLevel, size, roughness)` – sidvyns `baseMipLevel`, strävheten i
  `CapturePushConstants`.
- **LUT:en**: `VK_FORMAT_R16G16_SFLOAT`, en egen render pass (`createCaptureRenderPass` med det formatet – en pipeline
  känner sin render pass format), `renderBrdfLUT()` i en engångs-command buffer. Datan är densamma som OpenGL:s; bara
  debug-vyn vänder v. Bindningar: irradians 1, förfilter 2, LUT 3, mapparna 4–8.
:::
:::d3d12
- **Mipnivåer genom att rita**: 8 nivåer, var och en ritad från den ovanför med `downsample.hlsl` (det linjära filtret
  tar medelvärdet av 2 × 2 texlar) genom en SRV av bara den nivån (`MostDetailedMip = mip − 1`, `MipLevels = 1`), med
  barriärer per subresurs: `D3D12CalcSubresource(mip, face, 0, mipLevels, 6)`. En nivå som ritas i får inte läsas.
- **Att rendera i en nivå**: `SetCaptureTarget(…, face, mip)` – RTV:ns `MipSlice`; `roughness` i `CaptureConstants` (33
  värden, så root-parameter 0 dimensioneras efter den när `ModelConstants` har 32).
- **LUT:en**: `R16G16_FLOAT`, `PSMain` returnerar en `float2`; fyrhörningens v = 0 överst är första raden – bara debug-vyn
  vänder v. Tabeller: t0 (irradians; passens textur), t1–t2 (förfilter, LUT), t3–t7 (mapparna, med en WRAP-sampler s1).
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Triangle strip | `glDrawElements(GL_TRIANGLE_STRIP, …)` | pipelinens topologi `TRIANGLE_STRIP` | `IASetPrimitiveTopology(…TRIANGLESTRIP)` |
| Arrayer i en uniform/constant buffer | `lightPositions[i]`-uniforms | std140: `vec4`-element | `float4`-element |
| Flyttalsbild från `stbi_loadf` | `GL_RGB16F` | `R32G32B32A32_SFLOAT` | `R32G32B32A32_FLOAT` |
| Cube map | `GL_TEXTURE_CUBE_MAP` | 6 lager, `CUBE_COMPATIBLE`, kubvy | 6 array-skivor, `TEXTURECUBE`-SRV |
| Rendera i en sida / nivå | `glFramebufferTexture2D(…, face, tex, mip)` | 2D-vy av ett lager och en nivå + framebuffer | RTV `TEXTURE2DARRAY`, `FirstArraySlice`, `MipSlice` |
| Capture-projektionens y | som learnopengl | som learnopengl (ingen vändning) | `* XMMatrixScaling(1, -1, 1)` |
| Pass en gång före första bildrutan | före renderloopen | engångs-command buffers i `initVulkan()` | inspelade i `LoadAssets` |
| En cube maps mipnivåer | `glGenerateMipmap` | `generateMipmaps` (`vkCmdBlitImage`) | ritade nivå för nivå, barriärer per subresurs |
| Sömlös kubfiltrering | `GL_TEXTURE_CUBE_MAP_SEAMLESS` | alltid | alltid |
| Flyttalsmål med två kanaler | `GL_RG16F` | `VK_FORMAT_R16G16_SFLOAT` | `DXGI_FORMAT_R16G16_FLOAT` |
| Sampling på en nivå | `textureLod` | `textureLod` | `SampleLevel` |

Med den här delen klar har du en fysikaliskt baserad renderare: en BRDF som bevarar energin, ljus med fysikaliska
intensiteter i en HDR-pipeline, material från fem mappar, och omgivningen som diffust och spekulärt ljus. Det är den
modell moderna motorer använder – det de lägger till är fler ljus (deferred eller clustered), skuggor, prober och bättre
approximationer, allt byggt på det du har skrivit i de här kapitlen.
