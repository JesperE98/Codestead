# Kollisionsdetektering

När vi försöker avgöra om två objekt krockar använder vi i regel inte objektens egna vertexdata, eftersom objekten
ofta har komplicerade former; det gör i sin tur kollisionsdetekteringen komplicerad. Därför är det vanligt att använda
enklare former (som oftast har en snygg matematisk definition) för kollisionsdetekteringen, och lägga dem över det
ursprungliga objektet. Sedan letar vi efter kollisioner mellan de enkla formerna; det gör koden enklare och sparar mycket
prestanda. Några exempel på sådana kollisionsformer är cirklar, sfärer, rektanglar och lådor; de är mycket enklare att
arbeta med än godtyckliga meshar med hundratals trianglar.

De enkla formerna ger oss visserligen enklare och effektivare algoritmer, men de har en gemensam nackdel: de omsluter
oftast inte objektet helt. Följden är att en kollision kan upptäckas fast det verkliga objektet inte krockade; man bör
alltid komma ihåg att formerna bara är approximationer av de verkliga formerna.

Kollisioner är två kapitel hos learnopengl, och i kursen också: det här *upptäcker* dem – överlappar bollen ett block? –
och förstör blocket; nästa *hanterar* dem – hur studsar bollen? Fram till dess förstör bollen det den rör vid och flyger
vidare. Inget av detta är bundet till ett API: det är vanlig C++ på CPU:n, som körs i varje bildruta innan något ritas,
likadant i spelets alla tre versioner.

## AABB – AABB-kollisioner

AABB står för *axis-aligned bounding box*, en rektangulär kollisionsform som är riktad längs scenens basaxlar, vilket i
2D betyder x- och y-axeln. Att den är axelriktad betyder att lådan inte är roterad och att dess kanter är parallella med
scenens basaxlar (till exempel är vänster- och högerkanten parallella med y-axeln). Att lådorna alltid är riktade längs
scenens axlar gör beräkningarna enklare. Tänk på bollen: dess AABB är kvadraten för dess sprite, 25 × 25 pixlar, som
också täcker de fyra genomskinliga hörnen utanför den runda bollen.

Nästan alla objekt i Hedgerow är rektangulära, så det är helt rimligt att använda axelriktade lådor för att upptäcka
kollisioner. Det är precis vad vi ska göra.

Axelriktade lådor kan definieras på flera sätt. Ett är att definiera en AABB med en övre vänster och en nedre höger
position. Klassen `GameObject` som vi definierade innehåller redan en övre vänster position (vektorn `Position`), och vi
kan enkelt räkna ut den nedre högra positionen genom att lägga till storleken (`Position + Size`). I praktiken innehåller
varje `GameObject` en AABB som vi kan använda för kollisioner.

Hur letar vi då efter kollisioner? En kollision sker när två kollisionsformer går in i varandras områden, det vill säga
när formen för det första objektet på något sätt ligger inuti formen för det andra. För AABB:er är det ganska lätt att
avgöra eftersom de är riktade längs scenens axlar: vi kontrollerar för varje axel om de två objektens kanter på den axeln
överlappar. Alltså kontrollerar vi om båda objektens vågräta kanter överlappar och om de lodräta överlappar. Om både de
vågräta **och** de lodräta kanterna överlappar har vi en kollision.

Föreställ dig två lådor bredvid varandra: deras x-intervall överlappar om den förstas högra kant ligger till höger om
den andras vänstra kant, *och* den andras högra kant ligger till höger om den förstas vänstra. Om bara den ena av de två
axlarna överlappar – två block i samma rad långt isär har samma y-intervall – rör lådorna inte vid varandra. Att
översätta det till kod är ganska rättframt. Vi kontrollerar överlapp på båda axlarna och rapporterar i så fall en
kollision:

:::opengl
```cpp
bool CheckCollision(GameObject& one, GameObject& two)
{
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::
:::vulkan
```cpp
bool CheckCollision(GameObject& one, GameObject& two) { // AABB - AABB collision
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::
:::d3d12
```cpp
bool CheckCollision(GameObject& one, GameObject& two)
{
    // collision x-axis?
    bool collisionX = one.Position.x + one.Size.x >= two.Position.x &&
        two.Position.x + two.Size.x >= one.Position.x;
    // collision y-axis?
    bool collisionY = one.Position.y + one.Size.y >= two.Position.y &&
        two.Position.y + two.Size.y >= one.Position.y;
    // collision only if on both axes
    return collisionX && collisionY;
}
```
:::

Vi kontrollerar om det första objektets högra sida är större än det andra objektets vänstra sida och om det andra
objektets högra sida är större än det första objektets vänstra sida; på samma sätt för den lodräta axeln.

Kursen lägger kollisionskoden i ett nytt avsnitt efter spelets globala variabler (`Hedgerow`, `Renderer`, `Player`,
`Ball`) – den behöver bollen – och före `Init` (learnopengl har den i `game.cpp`). Kommentarerna `// TODO:` i projektet
visar var varje del ska in. Gör nu den första uppgiften, **aabb**. Ingenting anropar den ännu.

```quiz
Block A täcker x 0…53, y 0…37; block B täcker x 60…113, y 0…37. Rapporterar `CheckCollision(A, B)` en kollision?
- [x] Nej: deras y-intervall överlappar, men på x ligger A:s högra kant (53) till vänster om B:s vänstra kant (60)
- [ ] Ja: deras y-intervall är desamma
- [ ] Ja: två block i samma rad krockar alltid
- [ ] Nej, eftersom block aldrig testas mot varandra
---
Båda axlarna måste överlappa. Block testas i själva verket aldrig mot varandra i spelet – bara bollen mot varje block och mot racketen.
```

### Leta efter kollisioner

Nu vill vi leta efter kollisioner mellan bollen och varje block i banan. Om bollen krockar med ett block förstör vi
blocket – om det inte är solitt. learnopengls `Game::DoCollisions` blir en fri funktion som tar spelet:

:::opengl
```cpp
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            if (CheckCollision(Ball, box))
            {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::
:::vulkan
```cpp
void DoCollisions(Game& game) {
    for (GameObject& box : game.Levels[game.Level].Bricks) {
        if (!box.Destroyed) {
            if (CheckCollision(Ball, box)) {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::
:::d3d12
```cpp
void DoCollisions(Game& game)
{
    for (GameObject& box : game.Levels[game.Level].Bricks)
    {
        if (!box.Destroyed)
        {
            if (CheckCollision(Ball, box))
            {
                if (!box.IsSolid)
                    box.Destroyed = true;
            }
        }
    }
}
```
:::

Loopen tar varje block som referens, `GameObject& box`: `box.Destroyed = true` måste ändra blocket i banan, inte en kopia
av det. Ett förstört block hoppas över – det ritas inte längre (`DrawLevel` kontrollerar samma flagga) och krockar inte
längre. Sedan behöver spelets funktion `Update` uppdateras: efter att bollen har flyttats letar vi efter kollisioner,
som learnopengl gör:

```cpp
    // check for collisions
    DoCollisions(game);
```

`CheckCollision(Ball, box)` skickar bollen där en `GameObject&` förväntas – dess `GameObject`-del, med dess låda på
25 × 25. Gör nu uppgiften **do-collisions**. Tryck på **Build & run**: bilden visar nu **3.0 s** (bildruta 180), och
**bollen har huggit en kanal genom muren**: tio block är borta – de blå, gröna och gula i kolumnerna 9, 10 och 11 och
ett orange block högst upp –, och månen syns genom luckan. Bollen själv är tillbaka på den öppna himlen, på väg nedåt
åt höger. Dess bana är fortfarande den från kapitlet Bollen: ingenting studsar ännu, så bollen flyger igenom blocken den
förstör, mot överkanten och ned igen genom nästa kolumn.

Titta på raden med stenar under de färgade blocken: bollen flög igenom stenen i kolumn 9 på väg upp, och stenen finns
kvar. Solida block förstörs aldrig – och eftersom ingenting studsar ännu stoppar de inte bollen heller.

```quiz
Varför tar loopen i `DoCollisions` varje block som referens (`for (GameObject& box : …)`)?
- [ ] Därför att en range-for-loop inte kan kopiera structs
- [ ] Därför att det går snabbare, och resultatet skulle bli detsamma med en kopia
- [x] Därför att `box.Destroyed = true` måste ändra blocket i banan: med en kopia skulle bara kopian förstöras, och blocket skulle ritas och träffas igen
- [ ] Därför att `CheckCollision` bara tar referenser
---
`DrawLevel` och nästa bildrutas `DoCollisions` tittar båda på blocken i `game.Levels[game.Level].Bricks`. Bara en referens når dem.
```

## AABB – cirkel-kollisionsdetektering

Eftersom bollen är ett cirkelliknande objekt är en AABB förmodligen inte det bästa valet av kollisionsform för den.
Kollisionskoden tror att bollen är en rektangulär låda, så bollen krockar ofta med ett block fast själva bollens sprite
ännu inte rör vid blocket: lådans hörn når ett block innan den runda bollen gör det.

Det är mycket rimligare att representera bollen med en cirkel som kollisionsform i stället för en AABB. Därför lade vi
till variabeln `Radius` i bollobjektet. För att definiera en cirkel behöver vi bara en positionsvektor och en radie. Det
betyder att vi måste uppdatera detekteringsalgoritmen, eftersom den nu bara fungerar mellan två AABB:er. Att upptäcka
kollisioner mellan en cirkel och en rektangel är lite mer komplicerat, men knepet är följande: vi letar upp den punkt på
AABB:n som ligger närmast cirkeln, och om avståndet från cirkeln till den punkten är mindre än radien har vi en
kollision.

Det svåra är att hitta den närmaste punkten P på AABB:n. Föreställ dig bollens mittpunkt C någonstans utanför ett block,
till exempel nedanför och till höger om det, och blockets mittpunkt B. Vektorn från B till C, *skillnaden* D = C − B,
pekar från blockets mitt till bollen. *Kläm* nu D till blockets halva utsträckning (half extents): begränsa dess x till
−w/2 … +w/2 och dess y till −h/2 … +h/2, där w och h är blockets bredd och höjd. Den klämda vektorn R kan inte längre nå
utanför blocket: B + R är en punkt på blockets kant (eller inuti det, om C ligger inuti), och det är den punkt i blocket
som ligger närmast C. Ligger C under blocket kläms bara y, och P ligger på underkanten rakt ovanför C; ligger C nedanför
och till höger kläms båda, och P är blockets nedre högra hörn.

En clamp-operation klämmer ett värde till ett värde inom ett givet intervall. Det skrivs ofta så här:

```cpp
float clamp(float value, float min, float max) {
    return std::max(min, std::min(max, value));
}
```

Ett värde på 42.0f kläms till exempel till 6.0f med intervallet 3.0f till 6.0f, och ett värde på 4.20f kläms till
4.20f. Att klämma en 2D-vektor betyder att vi klämmer både dess x- och dess y-komponent inom det givna intervallet.

Den klämda vektorn R är nu vektorn från AABB:ns mitt till den punkt på AABB:n som ligger närmast cirkeln. Med den
vektorn kan vi räkna ut avståndet till cirkeln, P − C, och jämföra dess längd med bollens radie. I kod ser det ut så här:

:::opengl
```cpp
bool CheckCollision(BallObject& one, GameObject& two)
{
    // get center point circle first
    glm::vec2 center(one.Position + one.Radius);
    // calculate AABB info (center, half-extents)
    glm::vec2 aabb_half_extents(two.Size.x / 2.0f, two.Size.y / 2.0f);
    glm::vec2 aabb_center(two.Position.x + aabb_half_extents.x, two.Position.y + aabb_half_extents.y);
    // get difference vector between both centers
    glm::vec2 difference = center - aabb_center;
    glm::vec2 clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    glm::vec2 closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;
    return glm::length(difference) < one.Radius;
}
```
:::
:::vulkan
```cpp
bool CheckCollision(BallObject& one, GameObject& two) { // AABB - Circle collision
    // get center point circle first
    glm::vec2 center(one.Position + one.Radius);
    // calculate AABB info (center, half-extents)
    glm::vec2 aabb_half_extents(two.Size.x / 2.0f, two.Size.y / 2.0f);
    glm::vec2 aabb_center(two.Position.x + aabb_half_extents.x, two.Position.y + aabb_half_extents.y);
    // get difference vector between both centers
    glm::vec2 difference = center - aabb_center;
    glm::vec2 clamped = glm::clamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    glm::vec2 closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length <= radius
    difference = closest - center;
    return glm::length(difference) < one.Radius;
}
```
:::
:::d3d12
```cpp
bool CheckCollision(BallObject& one, GameObject& two)
{
    // get center point circle first (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s)
    XMVECTOR center = XMLoadFloat2(&one.Position) + XMVectorReplicate(one.Radius);
    // calculate AABB info (center, half-extents)
    XMVECTOR aabb_half_extents = XMVectorSet(two.Size.x / 2.0f, two.Size.y / 2.0f, 0.0f, 0.0f);
    XMVECTOR aabb_center = XMVectorSet(two.Position.x + two.Size.x / 2.0f, two.Position.y + two.Size.y / 2.0f, 0.0f, 0.0f);
    // get difference vector between both centers
    XMVECTOR difference = center - aabb_center;
    XMVECTOR clamped = XMVectorClamp(difference, -aabb_half_extents, aabb_half_extents);
    // add clamped value to AABB_center and we get the value of box closest to circle
    XMVECTOR closest = aabb_center + clamped;
    // retrieve vector between center circle and closest point AABB and check if length < radius
    difference = closest - center;
    return XMVectorGetX(XMVector2Length(difference)) < one.Radius;
}
```

learnopengls glm-rader, en för en, i DirectXMath: de lagrade `XMFLOAT2` läses in i `XMVECTOR` för att räkna.
`XMVectorReplicate(one.Radius)` lägger radien i alla fyra komponenter (glm:s `one.Position + one.Radius` lägger till
talet till båda), `XMVectorSet` bygger en vektor av komponenter, `XMVectorClamp` är `glm::clamp` per komponent, och
`XMVector2Length` returnerar längden av x- och y-komponenterna – i varje komponent av resultatet, så `XMVectorGetX` tar
ut den som en float. Komponenterna z och w (noll eller radien här) spelar ingen roll: `2`-funktionerna läser bara x och
y.
:::

Bollens `Position` är dess övre vänstra hörn, så dess mittpunkt är `Position + Radius` åt båda hållen. Observera `<`:
en boll som precis nuddar ett block krockar inte – det spelar roll i nästa kapitel, där en kollision flyttar ut bollen
tills den precis nuddar.

**Ett namn, två funktioner.** Den här `CheckCollision` har samma namn som AABB-versionen, med andra parametertyper – en
*överlagring* (overload). C++ väljer mellan överlagringar utifrån argumenten i varje anrop: för `CheckCollision(Ball,
box)` är versionen som tar en `BallObject&` en exakt matchning för bollen, medan versionen med `GameObject&` skulle
behöva omvandlingen till basklassen – så cirkelversionen vinner. Innan den fanns valde samma anrop AABB-versionen. En
sak att tänka på: ett anrop ser bara de överlagringar som deklarerats *före* det, och därför ligger cirkelversionen
mellan AABB-versionen och `DoCollisions`. (learnopengl har båda som överlagringar också.)

Gör nu uppgiften **circle**. Tryck på **Build & run**: bilden vid 3.0 s är densamma, pixel för pixel. Den runda bollen
möter samma tio block på sin väg – bara några av dem en bildruta senare, eftersom lådans hörn nådde dem innan cirkeln
gjorde det. Vid 1.75 s hade till exempel lådversionen redan förstört fyra block, cirkelversionen tre; det fjärde följer
en bildruta senare. Skillnaden är liten i den här hastigheten, men det är skillnaden mellan en boll som träffar ett block
och en som missar det med ett hörn – den syns när bollen snuddar vid ett block.

```quiz
Bollens mittpunkt C ligger rakt under ett block vars mittpunkt är B, lite till höger om B men inom blockets bredd. Var ligger den närmaste punkt P som cirkeltestet mäter avståndet till?
- [ ] I blockets nedre högra hörn
- [ ] I blockets mittpunkt B
- [x] På blockets underkant, rakt ovanför C: bara y-komponenten i C − B kläms (till h/2), x-komponenten ligger redan inom halva bredden
- [ ] I bollens mittpunkt C, eftersom den ligger utanför blocket
---
Klämningen behåller komponenterna som redan ligger inom lådans halva utsträckning och skär av de andra. Nedanför och till höger om blocket skulle båda skäras av, och P skulle vara hörnet.
```

```quiz
Varför använder `CheckCollision(Ball, box)` i `DoCollisions` cirkeltestet efter uppgiften circle, fast anropet inte ändrades?
- [ ] Därför att AABB-versionen togs bort
- [x] Därför att den nya överlagringen som tar en `BallObject&` matchar bollen exakt, medan den med `GameObject&` behöver en omvandling till basklassen – C++ väljer den bättre matchningen
- [ ] Därför att C++ alltid anropar den funktion som definierades sist
- [ ] Därför att `Radius` inte är noll
---
Överlagringsupplösningen jämför de omvandlingar varje kandidat behöver. En referens till den exakta typen slår en referens till en basklass. Racketen är ett vanligt `GameObject`, så ett anrop med den skulle fortfarande välja AABB-versionen.
```

## Mer att läsa

- [Collision detection](https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-detection): learnopengls
  kapitel som det här kapitlet följer, med bilderna av AABB:erna och den närmaste punkten.
- [Overload resolution](https://en.cppreference.com/w/cpp/language/overload_resolution): hur C++ väljer en
  `CheckCollision`.

:::d3d12
- [XMVectorClamp](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmvectorclamp):
  DirectXMaths clamp.
:::
