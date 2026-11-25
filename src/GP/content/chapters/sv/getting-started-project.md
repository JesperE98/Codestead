# Projekt: Ett litet solsystem

Codesteads planetarium har ett problem. Skolklasserna kommer i morgon bitti, stjärnprojektorn har just gett upp med
en ledsen liten smäll, och den enda 3D-modellen i förrådet är… en trälåda. En hel kartong med dem, faktiskt.

– Kan du inte göra ett solsystem av de där? frågar föreståndaren och tittar på dig över glasögonen. En sol, en
planet, en måne. Som rör sig. Barnen kommer aldrig att märka något.

Det kommer de. Men med det du lärt dig i *Kom igång* kan det ändå bli ett riktigt fint solsystem. Ingenting här är
nytt: utmaningen är att själv kombinera fönster, shaders, texturer, transformationer och kamera.

:::opengl
Börja från en kopia av ditt färdiga program från *Kamera* – samma filer: `main.cpp`, `shader_m.h`, `shader.vs`,
`shader.fs` och de två bilderna. Tio lådor, en fri kamera i (0, 0, 3) och en renderingsloop som ritar varje låda med
sin egen `model`-matris.
:::
:::vulkan
Börja från en kopia av ditt färdiga program från *Kamera* – samma filer: `main.cpp`, `shaders/shader.vert`,
`shaders/shader.frag` och de två texturerna. Tio lådor, en fri kamera i (0, 0, 3), `updateUniformBuffer()` för vy och
projektion, och `recordCommandBuffer()`, som skickar varje lådas `model`-matris som push constant före dess ritanrop.
:::
:::d3d12
Börja från en kopia av ditt färdiga program från *Kamera* – samma filer: `main.cpp`, `shaders.hlsl` och de två
texturerna. Tio lådor, en fri kamera i (0, 0, 3), `OnUpdate` för vy och projektion, och `PopulateCommandList`, som
sätter varje lådas `model`-matris som root constants före dess ritanrop.
:::

## Uppdraget

1. **Natten faller.** Rensa fönstret till en natthimmel: nästan svart, kanske med en aning blått.
2. **En plats på läktaren.** Flytta kameran uppåt och bakåt så att den tittar *ner* på världens mitt snett uppifrån –
   ungefär 6 enheter upp och 8 bakåt passar bra. Det ska fortfarande vara en kamera du kan flyga med tangenterna och
   musen.
3. **Varde sol.** De tio lådorna får gå hem. I stället en enda låda mitt i världen, tydligt större än de andra var
   (dubbelt så stor är bra), som långsamt snurrar runt sin egen lodräta axel.
4. **En planet.** En andra, mindre låda som kretsar runt solen – alltid på samma avstånd, några enheter ut.
5. **En måne.** En tredje, ännu mindre låda som kretsar runt *planeten* medan planeten kretsar runt solen. Det här är
   projektets kärna: månens matris måste utgå från planetens.
6. **Färg.** Ge varje himlakropp sin egen färg – en gul sol, en blå planet, en grå måne, eller vad ditt solsystem nu
   föredrar – blandad med lådans textur så att träet syns igenom.

Delmålen i listan bredvid texten kontrolleras automatiskt när du klickar på **Kontrollera min kod**. Kontrollerna
tittar på var dina matriser placerar himlakropparna, inte på dina siffror: andra storlekar, avstånd och hastigheter
går bra, så länge solen stannar i mitten, planeten håller sitt avstånd till solen och månen sitt avstånd till
planeten.

## Tips på vägen

- Natthimlen är rensningsfärgen: en rad, och du vet var den står.
- Kameran utgår från `cameraPos` och `cameraFront`. Positionen (0, 6, 8) och en riktning som pekar tillbaka mot
  origo, (0, -6, -8) gjord en enhet lång, fungerar fint. Muskoden gör om `yaw` och `pitch` till en riktning första
  gången du rör musen: låt `pitch` börja på den vinkel du redan tittar nedåt med (dess sinus är riktningens y), så
  hoppar inte vyn.
:::opengl vulkan
- Matriserna verkar från höger till vänster – eller, i koden, nerifrån och upp: raden närmast ritanropet händer
  lådan först. "Flytta ut den och vrid den sedan runt solen" är `rotate` *före* `translate` i koden.
:::
:::d3d12
- DirectXMath multiplicerar från vänster till höger: `XMMatrixScaling(…) * XMMatrixTranslation(…) * XMMatrixRotationY(…)`
  skalar först lådan, flyttar den sedan ut och vrider den sist runt solen. Glöm inte `XMMatrixTranspose` när du
  sparar matrisen.
:::
- Spara planetens matris *innan* du skalar den, i en egen variabel. Månen kan sedan utgå från den: dess bana är
  "planetens plats, sedan vriden igen och flyttad en bit ut".
- Tiden du behöver för snurrandet är samma tid som de gamla lådorna använde.
:::opengl
- En färg per himlakropp är en uniform i `shader.fs`, satt med `ourShader.setVec3` före varje ritanrop. `mix`
  blandar texturen med den – samma funktion som redan blandar lådan med ansiktet.
:::
:::vulkan
- En färg per himlakropp får plats i push constants, efter matrisen. Fragmentshadern måste också se dem: deklarera
  samma block där och lägg till `VK_SHADER_STAGE_FRAGMENT_BIT` i push constant-intervallet *och* i varje
  `vkCmdPushConstants`. `mix` blandar texturen med färgen.
:::
:::d3d12
- En färg per himlakropp får plats i root constants, efter matrisen: lägg till den i structen `ModelConstants` i
  båda filerna, och låt alla shadersteg se rotparametern (`D3D12_SHADER_VISIBILITY_ALL`). `lerp` blandar texturen med
  färgen.
:::

## Vill du göra mer?

När delmålen är klara är solsystemet ditt. Låt planeten snurra runt sin egen axel medan den färdas (var i kedjan av
matriser hamnar det, så att månen inte börjar snurra med?). Lägg till en andra planet med en annan hastighet, en ring
av pyttesmå lådor runt den, eller en komet på en lång, tillplattad bana. Låt solen pulsera i storlek med `sin` av
tiden. Eller luta månens bana lite, som den riktiga – barnen kommer att bli förtjusta.
