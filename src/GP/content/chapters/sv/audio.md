# Ljud

Spelet gör stora framsteg, men det känns fortfarande lite tomt eftersom det inte hörs något alls. I det här kapitlet
fixar learnopengl det – med musik i bakgrunden och en ljudeffekt varje gång något träffar något.

{{api}} har inget stöd för ljud (precis som för många andra delar av spelutveckling). Ett grafik-API pratar med GPU:n och
med inget annat.
:::opengl
Det gäller OpenGL, Vulkan och DirectX 12 lika.
:::
:::vulkan
Det gäller Vulkan liksom OpenGL och DirectX 12.
:::
:::d3d12
Det gäller Direct3D 12 liksom OpenGL och Vulkan (DirectX som helhet har haft ljuddelar, men Direct3D har aldrig varit
en av dem).
:::
Vi skulle behöva läsa in ljudfiler till en samling byte för hand, bearbeta och omvandla dem till en ljudström, och hantera
flera ljudströmmar på rätt sätt för spelet. Det kan bli komplicerat ganska snabbt och kräver en del lågnivåkunskap om
ljudteknik. Därför använder spel ett bibliotek för det, och det gör learnopengl också.

**Det här kapitlet har inga uppgifter.** Kursens simulator spelar inget ljud, och kursen har inga ljudfiler med.
Projektet är lösningen från kapitlet `powerups` som den är – de sex test-power-upsen inräknade –, så du kan bygga och köra
spelet; dess bilder är `powerups` bilder: vid 1,5 s de sex fallande pillren, vid 3,0 s den förvirrade bilden med den breda
racketen. Det som följer förklarar learnopengls ljudkod och var den skulle hamna i Hedgerow; på din egen dator kan du lägga
till den med något av biblioteken nedan.

## irrKlang

learnopengl använder ett bibliotek för ljudhantering som heter **irrKlang**. irrKlang är en plattformsoberoende
(Windows, macOS, Linux) ljudmotor och ljudbibliotek på hög nivå för 2D och 3D som spelar bland annat WAV-, MP3-, OGG- och
FLAC-filer. Det har också flera ljudeffekter som eko, fördröjning och distorsion, som kan justeras utförligt.

3D-ljud betyder att en ljudkälla kan ha en position i 3D som dämpar dess volym beroende på lyssnarens avstånd till
källan, så att det känns naturligt i en 3D-värld – tänk på skottlossning i en 3D-värld: oftast hör du var den kom ifrån
bara genom ljudets riktning och plats. Ett 2D-spel behöver bara 2D-ljud: spelade likadant i båda öronen, med sin egen
volym.

irrKlang är ett lättanvänt ljudbibliotek som kan spela de flesta ljudfiler med bara några rader kod, vilket gör det till
en bra kandidat för ett litet spel. Observera att irrKlang har en något begränsande licens: du får använda det som du vill
för icke-kommersiella syften, men du måste betala för dess pro-version så snart du vill använda det kommersiellt.
irrKlang har stängd källkod, så du kan inte kompilera biblioteket själv: du använder de förkompilerade biblioteksfiler det
levereras med – inkludera dess headers, länka `irrKlang.lib` (64 bitar) och kopiera dess DLL bredvid programmets
körbara fil; för att ladda MP3-filer behövs en DLL till, dess MP3-plugin.

## Lägga till musik

learnopengl gjorde ett litet musikspår så att spelet känns lite mer levande: det börjar spelas när spelet startar och
upprepas tills spelaren stänger spelet. I kursens struktur – learnopengls kod, skriven som en global och den fria
funktionen `Init` – blir det:

```cpp
#include <irrklang/irrKlang.h>
using namespace irrklang;

ISoundEngine* SoundEngine = createIrrKlangDevice();

void Init(Game& game)
{
    [...]
    SoundEngine->play2D("audio/music.mp3", true);
}
```

(Filnamnen i det här kapitlet är platshållare – dina egna filer.) Här skapar vi en `SoundEngine` som vi använder för all
ljudrelaterad kod. När ljudmotorn är initierad behöver vi bara anropa dess funktion `play2D` för att spela ljud. Dess
första parameter är filnamnet, den andra om vi vill att filen ska upprepas (spelas igen när den är slut). Det är allt som
behövs: när spelet körs spelas nu musiken. I slutet av programmet släpper `SoundEngine->drop();` motorn – irrKlang räknar
referenser, och `drop` lämnar tillbaka den som `createIrrKlangDevice` delade ut.

## Lägga till ljudeffekter

Vi kan ta ett steg till och lägga till ljudeffekter. learnopengl spelar ett kort ljud varje gång:

- bollen träffar ett block som inte är solitt – och förstör det,
- bollen träffar ett solitt block,
- racketen fångar en power-up,
- bollen studsar mot racketen.

Där en sådan kollision sker spelar vi motsvarande ljud, utan upprepning – alla fyra ställen finns i `DoCollisions`.
Blocken, till exempel:

```cpp
// destroy block if not solid
if (!box.IsSolid)
{
    box.Destroyed = true;
    SpawnPowerUps(game, box);
    SoundEngine->play2D("audio/block.wav", false);
}
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
    SoundEngine->play2D("audio/stone.wav", false);
}
```

Power-upens ljud hamnar bredvid `ActivatePowerUp(powerUp);` i power-up-loopen, racketens i studsen mot racketen.
`play2D` returnerar direkt; motorn mixar ljuden i en egen tråd, så ett nytt ljud kan börja medan det förra fortfarande
spelas. Sätter vi ihop allt får vi ett spel som känns mycket mer komplett. irrKlang ger mycket finare kontroll än så –
avancerad minneshantering, ljudeffekter eller callbacks för ljudhändelser; dess C++-handledningar visar dem.

## Andra bibliotek

irrKlang är learnopengls val, inte det enda. Spel som skrivs med vilket grafik-API som helst använder något av de här,
och anropen hamnar på exakt samma ställen – spelets `Init`, `DoCollisions` och dess städning –, aldrig i grafikkoden:

- **OpenAL** (och dess implementation med öppen källkod **OpenAL Soft**): ett plattformsoberoende 3D-ljud-API, utformat i
  OpenGL:s stil – källor, buffertar och en lyssnare.
- **miniaudio**: ett C-bibliotek i en enda fil (public domain eller MIT-0) som spelar och avkodar WAV, FLAC och MP3 på
  alla plattformar.
- **SDL_mixer**: SDL:s bibliotek för musik och ljudeffekter.
- **XAudio2**: Microsofts ljud-API på låg nivå, en del av Windows.

:::d3d12
På Windows är XAudio2 Direct3D 12:s naturliga partner. Ett program skapar motorn med `XAudio2Create`, en **mastering
voice** för ljudenheten (`CreateMasteringVoice`) och en **source voice** för varje ljud som spelas (`CreateSourceVoice`,
med ljudets format). Det skickar ljudets samples i en `XAUDIO2_BUFFER` med `SubmitSourceBuffer` och startar rösten med
`Start`. För musiken är buffertens `LoopCount` `XAUDIO2_LOOP_INFINITE`; en effekt är en buffert som spelas en gång. Två
saker som irrKlang gör åt dig lämnas åt programmet: XAudio2 spelar okomprimerade PCM-samples (och några
Microsoft-format som ADPCM), så en MP3-fil måste avkodas först – med Media Foundation eller ett bibliotek –, och en source
voice spelar ett ljud i taget, så effekter som överlappar behöver flera röster.
:::

```quiz
Varför kan spelet inte spela sin musik med {{api}}?
- [ ] Därför att {{api}} bara spelar ljud i 3D
- [x] Därför att ett grafik-API bara pratar med GPU:n: ljud kräver ett separat bibliotek, som pratar med ljudenheten
- [ ] Därför att musikfilen först måste laddas upp som en textur
- [ ] Därför att {{api}} bara spelar ljud i helskärmsläge
---
Det gäller OpenGL, Vulkan och Direct3D 12 lika. Ljudbibliotekets anrop hamnar i spelets logik – Init, DoCollisions – inte i renderingskoden.
```

```quiz
Vad gör det andra argumentet till `SoundEngine->play2D("audio/music.mp3", true)`?
- [ ] Det spelar filen i 2D i stället för 3D
- [ ] Det väntar tills filen har spelats klart
- [ ] Det läser in filen i minnet innan den spelas
- [x] Det får ljudet att upprepas: spelas igen från början när det är slut – musiken tills spelet stängs
---
Ljudeffekterna skickar `false`: var och en spelas en gång. `play2D` returnerar direkt i båda fallen; motorn spelar ljuden i bakgrunden.
```

```quiz
Var skulle du spela ljudet för när bollen träffar en solid sten?
- [ ] I `Render`, när stenen ritas
- [x] I `DoCollisions`, i `else`-grenen för ett solitt block – bredvid skakningen som samma träff startar
- [ ] I `Update`, där `ShakeTime` räknas ned
- [ ] I tangentcallbacken
---
Ett ljud hör till händelsen som orsakar det. Nedräkningen i Update körs i varje bildruta av skakningen; ett ljud där skulle starta tre gånger.
```

:::opengl
```quiz
Vad bör du veta om irrKlangs licens innan du använder det?
- [ ] Att det bara får användas med OpenGL
- [ ] Att det har öppen källkod under MIT-licensen
- [x] Att det bara är gratis för icke-kommersiellt bruk; ett kommersiellt spel behöver den betalda pro-versionen – och det har stängd källkod, så du använder dess förkompilerade bibliotek
- [ ] Att det bara får användas på Windows
---
För ett kommersiellt spel, eller ett som du vill bygga själv på vilken plattform som helst, undviker ett öppet bibliotek som OpenAL Soft eller miniaudio frågan.
```
:::
:::vulkan
```quiz
Ett Vulkan-spel vill ha learnopengls musik och ljudeffekter. Var hamnar ljudanropen?
- [ ] I `recordCommandBuffer`, så att ljudet synkroniseras med bildrutan
- [ ] I en ljudextension till Vulkan, som slås på med instansen
- [ ] I fragmentshadern i efterbehandlingspasset
- [x] På samma ställen som learnopengls: ljudbiblioteket sätts upp i `Init`, effekterna spelas i `DoCollisions`, motorn släpps i `cleanup()` – inget av det rör Vulkan
---
Vulkan har inget ljud, och ingen extension lägger till det. irrKlang, OpenAL Soft, miniaudio eller SDL_mixer fungerar med vilket grafik-API som helst.
```
:::
:::d3d12
```quiz
Hur får man musiken att upprepas med XAudio2?
- [x] Med den `XAUDIO2_BUFFER` som skickas till dess source voice: `LoopCount = XAUDIO2_LOOP_INFINITE`
- [ ] Med ett andra argument `true` till `Start`
- [ ] Genom att anropa `SubmitSourceBuffer` igen i varje bildruta
- [ ] Med en ljudkö i Direct3D 12
---
En effekt skickas en gång, utan upprepning. Observera att XAudio2 spelar PCM-samples: en MP3-fil måste avkodas först, med Media Foundation eller ett bibliotek.
```
:::

## Mer att läsa

- [Audio](https://learnopengl.com/In-Practice/2D-Game/Audio): learnopengls kapitel som det här kapitlet följer.

:::d3d12
- [How to: Initialize XAudio2](https://learn.microsoft.com/en-us/windows/win32/xaudio2/how-to--initialize-xaudio2) och
  [How to: Play a sound with XAudio2](https://learn.microsoft.com/en-us/windows/win32/xaudio2/how-to--play-a-sound-with-xaudio2):
  Microsofts ljud-API.
:::
