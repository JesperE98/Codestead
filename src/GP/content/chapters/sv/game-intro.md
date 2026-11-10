# 2D-spelet: Hedgerow

I kapitlen hittills har vi mest fokuserat på detaljerna i {{api}}: hur det fungerar och hur man använder det för att
skapa alla möjliga snygga renderingseffekter. Bortsett från några tekniska demos har vi inte riktigt använt {{api}} i ett
verkligt program. Det är syftet med de kommande kapitlen: att bygga ett litet men komplett 2D-spel från grunden.

learnopengl gör det med en klon av ett berömt arkadspel från 1970-talet. Kursen bygger inte om det spelet: den bygger
**ett eget spel av samma slag**, som heter **Hedgerow**, med kursens egna bilder och banor. Genren är gammal – en boll, ett
racket och en mur av block – och varje teknik och varje steg i learnopengls kapitel finns kvar; bara namnet, grafiken
och banorna är kursens egna. När texten säger "learnopengls spel" menas learnopengls version.

Det här kapitlet har inga uppgifter. Det beskriver spelet och vägen dit; projektet är det du ska arbeta i härnäst, och
du kan bygga och köra det i slutet.

## Hedgerow

Hedgerow utspelar sig i en trädgård i skymningen. Bakgrunden är en natthimmel som ljusnar mot horisonten, med en
fullmåne uppe till höger, en rad kullar och en rad runda häckar längst ned. I fönstrets övre halva hänger häcken du ska
röja: en mur av block, vart och ett en ljus platta färgad i sin färg – orange, gul, grön, blå – och här och där ett block
av grå sten. Längst ned står spelarens racket, en träbit med mässingsändar.

- Racketen flyttas åt vänster och höger med **A** och **D**, ända ut till fönstrets kanter.
- En ljusgrön **boll** ligger på racketen i början av varje försök; **mellanslag** skjuter iväg den uppåt.
- Bollen studsar mot fönstrets vänster-, höger- och överkant, mot racketen och mot blocken. Var den träffar racketen
  avgör vinkeln den lämnar den med, så spelaren kan sikta.
- Ett färgat block som träffas **förstörs**. Stenblocken är **solida**: bollen studsar mot dem, men de går aldrig
  sönder.
- När alla block som kan förstöras är borta är banan klar. Det finns **fyra banor**, var och en en liten textfil med tal
  som säger vilket block som ska ligga var.
- När bollen faller förbi racketen, ut genom fönstrets nederkant, är försöket förlorat: bollen återvänder till racketen
  (senare i delen med ett begränsat antal liv).
- Förstörda block släpper ibland en **power-up**, som faller nedåt och måste fångas med racketen: en snabbare boll, en
  klistrig racket som håller fast bollen, en boll som går igenom blocken, en bredare racket – och två som gör spelet
  svårare genom att förvränga hela bilden.

Till slut får spelet en meny där man väljer bana, ett meddelande när man vinner, ett spår av partiklar efter bollen,
några efterbehandlingseffekter (skärmen skakar när bollen träffar en sten), text för liven och menyn, och – i
learnopengls version – ljud.

## Vad spelet använder, och vad det tillför

Det mesta som spelet behöver har du redan lärt dig. Spelet är ett bra sätt att se allt komma samman:

- **Texturer** (Kom igång): varje föremål på skärmen är en texturerad rektangel – en *sprite*.
- **Transformationer och en ortografisk projektion** (Kom igång): sprites flyttas, skalas och roteras med en
  modellmatris, och en ortografisk projektion avbildar spelets koordinater – pixlar – på fönstret.
- **Blending** (Avancerad OpenGL): bollen, racketen och power-upsen har genomskinliga delar.
- **Framebuffrar** (Avancerad OpenGL): efterbehandlingseffekterna renderar först spelet till en textur och ritar sedan
  texturen till skärmen med en shader som skakar, speglar eller gör den suddig.
- **Textrendering** (förra kapitlet): livräknaren och menyn.

Det spelet tillför är det som gör det till ett spel och inte bara en bild:

- en **spelloop** som uppdaterar spelets tillstånd i varje bildruta med den tid som har gått (*delta time*), så att
  spelet går lika fort på alla datorer;
- **indata**, lästa från tangentbordet till spelets tillstånd;
- **kollisionsdetektering och kollisionshantering**: att ta reda på om bollen överlappar ett block eller racketen, och
  hur den studsar;
- **partiklar**: många små, kortlivade sprites (här ritade en i taget, utan instancing);
- **spellägen** – spelar, menyn, vinstskärmen – och **banor** som laddas från filer.

Inget av detta är bundet till ett API. En spelloop, indata och kollisionsdetektering är vanlig C++; att rita en sprite är
samma rektangel i alla API:er. Kapitlen visar hur {{api}} ritar dem.

## Kapitlen framöver

Spelet byggs upp under de här kapitlen, och vart och ett lägger till en del; de tre första kommer direkt efter det här:

1. **Förberedelser** (Setting up) – programmets struktur: spelets tillstånd, spelloopen med delta time, indata från
   tangentbordet och funktionerna som laddar och håller shaders och texturer.
2. **Rendera sprites** – den ortografiska projektionen och sprite-renderaren: en texturerad rektangel, ritad var som
   helst, i valfri storlek och vinkel.
3. **Banor** – spelobjekten, banfilerna, bakgrunden, den första banan och racketen.
4. **Bollen**, **Kollisionsdetektering** och **Kollisionshantering** – bollen, och hur den träffar och studsar mot saker.
5. **Partiklar**, **Efterbehandling** och **Power-ups** – spåret efter bollen, effekterna, power-upsen.
6. **Ljud**, **Rendera text** och **Slutord** – ljud, menyn och liven, och en återblick.

## Hur kursen skriver spelet

learnopengl delar upp sitt spel i klasser, var och en i sin egen header- och källfil: `Game`, `ResourceManager`,
`Shader`, `Texture2D`, `SpriteRenderer`, `GameObject`, `GameLevel` och senare fler. Så bör ett riktigt projekt vara
organiserat. Kursen behåller namnen på klasserna och deras funktioner, men skriver dem som **vanliga structs och fria
funktioner, alla i en `main.cpp`**, i ordningen för learnopengls filer – den inbyggda simulatorn följer vanliga structs
och fria funktioner. En medlemsfunktion som learnopengls `Renderer->DrawSprite(…)` blir en fri funktion som tar structen
som sin första parameter, `DrawSprite(Renderer, …)`. Nästa kapitel visar detaljerna.

Spelet måste också vara **deterministiskt** i kursen, så att alla API:er, alla drivrutiner och simulatorn visar samma
bild för samma ögonblick: spelets tid går fram exakt 1/60 sekund per bildruta, och den enda tangent som någonsin
"trycks ned" av sig själv är mellanslag, en halv sekund efter starten. Nästa kapitel förklarar hur.

:::opengl
## Projektet

Projektet är början på nästa kapitel: en `main.cpp` som öppnar ett fönster på 800 × 600 med titeln "Hedgerow" (som inte
går att ändra storlek på) med en OpenGL 3.3 core-kontext, slår på blending och rensar fönstret till svart i sin
renderloop. Resten är `// TODO:`-avsnitt för spelet, i ordningen för learnopengls filer: Shader, Texture2D,
ResourceManager, Game och programmet.
:::
:::vulkan
## Projektet

Projektet är början på nästa kapitel: en `main.cpp` med vulkan-tutorials `HelloTriangleApplication` och allt som de
tidigare kapitlen byggt – instansen med valideringslagret, swap chainen, ett render pass med ett färg-attachment (ett
2D-spel behöver ingen djupbuffer), descriptor set-layouten (en uniform buffer på binding 0, en textur på binding 1),
pipelinelayouten med push constants för sprites, hjälpfunktionen `createPipeline`, texturfunktionerna, uniform buffern
och en descriptor pool med plats för 16 texturer. Den öppnar ett fönster på 800 × 600 med titeln "Hedgerow" och rensar
det till svart. Spelets delar är `// TODO:`-avsnitt bredvid klassen, i ordningen för learnopengls filer: Texture2D,
ResourceManager, Game och key-callbacken.
:::
:::d3d12
## Projektet

Projektet är början på nästa kapitel: en `main.cpp` med Direct3D 12-applikationsklassen från de tidigare kapitlen
(`D3D12App` med `LoadPipeline`, `LoadAssets`, `OnUpdate`, `OnRender`, `PopulateCommandList`, `WaitForPreviousFrame`).
Den öppnar ett fönster på 800 × 600 med titeln "Hedgerow" som inte går att ändra storlek på, och rensar det till svart.
Den har redan `GraphicsContext Graphics`, en struct med de Direct3D 12-objekt som spelets funktioner ska skapa resurser
och rita med (nästa kapitel förklarar den). Spelets delar är `// TODO:`-avsnitt, i ordningen för learnopengls filer:
Shader, Texture2D, ResourceManager, Game och programmet.
:::

Tryck på **Build & run** (Ctrl+Enter): projektet kompileras och körs i den inbyggda simulatorn, och du ser ett tomt,
svart fönster. Det är allt som learnopengls "Setting up" ritar också – nästa kapitel bygger skelettet som varje senare
kapitel hänger sina delar på.

```quiz
När är en bana i Hedgerow klar?
- [ ] När bollen har träffat varje block en gång
- [x] När alla block som kan förstöras är borta – de solida stenblocken blir kvar och räknas inte
- [ ] När spelaren har fångat en power-up
- [ ] När bollen har studsat mot fönstrets överkant
---
De solida blocken är hinder: bollen studsar mot dem men förstör dem aldrig. En bana är klar när bara de är kvar.
```

```quiz
Varför flyttar spelet fram sitt tillstånd med den tid som varje bildruta tog (delta time) i stället för med ett fast steg per bildruta?
- [ ] Därför att GPU:n bara kan rita en bildruta när tiden har ändrats
- [ ] Därför att kollisionsdetekteringen behöver tiden i sekunder
- [x] För att bollen och racketen ska röra sig lika fort i pixlar per sekund oavsett om datorn renderar 30 eller 300 bildrutor per sekund
- [ ] Därför att ett fast steg per bildruta skulle göra spelet deterministiskt
---
En hastighet på 500 pixlar per sekund gånger en bildrutetid på 1/60 s flyttar racketen 8.3 pixlar i den bildrutan; med 1/120 s hälften så långt, dubbelt så ofta. Kursen gör sedan själva bildrutetiden fast (1/60) så att bilderna kan jämföras.
```

```quiz
Vilket av följande behöver spelet som kursens tidigare delar inte lärde ut?
- [ ] Texturerade rektanglar
- [ ] En ortografisk projektion
- [ ] Blending av genomskinliga delar
- [x] Kollisionsdetektering: om bollen överlappar ett block eller racketen, och hur den studsar
---
Texturer, transformationer, blending, framebuffrar och text kan du. Spelloopen, indata, kollisionsdetektering och kollisionshantering, partiklar och spelets lägen är det som de här kapitlen tillför.
```

```quiz
Hur skriver kursen learnopengls spelklasser, som `SpriteRenderer` med medlemsfunktionen `DrawSprite`?
- [ ] Som C++-klasser i egna filer, precis som learnopengl
- [x] Som vanliga structs med fria funktioner i en `main.cpp`, med learnopengls namn: `DrawSprite(Renderer, …)` tar structen som sin första parameter
- [ ] Som en enda stor `Game`-klass som innehåller alla funktioner
- [ ] Som shaderkod: sprite-renderaren körs på GPU:n
---
Namnen och stegen är kvar från learnopengl, så du kan jämföra koden med learnopengls i varje steg. Ett riktigt projekt skulle dela upp koden i klasser och filer som learnopengl gör.
```

## Mer att läsa

- [Setting up](https://learnopengl.com/In-Practice/2D-Game/Setting-up): learnopengls första kapitel med kod för sitt
  2D-spel, kursens nästa kapitel; learnopengls kapitel före det presenterar spelet.
- [LearnOpenGL-källkod: 2D-spelet](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengls kompletta spel, med kodens tillstånd efter varje kapitel i `0.full_source/progress`.

:::vulkan
- [Vulkan Tutorial](https://vulkan-tutorial.com/): applikationsklassen som Vulkan-versionen behåller.
:::
:::d3d12
- [D3D12HelloWorld-exemplen](https://github.com/microsoft/DirectX-Graphics-Samples/tree/master/Samples/Desktop/D3D12HelloWorld):
  applikationsklassen som Direct3D 12-versionen behåller.
:::
