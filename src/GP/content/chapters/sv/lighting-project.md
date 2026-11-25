# Projekt: Premiärkväll

Codesteadteaterns nya uppsättning har premiär i kväll, och recensionerna är redan skrivna i allas huvuden: en djärv
ensembleföreställning med tio trälådor i rollerna. Lådorna kan sina repliker. Kostymerna sitter. Det är bara en liten
detalj kvar – ljusdesignern har rymt med en turnerande cirkus, och föreställningen börjar om två timmar.

– Du kan ju det här med ljus? säger inspicienten och trycker en skrivplatta i händerna på dig. Arbetsljuset av, lite
färg på scenen, en följestrålkastare på vår stjärna. Få det att se ut som konst.

Scenen är den du byggde i *Flera ljuskällor*: de tio lådorna, ett riktat ljus, fyra punktljus med sina lampor och
ficklampan. Ingenting här är nytt – färger, Phong, material, ljuskartor och ljuskällor är allt du behöver. Utmaningen
är att själv göra en föreställning av dem.

:::opengl
Börja från en kopia av ditt färdiga program från *Flera ljuskällor* – samma filer: `main.cpp`, `shader_m.h`,
`multiple_lights.vs`, `multiple_lights.fs`, `light_cube.vs`, `light_cube.fs` och de två kartorna. Renderingsloopen
sätter varje ljuskällas uniforms för hand och ritar sedan lådorna och lamporna.
:::
:::vulkan
Börja från en kopia av ditt färdiga program från *Flera ljuskällor* – samma filer: `main.cpp`, de fyra shadrarna i
`shaders/` och de två kartorna. `updateUniformBuffer()` fyller i varje ljuskälla i uniform-bufferten, och
`recordCommandBuffer()` ritar lådorna och sedan, med lampans pipeline, lamporna.
:::
:::d3d12
Börja från en kopia av ditt färdiga program från *Flera ljuskällor* – samma filer: `main.cpp`,
`multiple_lights.hlsl`, `light_cube.hlsl` och de två kartorna. `OnUpdate` fyller i varje ljuskälla i
konstantbufferten, och `PopulateCommandList` ritar lådorna och sedan, med lampans pipeline state, lamporna.
:::

## Uppdraget

1. **Ner med salongsljuset.** Teatern blir mörk: en rensningsfärg som är så gott som svart, och det riktade ljuset –
   salongens arbetsljus – avstängt (eller så svagt att det knappt räknas).
2. **Gelfilter.** Sätt färgade filter på punktljusen: minst två av dem i tydligt olika färger – till exempel blått,
   grönt, rosa och rött. Ljusets ambient-, diffus- och spekulära del tar alla dess färg.
3. **Färgade lampor.** Ett blått ljus som strålar ur en vit lampa ser ut som ett misstag. Låt varje lampa visa färgen
   på sitt eget ljus.
4. **Följestrålkastaren.** Ficklampan är inte längre publikens: häng spotlighten ovanför scenen – ett par enheter
   ovanför kameran, framför ensemblen – och rikta den ner mot föreställningens stjärna, låda 0. Ett varmt vitt passar
   den.
5. **Svepet.** En följestrålkastare som står still är bara en lampa. Låt spotlighten svepa över stjärnan från sida
   till sida allteftersom tiden går.
6. **Polering.** Lådorna har polerats inför premiären: ge materialet en mycket högre shininess, så att högdagrarna
   blir små och skarpa.

Delmålen i listan bredvid texten kontrolleras automatiskt när du klickar på **Kontrollera min kod**. Kontrollerna
läser värdena ditt program ger sina shaders och tittar på bilden: andra färger, positioner och hastigheter går bra.

## Tips på vägen

- Att stänga av ett ljus kräver ingen ny kod: ett ljus vars färger alla är noll tillför ingenting.
- En färg per punktljus är lättast att hålla i en array bredvid `pointLightPositions`. Ambient-delen brukar vara en
  liten bråkdel av den.
:::opengl
- Lampornas fragmentshader, `light_cube.fs`, ger rent vitt. Ge den en färg-uniform och sätt den i loopen som ritar
  lamporna – `lightCubeShader` är en egen shader.
:::
:::vulkan
- Lampornas fragmentshader, `shaders/light_cube.frag`, ger rent vitt. En färg per lampa får plats i push constants
  efter model-matrisen; fragmentsteget måste då finnas i push constant-intervallet och i varje `vkCmdPushConstants`.
:::
:::d3d12
- Lampornas pixelshader i `light_cube.hlsl` returnerar rent vitt. En färg per lampa får plats i root constants efter
  de två matriserna; deklarera hela `ModelConstants` i lampans shader så att färgen hamnar där `main.cpp` lägger den,
  och låt alla shadersteg se rotparametern.
:::
- En spotlights riktning är "dit den ska lysa minus där den är", gjord en enhet lång. Håll målpunkten i en variabel:
  svepet behöver bara flytta den.
- Svepet behöver tiden och en funktion som svänger fram och tillbaka – du har använt `sin` av tiden förut.
- Shininess är exponenten i den spekulära termen: ju större den är, desto mindre högdager.

## Vill du göra mer?

Föreställningen är din när delmålen är klara. Ge följestrålkastaren en smalare, hårdare kant för en dramatisk entré,
eller låt dess färg skifta under föreställningen. Låt gelfiltren pulsera i takt med en tänkt orkester, låt ett
punktljus gå i en cirkel runt stjärnan, eller dämpa hela scenen långsamt på slutet – en nedtoning till svart är
teaterns äldsta trick.
