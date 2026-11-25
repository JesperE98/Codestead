# Projekt: Materialutställningen

En liten designstudio har gjort sig ett namn med handgjorda klot – lampor, dörrvred, trädgårdsprydnader, ingen vet
riktigt. Det alla är överens om är att de ser underbara ut i verkligheten och förfärliga ut i webbutiken, där fotona
får guld att se ut som senap. Studions grundare har hört att du kan fysikaliskt baserad rendering och ber dig om en
3D-utställning: tre materialprov på en hylla, och ovanför dem studions stolthet, det nitade stålklotet, som sakta
snurrar på en skivtallrik.

Allt du behöver kommer från *PBR*: arbetsflödet med metallic och roughness, Cook-Torrance-BRDF:en och bildbaserad
belysning med en irradiance-karta, en förfiltrerad miljökarta och BRDF-uppslagstabellen. Inget här är nytt; utmaningen
är att sätta ihop bitarna själv.

![Den färdiga utställningen](images/results/pbr-project.webp "Ett sätt som den färdiga utställningen kan se ut på (ritat av kursens egen simulator).")

## Scenen du börjar med

Ditt projekt är programmet från *Specular IBL*: miljökartan bakom allt, fyra vita ljus på 300 i (±10, ±10, 10), och ett
rutnät av 3 × 3 stora klot (skalade 2,4, med 6 emellan) som alla får sitt material från det nitade stålets fem kartor –
albedo, normal, metallic, roughness och ambient occlusion. Kameran står i (0, 0, 22) och är riktad längs -z.

:::opengl
Kloten ritas i renderloopen i `main.cpp`, materialet och belysningen finns i `pbr.fs`.
:::
:::vulkan
Kloten ritas i `recordCommandBuffer()`, vart och ett med sin modellmatris i push constants (`struct PushConstants`,
som `shaders/pbr.vert` läser); materialet och belysningen finns i `shaders/pbr.frag`.
:::
:::d3d12
Kloten ritas i `RenderScene()`, vart och ett med sina matriser i root constants (`struct ModelConstants`, `cbuffer
ModelConstants` i `pbr.hlsl`, root parameter 0); materialet och belysningen finns i `pbr.hlsl`.
:::

## Uppdraget

1. **Gör plats.** Byt ut rutnätet mot utställningen: huvudklotet – fortfarande med stålets kartor – stort i mitten i
   (0, 2, 0), skalat 3,6, och under det en hylla med tre prov, skalade 2,4, i (-6, -6, 0), (0, -6, 0) och (6, -6, 0).
2. **Guld.** Det vänstra provet är äkta guld. Låt ett prov få sitt material från egna värden – ett albedo, en metallic
   och en roughness – i stället för kartorna, medan huvudklotet behåller sina kartor. Guld är en metall; dess albedo är
   färgen på dess reflektioner, ungefär (1.0, 0.71, 0.29), och det är ganska slätt.
3. **Matt plast.** Mittprovet är plast i en stark färg du väljer själv: ingen metall, och sträv, så att högdagern blir
   mjuk och bred och ingenting speglas skarpt.
4. **Polerad metall.** Det högra provet är polerat silver: en metall med ljusgrått albedo och nästan ingen roughness,
   så att det speglar rummet runt omkring.
5. **Skivtallriken.** Huvudklotet snurrar sakta runt sin lodräta axel, så att kunderna ser det från alla håll.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på **Kontrollera min kod**.

## Tips på vägen

- Ett provs materialvärden hör till en draw, precis som dess modellmatris.
:::opengl
  Uniforms som sätts före varje `renderSphere()` gör jobbet – en `bool`-uniform kan välja mellan värdena och kartorna.
:::
:::vulkan
  Push constants kan rymma mer än modellmatrisen: ge `PushConstants` materialet efter matrisen, och deklarera samma
  block i `pbr.frag` (vertex shadern kan fortsätta att bara läsa matrisen). Push constants läggs ut som std430: en
  `vec3` direkt efter `mat4`:an, och en GLSL-`bool` är 4 byte (`VkBool32`).
:::
:::d3d12
  Root constants kan rymma mer än de två matriserna: ge `ModelConstants` materialet efter dem, både i `main.cpp` och i
  `pbr.hlsl`, med samma namn (HLSL packar en `float3` och en `float` i samma rad på 16 byte). Root parameter 0 måste då
  rymma så många värden som den större structen har.
:::
- Utan kartorna finns ingen normal map heller: ett prov använder klotets egen normal, och dess ambient occlusion är
  helt enkelt 1,0.
- Kom ihåg regeln i metallic-arbetsflödet: en metall har ingen diffus färg, och dess albedo blir F0; en icke-metall har
  F0 = 0,04 och visar sitt albedo som diffus färg.
- Miljön finns i reflektionerna. Jämför din polerade metall med en strävare – den förfiltrerade kartans mipnivåer står
  för suddigheten.
- Skivtallriken behöver tiden sedan programmet startade och ytterligare en rotation i huvudklotets modellmatris.

## Vill du göra mer?

När utställningen har öppnat finns det mycket att prova på egen hand:

- **Fler prov.** Koppar (0.95, 0.64, 0.54), borstad aluminium, gummi, keramik – en hel hylla.
- **En roughness-trappa.** En rad av samma material, från spegelblankt till helt matt.
- **Utställningsbelysning.** Färgade spotlights eller ett varmt huvudljus från sidan i stället för de fyra vita ljusen.
- **Exponering.** Använd exponeringskurvan från *HDR* i stället för Reinhard, och hitta exponeringen som får guldet att
  glänsa.
- **En sockel.** Ställ huvudklotet på en piedestal – en kub med ett eget material.
