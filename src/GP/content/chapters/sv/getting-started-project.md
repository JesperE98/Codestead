# Projekt: Planetariets skylt

Codesteads planetarium öppnar i morgon. Stolarna är fastskruvade, stjärnprojektorn surrar och kaffeautomaten
fungerar (för det mesta). Bara en sak saknas: skärmen ovanför entrén, där skylten ska sitta, visar en liten fyrkantig
trälåda på blågrön bakgrund.

– Det är det första folk kommer att se, säger föreståndaren och tittar upp på den. En låda. Med en smiley på. Hon
suckar. – Nåja, ansiktet får vara kvar – jag har vant mig vid det. Men få det att se ut som ett *planetarium*. Något
som lyser i mörkret. Du har tills dörrarna öppnas.

Allt du behöver finns i *Kom igång*: rensningsfärgen, vertexdatan, shaders med sina in, out och uniforms, och
texturerna med sina koordinater och wrapping. Inga matriser behövs – skylten ligger platt på skärmen, precis som din
rektangel har gjort hela tiden.

:::opengl
Börja från en kopia av ditt färdiga program från *Texturer* – samma filer: `main.cpp`, `shader_s.h`, `shader.vs`,
`shader.fs` och de två bilderna. En rektangel med texturkoordinater från 0 till 2, lådan (med `GL_CLAMP_TO_EDGE`)
blandad med ansiktet (med `GL_REPEAT`) genom uniformen `mixValue`, och en färg per hörn som vertex shadern skickar
vidare som `ourColor` – som ingen använder än.
:::
:::vulkan
Börja från en kopia av ditt färdiga program från *Texturer* – samma filer: `main.cpp`, `shaders/shader.vert`,
`shaders/shader.frag` och de två texturerna. En rektangel med texturkoordinater från 0 till 2, lådan (läst genom
`clampSampler`) blandad med ansiktet (läst genom `textureSampler`) genom push constanten `mixValue`, och en färg per
hörn som vertex shadern skickar vidare som `fragColor` – som ingen använder än.
:::
:::d3d12
Börja från en kopia av ditt färdiga program från *Texturer* – samma filer: `main.cpp`, `shaders.hlsl` och de två
texturerna. En rektangel med texturkoordinater från 0 till 2, lådan (samplad med `clampSampler`) blandad med ansiktet
(samplat med `wrapSampler`) genom root constanten `mixValue`, och en färg per hörn som vertex shadern skickar vidare
som `input.color` – som ingen använder än.
:::

## Uppdraget

1. **Släck ner.** Rensa fönstret till en djup nattblå färg: mörk, men tydligt blå.
2. **En bred skylt.** Ändra rektangelns hörn så att den blir en skylt ovanför en dörr: tydligt bredare än den är hög –
   till exempel från -0.9 till 0.9 på bredden och från -0.6 till 0.6 på höjden.
3. **Trä hela vägen.** Lådan finns bara på en del av skylten; resten är dess kant, utdragen. Låt i stället träet
   upprepas över hela skylten – fyra lådor på bredden och två på höjden (texturkoordinater upp till 4 och 2) blir
   prydliga kvadrater.
4. **Färg.** Använd hörnens färger: tona skylten med dem, så att den går från gult till rött längs överkanten och från
   blått till grönt längs underkanten.
5. **Skenet.** Låt hela skylten långsamt lysa starkare och svagare, om och om igen, med tiden från CPU:n.
6. **Ljuset springer.** Låt skenet vandra över skylten från vänster till höger, så att den ljusa delen rör sig längs
   den i stället för att hela skylten pulserar på en gång.

Delmålen i listan bredvid texten kontrolleras automatiskt när du klickar på **Kontrollera min kod**. Kontrollerna
tittar på bilden: hur bred skylten är, att den upprepas, färgerna i hörnen och hur ljusstyrkan ändras över tid – så
dina egna storlekar, koordinater, hastigheter och ljusstyrkor går bra. Bara för träet tittar de också på koden, för att
se att lådan inte längre klampas.

## Tips på vägen

- Den nattblå färgen är rensningsfärgen: en rad, och du vet var den står. Ungefär (0.03, 0.04, 0.15).
- Skylten är de fyra hörnens positioner. De är i normaliserade enhetskoordinater, så x och y går båda från -1 till 1
  över fönstret – och eftersom fönstret är 800 × 600 blir en skylt från -0.9 till 0.9 och -0.6 till 0.6 720 × 360
  pixlar.
:::opengl
- Två saker får träet att upprepas: texturkoordinater över 1 *och* en wrapping som upprepar. Lådans
  `GL_TEXTURE_WRAP_S` och `GL_TEXTURE_WRAP_T` är fortfarande `GL_CLAMP_TO_EDGE` från texturövningen.
- `ourColor` kommer redan in i `shader.fs`. Färger multipliceras kanal för kanal, så `* vec4(ourColor, 1.0)` tonar.
- Tiden är en ny uniform: `glfwGetTime()` i renderingsloopen, `ourShader.setFloat` som för `mixValue`, och
  `uniform float time;` i `shader.fs`. Något i stil med `0.7 + 0.3 * sin(time * 2.0)` går mellan 0.4 och 1.0;
  multiplicera färgens `rgb` med det.
:::
:::vulkan
- Två saker får träet att upprepas: texturkoordinater över 1 *och* en sampler som upprepar. Lådans descriptor
  (`imageInfo.sampler`) pekar fortfarande på `clampSampler` från texturövningen; `textureSampler` upprepar redan.
- `fragColor` kommer redan in i `shader.frag`. Färger multipliceras kanal för kanal, så `* vec4(fragColor, 1.0)`
  tonar. Kom ihåg att kompilera om shaders med `glslc` efter varje ändring.
- Tiden får plats i push constants, efter `mixValue`: en `float time` i C++-structen och i shaderns block, fylld i
  `recordCommandBuffer()` med samma `std::chrono`-rader som i *Shaders*. Något i stil med
  `0.7 + 0.3 * sin(pc.time * 2.0)` går mellan 0.4 och 1.0; multiplicera färgens `rgb` med det.
:::
:::d3d12
- Två saker får träet att upprepas: texturkoordinater över 1 *och* en sampler som upprepar. Pixel shadern samplar
  fortfarande lådan med `clampSampler` från texturövningen; `wrapSampler` upprepar redan.
- `input.color` kommer redan in i pixel shadern. Färger multipliceras kanal för kanal, så `* input.color` tonar.
- Tiden får plats i root constants, efter `mixValue`: en `float time` i structen `MixConstants` i båda filerna, fylld
  i `PopulateCommandList` med samma `std::chrono`-rader som i *Shaders*. Något i stil med
  `0.7f + 0.3f * sin(time * 2.0f)` går mellan 0.4 och 1.0; multiplicera färgens `rgb` med det.
:::
- För det springande ljuset behöver varje fragment lysa lite senare än sin granne till vänster. Fragment shadern har
  redan ett värde som växer från vänster till höger: texturkoordinaternas x. Dra av det inne i `sin`.

## Vill du göra mer?

När delmålen är klara är skylten din. Gör ansiktet blygt med upp- och nedpilarna så att bara en antydan till leende
finns kvar, eller låt `mixValue` andas med tiden också. Ge hörnen andra färger – en solnedgång, kanske, eller en
nebulosa. Låt ljuset springa åt andra hållet, eller fortare, eller i vågor ut från mitten. Eller prova
`GL_MIRRORED_REPEAT` (eller dess kusiner i Vulkan och Direct3D) och se lådorna mötas på halva vägen.
