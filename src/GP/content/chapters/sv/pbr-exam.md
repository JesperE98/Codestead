# Prov: PBR

Visa vad du har lärt dig i *PBR*: teorin om mikrofasetter och reflektansekvationen, Cook-Torrance-BRDF:en för punktljus,
texturerade PBR-material och bildbaserad belysning med en irradiansmap, en förfiltrerad environment map och en
BRDF-integrationsmap. Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in
svaren**; du behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
Vilka villkor måste en belysningsmodell uppfylla för att räknas som fysikaliskt baserad i learnopengls mening? (Flera svar är rätt.)
- [x] Den bygger på mikrofasettmodellen för ytor
- [ ] Den läser alla sina materialparametrar från texturer
- [x] Den bevarar energin: det reflekterade ljuset blir aldrig större än det inkommande
- [x] Den använder en fysikaliskt baserad BRDF
---
Texturer är ett bekvämt sätt att ange parametrarna, men de 7 × 7 sfärerna med uniform-värden är lika fysikaliskt baserade. HDR och linjär belysning behövs för att ge modellen fysikaliska värden, men de ingår inte i dess definition.
```

```quiz
Cook-Torrance-BRDF:en är `kd · c / π + ks · D · F · G / (4 (ωo · n)(ωi · n))`. Varför lyder shaderns sista rad `Lo += (kD * albedo / PI + specular) * radiance * NdotL` – utan `kS` framför `specular`?
- [ ] Eftersom ks alltid är 1.0 för punktljus
- [x] Eftersom Fresnelfaktorn F är andelen reflekterat ljus – den är ks – och redan finns i `specular`; att multiplicera med kS igen skulle räkna den två gånger
- [ ] Eftersom metaller saknar spekulär reflektion
- [ ] Eftersom geometrifunktionen redan innehåller ks
---
`kS = F` används bara för att räkna ut `kD = (1 - kS) * (1 - metallic)`, energin som finns kvar för den diffusa delen.
```

```quiz
En guldfärgad metall har albedot (1.0, 0.71, 0.29) och `metallic = 1.0`; en vit plast har albedot (0.9, 0.9, 0.9) och `metallic = 0.0`. Vilka grundreflektiviteter F0 ger det metalliska arbetsflödet dem?
- [ ] Båda (0.04, 0.04, 0.04): F0 är en konstant
- [ ] Båda sitt albedo: F0 är alltid ytans färg
- [ ] (0.04, 0.04, 0.04) för guldet och (0.9, 0.9, 0.9) för plasten
- [x] (1.0, 0.71, 0.29) för guldet – en färgad reflektion – och (0.04, 0.04, 0.04) för plasten – en svag, ofärgad
---
`F0 = mix(vec3(0.04), albedo, metallic)`. Plastens vita går i stället till dess diffusa ljus; guldet har inget diffust ljus alls (`kD *= 1 - metallic`).
```

```quiz
Vilken omräkning av strävheten använder Schlick-GGX för de fyra punktljusen, och vilken för BRDF-integrationsmappen?
- [x] `k = (roughness + 1)² / 8` för direkt ljus, `k = roughness² / 2` för IBL
- [ ] `k = roughness² / 2` för direkt ljus, `k = (roughness + 1)² / 8` för IBL
- [ ] `k = roughness` i båda fallen
- [ ] `k = roughness²` för båda; bara NDF:en använder en annan omräkning
---
Båda omräkningarna kommer från Epic Games anteckningar. NDF:en använder α = roughness² i båda fallen; k hör bara till geometrifunktionen.
```

```quiz
Efter uppgiften ndf är sfärerna i högra kolumnen vita över hela ytan, medan de i vänstra kolumnen har fyra pyttesmå vita prickar. Vad visar det?
- [ ] Att strävheten kvadreras två gånger
- [ ] Att halvvägsvektorn räknas ut fel
- [ ] Att ljusen sitter för nära högra kolumnen
- [x] Hur GGX-NDF:en beror på strävheten: koncentrerad kring h = n för släta ytor, utspridd över hela sfären för sträva – och att NDF:en ensam, utan G, F och nämnaren, reflekterar mycket mer ljus än som kommer in
---
NDF:en är en täthet av mikrofasettnormaler, ännu ingen BRDF som bevarar energin. Uppgifterna geometry och fresnel gör Cook-Torrance-termen färdig.
```

```quiz
Uppgiften textured läser albedot med `pow(…, 2.2)` och metallic, roughness och ao som de är. Vad skulle hända om även strävhetsmappen omvandlades med `pow(…, 2.2)`?
- [ ] Inget synligt: omvandlingen spelar bara roll för färger
- [ ] Rosten skulle bli metallisk
- [x] Materialet skulle ändras: strävheten 0.5 skulle bli ungefär 0.22, så hela ytan skulle se mycket slätare och blankare ut än avsett
- [ ] Normal mappen skulle inverteras
---
Datamappar skapas som linjära värden; bara färgbilder bär skärmens kurva och behöver omvandlingen (eller ett sRGB-format).
```

```quiz
I slutet av PBR-shadern tonmappas färgen med `color / (color + 1.0)` och gammakorrigeras sedan med `pow(color, 1.0 / 2.2)`. Varför räknas belysningen ut utan någondera fram till dess?
- [ ] Eftersom tonmappning bara behövs för bakgrunden
- [ ] Eftersom GPU:n inte kan räkna ut `pow` före belysningen
- [x] Eftersom PBR behöver linjära värden för sin matematik (att lägga ihop ljus, multiplicera med BRDF:en) och fysikaliska intensiteter som överstiger 1.0; Reinhard avbildar HDR-resultatet på 0..1 utan att klippa, och gammakodningen kommer sist, en gång
- [ ] Eftersom båda funktionerna är linjära, så ordningen spelar ingen roll
---
Före uppgiften tone-map var bilden mörk och hård: linjära värden skrivna direkt i fönstret och klippta vid 1.0.
```

```quiz
Varför är irradiansmappen bara 32 × 32 per sida, när environment-cube mappen den görs av har 128 × 128?
- [x] Eftersom irradiansen – det cosinusviktade medelvärdet över en hel halvsfär – ändras mycket långsamt med riktningen; en liten map med linjär filtrering återger den utan synlig förlust
- [ ] Eftersom en cube map mindre än 64 × 64 inte kan ha mipnivåer
- [ ] Eftersom irradiansmappen bara lagrar himlen, inte marken
- [ ] Eftersom cube maps med flyttal är begränsade till 32 × 32
---
Konvolutionen suddar bort alla detaljer: närliggande riktningar delar nästan hela sin halvsfär. learnopengl använder också 32 × 32.
```

```quiz
I irradianskonvolutionen multipliceras varje sample med `cos(theta) * sin(theta)`, och summan i slutet med `PI / nrSamples`. Var kommer `sin(theta)` och `PI` ifrån?
- [ ] Båda från Fresnelekvationen
- [x] `sin θ` från rymdvinkeln i sfäriska koordinater (dω = sin θ dθ dφ: samples nära toppen står för en mindre yta); π från Riemannsummans stegstorlekar, (2π / n1) · (π/2 / n2) = π² / n, där ett π tar ut den Lambertska 1/π
- [ ] `sin θ` gör resultatet ljusare nära horisonten; π omvandlar grader till radianer
- [ ] Båda från GGX-normalfördelningsfunktionen
---
`cos θ` är reflektansekvationens n · ωi. Mappen lagrar π gånger medelvärdet, så PBR-shadern multiplicerar irradiansen bara med albedot.
```

```quiz
Bakgrundskuben ritas sist, med `clipPos.xyww` och djuptestet mindre än eller lika med. Vad skulle hända med standardtestet mindre än?
- [ ] Bakgrunden skulle täcka sfärerna
- [ ] Ingenting: djupet 1.0 är mindre än alla värden i djupbuffern
- [ ] Bakgrunden skulle bara synas bakom metallsfärerna
- [x] Den skulle försvinna: dess djup är exakt 1.0, värdet djupbuffern rensas till, och 1.0 < 1.0 underkänns överallt
---
Med mindre än eller lika med klarar den testet precis där ingen sfär har skrivit ett närmare djup. Att rita den sist låter sfärernas pixlar underkänna den innan dess fragment shader körs.
```

```quiz
Den ambienta termen använder `fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness)` i stället för `fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0)`. Varför?
- [ ] Eftersom irradiansmappen innehåller halvvägsvektorerna
- [ ] Eftersom N · V alltid är större än H · V
- [x] Det ambienta ljuset kommer från hela halvsfären, så det finns ingen enskild halvvägsvektor; N · V får ersätta den, och strävhetstermen `max(1 − roughness, F0)` hindrar sträva ytor från att reflektera lika starkt i strykande vinkel som släta
- [ ] Eftersom strävheten måste tillämpas två gånger för indirekt ljus
---
Utan den skulle kS stiga till 1 vid varje sfärs kant och kD sjunka till 0 där: sträva icke-metaller skulle få ljusa, spegelaktiga kanter.
```

```quiz
Vilka är split sum-approximationens två faktorer, och vad beror var och en på?
- [x] Den förfiltrerade environment mappen – omgivningen konvolverad med GGX-loben, en strävhet per mipnivå, läst med reflektionsvektorn – och BRDF-integrationsmappen – en skala och en förskjutning för F0, läst med (NdotV, roughness), oberoende av omgivningen
- [ ] Irradiansmappen och den förfiltrerade environment mappen, båda lästa med normalen
- [ ] Den diffusa och den spekulära BRDF:en, var och en lagrad i en kanal i uppslagstexturen
- [ ] Det direkta ljuset och det ambienta ljuset, som läggs ihop i slutet av shadern
---
Hela den spekulära integralen beror på ljusriktningen, vyriktningen och strävheten. Att dela upp den i en produkt av två integraler med färre indata var gör båda möjliga att tabellera.
```

```quiz
Kursens omgivning har en liten sol som är ungefär 60 gånger ljusare än vitt. Vad gör förfiltershadern för att de sträva mipnivåerna inte ska visa ljusa prickar?
- [ ] Den klämmer varje sample till 1.0 innan det läggs till
- [x] Den samplar omgivningen på en mipnivå som väljs utifrån varje samples sannolikhet: `0.5 * log2(saSample / saTexel)` – ett sällsynt sample, som står för en stor rymdvinkel, läser en suddigare nivå, där solen redan är utspridd över den yta samplet står för
- [ ] Den använder 1024 samples i stället för 128
- [ ] Den hoppar över de samples som träffar solen
---
Med bara nivå 0 träffar vissa texlars 128 samples den lilla solen och andras missar den. Tricket kräver att environment-cube mappen har mipnivåer.
```

```quiz
BRDF-integrationsmappen ritas på en skärmfyrhörning. Vad innehåller dess axlar och kanaler?
- [ ] u = strävheten, v = NdotL; röd = D, grön = G
- [ ] u och v sfärens texturkoordinater; röd och grön omgivningens färg
- [ ] u = NdotV, v = strävheten; röd = det diffusa ljuset, grön = det spekulära ljuset
- [x] u = NdotV, v = strävheten; röd = skalan som tillämpas på F0, grön = förskjutningen som läggs till: `specular = prefilteredColor * (F * brdf.x + brdf.y)`
---
I strykande vinkel på släta ytor (nere till vänster) dominerar förskjutningen – allt reflekterar, vad F0 än är; tittar man rakt på en yta (höger) räknas F0 fullt ut.
```

```quiz
Förfiltermappen renderades med `roughness = mip / 4` för sina nivåer 0 till 4. En sfär har strävheten 0.5. Vilken nivå läser `textureLod(prefilterMap, R, roughness * MAX_REFLECTION_LOD)`?
- [ ] Nivå 0.5, mellan nivå 0 och 1
- [ ] Nivå 4, eftersom MAX_REFLECTION_LOD är 4
- [x] Nivå 2.0 – exakt den nivå som filtrerades för strävheten 0.5
- [ ] Nivå 1, eftersom strävheten kvadreras först
---
Att multiplicera med 4 inverterar `mip / 4`. Strävheten 0.3 skulle läsa nivå 1.2, som det trilinjära filtret blandar av nivå 1 och 2.
```

:::opengl
```quiz
Hur ritar OpenGL-projektet sfärens 1200 index som en enda triangle strip?
- [ ] Med `glPrimitiveRestartIndex` mellan raderna
- [x] Med `glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0)` – primitivtypen är ett argument till ritanropet, och raderna gås igenom i sicksack så att en strip täcker dem alla
- [ ] Med ett vertex array-objekt skapat med flaggan `GL_TRIANGLE_STRIP`
- [ ] Med `glDrawArrays(GL_TRIANGLES, 0, 1200)`
---
Varje index efter de två första bildar en triangel med de två före det, så strippen behöver ungefär ett index per triangel.
```
:::
:::vulkan
```quiz
Hur ritar Vulkan-projektet sfärens 1200 index som en enda triangle strip, och bakgrundskuben som en triangellista?
- [ ] Med ett argument till `vkCmdDrawIndexed` som anger topologin för varje ritanrop
- [ ] Med en pipeline vars topologi ändras med `vkCmdSetPrimitiveTopology` före varje ritanrop
- [ ] Genom att göra om strippen till en lista i `createSphere()`
- [x] Med olika pipelines: topologin är en del av pipelinen (`inputAssembly.topology`), så `createPipeline` tar den som parameter – `TRIANGLE_STRIP` för `pbrPipeline`, `TRIANGLE_LIST` för kubens pipelines
---
Precis som render passen är input assembly-tillståndet inbakat i en pipeline. (Dynamisk topologi finns som extension och i nyare Vulkan-versioner; kursen använder den inte.)
```
:::
:::d3d12
```quiz
Hur ritar Direct3D 12-projektet sfärens index som en triangle strip och bakgrundskuben som en triangellista?
- [ ] Med två pipeline states, en med `PrimitiveTopologyType` STRIP och en med LIST
- [ ] Genom att göra om strippen till en lista i `LoadAssets`
- [x] Med `IASetPrimitiveTopology` före varje ritanrop – `RenderSphere()` sätter `TRIANGLESTRIP`, `RenderCube()` `TRIANGLELIST`; pipeline statens `PrimitiveTopologyType` är `TRIANGLE` för båda
- [ ] Med ett argument till `DrawIndexedInstanced` som anger topologin
---
Pipeline staten bestämmer typen av primitiv (triangel), command listen om trianglarna kommer som lista eller strip.
```
:::

:::opengl
```quiz
Hur renderar OpenGL-projektet den ekvirektangulära bilden i de sex sidorna av `envCubemap`?
- [x] Med `captureFBO`: för varje sida `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0)`, sidans vymatris, `glClear` och `renderCube()`, med en viewport på 128 × 128 – en gång, före renderloopen
- [ ] Med sex framebuffers som ritas parallellt av sex trådar
- [ ] Med en geometry shader som skriver `gl_Layer`, i ett ritanrop
- [ ] Genom att rita i fönstret sex gånger och kopiera med `glCopyTexSubImage2D`
---
Viewporten måste ha sidans storlek under inspelningen och sättas tillbaka till fönstrets storlek efteråt.
```
:::
:::vulkan
```quiz
Hur renderar Vulkan-projektet den ekvirektangulära bilden i de sex sidorna av environment-cube mappen?
- [ ] Med en framebuffer vars attachment är kubvyn
- [ ] Med en geometry shader som skriver `gl_Layer`, i en render pass i varje bildruta
- [x] `renderToCubemap` gör en 2D-vy av varje lager (`baseArrayLayer = i`) och en framebuffer med den, och spelar in sex capture-render passes i en engångs-command buffer som skickas iväg och väntas på – i `initVulkan()`, före första bildrutan
- [ ] Genom att kopiera HDR-bilden till de sex lagren med `vkCmdCopyBufferToImage`
---
Capture-passets render pass har en färgattachment och inget djup, loadOp DONT_CARE (kuben täcker varje pixel) och finalLayout `SHADER_READ_ONLY_OPTIMAL`, så sidan är redo att samplas efter passet.
```
:::
:::d3d12
```quiz
Hur renderar Direct3D 12-projektet den ekvirektangulära bilden i de sex sidorna av `m_envCubemap`?
- [ ] Med sex separata texturer, som sätts ihop med `CopyTextureRegion`
- [x] `SetCaptureTarget` skriver en RTV av en array-skiva (`TEXTURE2DARRAY`, `FirstArraySlice = face`, `ArraySize = 1`) i den lediga RTV-descriptorn och binder den; de sex passen spelas in i `LoadAssets` och körs före första bildrutan, sedan gör en barriär cube mappen till shader resource
- [ ] Med cube mappens `TEXTURECUBE`-SRV bunden som render target
- [ ] Med en geometry shader som skriver `SV_RenderTargetArrayIndex`, i varje bildruta
---
`OMSetRenderTargets` kopierar descriptorn när anropet spelas in, så en och samma descriptorplats kan skrivas om för varje sida.
```
:::

:::opengl
```quiz
learnopengls capture-vyer använder uppvektorn (0, -1, 0) för sidoytorna. Varför?
- [ ] Eftersom OpenGL:s NDC-y pekar nedåt
- [ ] För att vända vindningen så att kubens insida inte cullas
- [x] Eftersom cube map-sidor adresseras med bildens origo uppe till vänster (en konvention från RenderMan); med de här uppvektorerna hamnar varje bild i sin sida så att en uppslagning med en riktning ger rätt texel
- [ ] Det spelar ingen roll: alla uppvektorer ger samma cube map
---
Med uppvektorerna vända skulle sidorna lagras upp och ner, och bakgrunden skulle visa marken ovanför horisonten på sidoytorna.
```
:::
:::vulkan
```quiz
Vulkan-projektets fönsterprojektion har `proj[1][1] *= -1`, men dess capture-projektion har det inte. Varför är det rätt?
- [x] Eftersom en cube map-uppslagning använder samma tabell i båda API:erna, och ett capture-pass i Vulkan skriver NDC y = -1 i ett lagers rad 0 precis som OpenGL skriver det i sin rad 0 (den nedersta); med learnopengls oförändrade matriser innehåller lagren OpenGL:s texlar
- [ ] Eftersom `GLM_FORCE_DEPTH_ZERO_TO_ONE` vänder y i inspelningen
- [ ] Eftersom capture-passets render pass vänder y i sin övergång till finalLayout
- [ ] Det är det inte: bakgrunden är upp och ner, vilket ingen märker i himlen
---
Fönstret behöver vändningen eftersom människor tittar på dess rader; en cube map samplas bara, så det enda som spelar roll är att skrivningen och uppslagningstabellen stämmer överens.
```
:::
:::d3d12
```quiz
Varför slutar Direct3D 12-projektets capture-projektion med `* XMMatrixScaling(1.0f, -1.0f, 1.0f)`?
- [ ] Eftersom `XMMatrixPerspectiveFovRH` är vänsterhänt
- [ ] För att hindra att kubens insidor cullas
- [ ] Eftersom Direct3D ordnar cube map-sidorna annorlunda än OpenGL
- [x] Eftersom Direct3D skriver NDC y = +1 – bildens överkant – i en render targets första rad, OpenGL y = -1; sidorna adresseras likadant i båda, så utan vändningen skulle varje sida lagras upp och ner
---
Skuggprojektionen i kapitlet Punktskuggor gjorde likadant. Ingenting cullas, så den omvända vindningen spelar ingen roll.
```
:::

:::opengl
```quiz
Mipnivå-tricket behöver mipnivåer i environment-cube mappen. Hur gör OpenGL-projektet dem?
- [ ] De görs automatiskt när cube mappens sidor renderas
- [x] `GL_LINEAR_MIPMAP_LINEAR` som cube mappens minifieringsfilter och `glGenerateMipmap(GL_TEXTURE_CUBE_MAP)` direkt efter att de sex sidorna har spelats in
- [ ] Genom att rendera varje nivå med konverteringsshadern
- [ ] Med `glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS)`
---
`GL_TEXTURE_CUBE_MAP_SEAMLESS` handlar om filtrering över sidorna, en annan sak. För förfiltermappen reserverar `glGenerateMipmap` bara nivåerna, som sedan alla renderas.
```
:::
:::vulkan
```quiz
Mipnivå-tricket behöver mipnivåer i environment-cube mappen. Hur gör Vulkan-projektet dem?
- [ ] Med en sampler vars `mipmapMode` är `VK_SAMPLER_MIPMAP_MODE_LINEAR`
- [ ] Genom att rendera varje nivå med konverteringens pipeline
- [ ] Med `vkCmdCopyImage` från nivå 0 till varje nivå
- [x] Bilden skapas med 8 nivåer och usage `TRANSFER_SRC | TRANSFER_DST`, och `generateMipmaps(envCubemapImage, VK_FORMAT_R16G16B16A16_SFLOAT, 128, 128, 8, 6)` blittar varje nivå till nästa för alla sex lager
---
`vkCmdBlitImage` med `VK_FILTER_LINEAR` är en skalad, filtrerad kopia; en vanlig kopia kan inte ändra storleken. Samplern blandar bara mellan nivåer som finns.
```
:::
:::d3d12
```quiz
Mipnivå-tricket behöver mipnivåer i environment-cube mappen. Hur gör Direct3D 12-projektet dem?
- [x] Genom att rita: varje nivå från den ovanför med `downsample.hlsl`, genom en SRV som bara visar den nivån (`MostDetailedMip = mip - 1`, `MipLevels = 1`), och barriärer per subresurs (`D3D12CalcSubresource(mip, face, 0, EnvMipLevels, 6)`) som gör varje färdig nivå till shader resource
- [ ] Med `ID3D12GraphicsCommandList::GenerateMips`
- [ ] Med en statisk sampler vars `MaxLOD` är 8
- [ ] Genom att ladda upp åtta mindre kopior av HDR-bilden
---
Direct3D 12 har inget anrop för att generera mipmaps. En nivå som ritas i är i tillståndet RENDER_TARGET och får inte läsas – därav vyerna med en enda nivå.
```
:::

:::opengl
```quiz
När körs OpenGL-projektets IBL-pass – konvertering, mipnivåer, konvolution, förfilter, BRDF-integration?
- [ ] I varje bildruta, före sfärerna
- [ ] Bara i första bildrutan, bakom en flagga i renderloopen
- [ ] I en andra tråd, medan de första bildrutorna ritas
- [x] En gång, i `main` före renderloopen: varje OpenGL-anrop körs i ordning, så mapparna är färdiga före första bildrutan
---
Ett riktigt program skulle räkna ut dem en gång och spara dem på disk. BRDF-integrationsmappen beror inte ens på omgivningen.
```
:::
:::vulkan
```quiz
När körs Vulkan-projektets IBL-pass – konvertering, mipnivåer, konvolution, förfilter, BRDF-integration?
- [ ] I varje bildruta, inspelade i bildrutans command buffer före sfärerna
- [x] En gång, i `initVulkan()`: varje steg spelar in en engångs-command buffer (`beginSingleTimeCommands`), och `endSingleTimeCommands` skickar iväg den och väntar tills den har körts – innan bildrutornas command buffer skapas
- [ ] Bara i första bildrutan, bakom en flagga i `recordCommandBuffer()`
- [ ] Varje gång swap chainen skapas om
---
Att vänta efter varje steg är enkelt och ordnar passen: konvolutionen kan bara börja när environment-cube mappen är klar.
```
:::
:::d3d12
```quiz
När körs Direct3D 12-projektets IBL-pass – konvertering, mipnivåer, konvolution, förfilter, BRDF-integration?
- [ ] I varje bildruta, inspelade i `PopulateCommandList` före sfärerna
- [ ] Bara i första bildrutan, bakom en flagga i `PopulateCommandList`
- [x] En gång: de spelas in i `LoadAssets` i den command list som också bär texturuppladdningarna, och körs i slutet av `LoadAssets`, före första bildrutan; barriärer mellan passen ordnar dem
- [ ] På en kopieringskö, parallellt med de första bildrutorna
---
Alla pass ligger i en command list, så det är barriärerna (RENDER_TARGET → PIXEL_SHADER_RESOURCE) som får varje pass att vänta på det förras skrivningar.
```
:::

:::opengl
```quiz
I den sista uppgiften i Spekulär IBL läggs de fem materialmapparna till. Var hamnar de i OpenGL-projektet?
- [x] På texturenheterna 3–7, eftersom 0–2 är upptagna av irradiansmappen, förfiltermappen och BRDF-integrationsmappen
- [ ] På enheterna 0–4, i stället för IBL-texturerna
- [ ] I IBL-texturernas alfakanaler
- [ ] I en array-textur på enhet 0
---
learnopengl numrerar dem likadant: `irradianceMap` 0, `prefilterMap` 1, `brdfLUT` 2, sedan `albedoMap` 3 … `aoMap` 7.
```
:::
:::vulkan
```quiz
I den sista uppgiften i Spekulär IBL läggs de fem materialmapparna till. Var hamnar de i Vulkan-projektet?
- [ ] I ett andra descriptor set på set 1
- [ ] På bindningarna 1–5, i stället för IBL-bilderna
- [x] På bindningarna 4–8 i sfärernas descriptor set, med REPEAT-`textureSampler`, medan IBL-bilderna behåller bindningarna 1–3 med `clampSampler`: layouten har 9 bindningar
- [ ] I push constants
---
Bindningarna följer learnopengls texturenheter förskjutna med ett, eftersom bindning 0 är uniform buffern. Capture-passens set med en enda bild lämnar de andra bindningarna tomma.
```
:::
:::d3d12
```quiz
I den sista uppgiften i Spekulär IBL får materialmapparna en tabell (t3–t7) och `ModelConstants` krymper till de två matriserna (32 värden). Varför blir root-parameter 0 nu `InitAsConstants(sizeof(CaptureConstants) / 4, …)`?
- [ ] Eftersom sfärerna nu läser `CaptureConstants`
- [x] Eftersom root-parameter 0 bär båda structarna – `ModelConstants` för sfärerna, `CaptureConstants` (33 värden med strävheten) för capture-passen – och måste vara stor nog för den största
- [ ] Eftersom root-konstanter måste vara en multipel av 33 värden
- [ ] Eftersom den statiska samplern s1 behöver en root-konstant till
---
Fram till dess var `ModelConstants` (38 värden med materialet) den största. Varje pipelines shadrar läser sin egen cbuffer på b0.
```
:::
