# Kollisionshantering

I slutet av förra kapitlet hade vi en fungerande kollisionsdetektering. Bollen reagerar dock inte alls på de upptäckta
kollisionerna; den flyger rakt igenom alla block. Vi vill att bollen ska *studsa* mot blocken den krockar med. Det här
kapitlet visar hur vi åstadkommer den så kallade *kollisionshanteringen* (collision resolution) inom logiken för
AABB – cirkel-detekteringen.

När en kollision sker vill vi att två saker händer: vi vill flytta bollen så att den inte längre är inuti det andra
objektet, och vi vill ändra riktningen på bollens hastighet så att det ser ut som om den studsar mot objektet.

Precis som förra kapitlet är det här vanlig C++ – likadant i spelets alla tre versioner.

## Flytta ut bollen

För att placera bollen utanför den AABB den krockade med måste vi ta reda på hur långt bollen trängde in i lådan. För
det återvänder vi till förra kapitlets närmaste punkt P. Bollen flyttas några pixlar per bildruta, så när en kollision
upptäcks når dess cirkel oftast en bit in i blocket: avståndet från dess mittpunkt C till P är mindre än radien.
Skillnaden, R minus längden av vektorn från C till P, är *inträngningen* (penetration) – hur långt bollen gick in i
blocket. Flyttar vi bollen tillbaka den sträckan, åt det håll den kom ifrån, är den utanför blocket igen och nuddar det
precis.

För att flytta tillbaka bollen behöver vi också veta *åt vilket håll* kollisionen skedde: om bollen träffade blocket på
en av dess sidor, eller på dess ovan- eller undersida. För learnopengls enkla spel räcker det att flytta bollen längs en
axel, och för att veta vilken axel behöver vi kollisionens riktning.

## Kollisionens riktning

Härnäst behöver vi uppdatera bollens hastighet. Vi vill bara vända bollens hastighet längs den axel den träffade på: en
boll som träffar ett block underifrån ska gå nedåt igen och behålla sin hastighet i sidled; en boll som träffar det från
sidan ska gå åt andra hållet och behålla sin lodräta hastighet. För att ta reda på vilket det är jämför learnopengl
vektorn från bollens mittpunkt till P med fyra *kompassriktningar*, upp, höger, ned och vänster – och tar den den pekar
mest åt:

:::opengl
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(glm::vec2 target)
{
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```
:::
:::vulkan
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(glm::vec2 target) {
    glm::vec2 compass[] = {
        glm::vec2(0.0f, 1.0f),  // up
        glm::vec2(1.0f, 0.0f),  // right
        glm::vec2(0.0f, -1.0f), // down
        glm::vec2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++) {
        float dot_product = glm::dot(glm::normalize(target), compass[i]);
        if (dot_product > max) {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```
:::
:::d3d12
```cpp
enum Direction {
    UP,
    RIGHT,
    DOWN,
    LEFT
};
```

```cpp
Direction VectorDirection(XMFLOAT2 target)
{
    XMFLOAT2 compass[] = {
        XMFLOAT2(0.0f, 1.0f),  // up
        XMFLOAT2(1.0f, 0.0f),  // right
        XMFLOAT2(0.0f, -1.0f), // down
        XMFLOAT2(-1.0f, 0.0f)  // left
    };
    float max = 0.0f;
    unsigned int best_match = -1;
    for (unsigned int i = 0; i < 4; i++)
    {
        float dot_product = XMVectorGetX(XMVector2Dot(XMVector2Normalize(XMLoadFloat2(&target)), XMLoadFloat2(&compass[i])));
        if (dot_product > max)
        {
            max = dot_product;
            best_match = i;
        }
    }
    return (Direction)best_match;
}
```

DirectXMaths skalärprodukt: `XMVector2Dot` returnerar skalärprodukten av x- och y-komponenterna – i varje komponent av
resultatet, så `XMVectorGetX` tar ut den; `XMVector2Normalize` är `glm::normalize`. Kompassen förblir en array av
`XMFLOAT2`, som läses in när de behövs.
:::

Funktionen jämför `target` med var och en av riktningsvektorerna i arrayen `compass`. Den kompassvektor som ligger
närmast `target` i vinkel är riktningen som returneras. Skalärprodukten av två enhetsvektorer är cosinus för vinkeln
mellan dem: ju större den är, desto mindre är vinkeln. (`best_match = -1` i en `unsigned int` är det största tal den kan
rymma – ett "ingen än" som loopen ersätter, eftersom varje nollskild vektor har en positiv skalärprodukt med minst en av
de fyra riktningarna.)

**Ett ord om namnen.** Kompassens "upp" är (0, 1) – men i spelets koordinater pekar y *nedåt*, så (0, 1) pekar nedåt på
skärmen. learnopengl behåller namnen ändå, och de beskriver *vektorn* från bollens mittpunkt till den närmaste punkten,
inte blockets sida. Ta fallet som kursens boll råkar ut för: den flyger uppåt in i ett block underifrån. Den närmaste
punkten ligger på blockets underkant, rakt ovanför bollens mittpunkt, så vektorn från mittpunkten till den är
(0, −något): kompassens "ned", `DOWN`. learnopengls hantering flyttar sedan bollen "back down" – nedåt på skärmen, ut ur
blocket. Namnen är förvirrande, men koden är konsekvent.

Gör nu den första uppgiften, **direction**: enumen efter `enum GameState` och `VectorDirection` mellan de två
`CheckCollision`-funktionerna (cirkelversionen kommer att anropa den). Ingenting använder den ännu.

```quiz
Bollen flyger uppåt och dess cirkel når in i ett block underifrån. Vektorn från dess mittpunkt till den närmaste punkten är (0, −8). Vad returnerar `VectorDirection`, och åt vilket håll flyttar hanteringen sedan bollen?
- [ ] `UP`, och den flyttar bollen uppåt på skärmen, djupare in i blocket
- [x] `DOWN` – kompassens (0, −1) har den största skalärprodukten – och hanteringen flyttar bollen nedåt på skärmen (`Position.y += penetration`), ut ur blocket
- [ ] `LEFT`, eftersom en negativ komponent pekar åt vänster
- [ ] Ingenting: vektorn har ingen x-komponent, så det finns ingen bästa matchning
---
I skärmkoordinater växer y nedåt, så (0, −8) pekar uppåt på skärmen – från bollen till blocket ovanför den. learnopengl kallar det DOWN efter kompassvektorn (0, −1); hanteringens "move ball back down" flyttar den sedan bort från blocket.
```

## AABB – cirkel-kollisionshantering

För att räkna ut värdena som kollisionshanteringen behöver måste kollisionsfunktionerna ge oss lite mer information än
bara sant eller falskt. Nu ska vi returnera en *tupel* med information som berättar om en kollision skedde, åt vilket håll
den skedde och skillnadsvektorn R. Tupelbehållaren finns i headern `<tuple>`:

:::opengl vulkan
```cpp
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, glm::vec2> Collision; // <collision?, what direction?, difference vector center - closest point>
```
:::
:::d3d12
```cpp
// Defines a Collision typedef that represents collision data
typedef std::tuple<bool, Direction, XMFLOAT2> Collision; // <collision?, what direction?, difference vector center - closest point>
```

Tupeln håller skillnaden som en `XMFLOAT2` – DirectXMaths lagringstyp, som i varje struct i spelet; uträkningen i
`CheckCollision` sker i `XMVECTOR` och lagras i slutet.
:::

En `std::tuple` håller ett fast antal värden av möjligen olika typer – här en bool, en Direction och en vektor – utan en
egen struct; `std::make_tuple` bygger en, `std::get<i>` läser element i (räknat från 0). Cirkelversionen av
`CheckCollision` returnerar nu en `Collision`:

:::opengl
```cpp
Collision CheckCollision(BallObject& one, GameObject& two)
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
    if (glm::length(difference) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
        return std::make_tuple(true, VectorDirection(difference), difference);
    else
        return std::make_tuple(false, UP, glm::vec2(0.0f, 0.0f));
}
```
:::
:::vulkan
```cpp
Collision CheckCollision(BallObject& one, GameObject& two) { // AABB - Circle collision
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

    if (glm::length(difference) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
        return std::make_tuple(true, VectorDirection(difference), difference);
    else
        return std::make_tuple(false, UP, glm::vec2(0.0f, 0.0f));
}
```
:::
:::d3d12
```cpp
Collision CheckCollision(BallObject& one, GameObject& two)
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

    if (XMVectorGetX(XMVector2Length(difference)) < one.Radius) // not <= since in that case a collision also occurs when object one exactly touches object two, which they are at the end of each collision resolution stage.
    {
        XMFLOAT2 diff;
        XMStoreFloat2(&diff, difference);
        return std::make_tuple(true, VectorDirection(diff), diff);
    }
    else
        return std::make_tuple(false, UP, XMFLOAT2(0.0f, 0.0f));
}
```
:::

och `DoCollisions` läser det första elementet där den förut testade boolen:

```cpp
            Collision collision = CheckCollision(Ball, box);
```

följt av `if (std::get<0>(collision))`. learnopengls kommentar om `<` förklarar varför: efter en hantering nuddar bollen
blocket *precis*, och det får inte räknas som en ny kollision i nästa bildruta.

Gör nu uppgiften **collision-tuple**. Detekteringen är densamma, så bilden också.

```quiz
`Collision` är `std::tuple<bool, Direction, vec2>`. Vad returnerar `std::get<2>(collision)`?
- [ ] Om det blev en kollision
- [ ] Kollisionens riktning
- [x] Skillnadsvektorn från bollens mittpunkt till den närmaste punkten – det tredje elementet, räknat från 0
- [ ] Blocket som träffades
---
`std::get<0>` är boolen, `std::get<1>` Direction, `std::get<2>` vektorn. Indexet är en del av typen: det måste vara en konstant som är känd när programmet kompileras.
```

Själva hanteringen, i `DoCollisions`, efter att blocket har förstörts (solida block förstörs inte, men bollen studsar mot
dem också):

:::opengl
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) // horizontal collision
                {
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                }
                else // vertical collision
                {
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::
:::vulkan
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                glm::vec2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) { // horizontal collision
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                } else { // vertical collision
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::
:::d3d12
```cpp
                // collision resolution
                Direction dir = std::get<1>(collision);
                XMFLOAT2 diff_vector = std::get<2>(collision);
                if (dir == LEFT || dir == RIGHT) // horizontal collision
                {
                    Ball.Velocity.x = -Ball.Velocity.x; // reverse horizontal velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.x);
                    if (dir == LEFT)
                        Ball.Position.x += penetration; // move ball to right
                    else
                        Ball.Position.x -= penetration; // move ball to left;
                }
                else // vertical collision
                {
                    Ball.Velocity.y = -Ball.Velocity.y; // reverse vertical velocity
                    // relocate
                    float penetration = Ball.Radius - std::abs(diff_vector.y);
                    if (dir == UP)
                        Ball.Position.y -= penetration; // move ball back up
                    else
                        Ball.Position.y += penetration; // move ball back down
                }
```
:::

Låt dig inte skrämmas av funktionens komplexitet, eftersom den i stort sett är en direkt översättning av begreppen vi
har gått igenom. Först kontrollerar vi om det blev en kollision, och i så fall förstör vi blocket om det inte är solitt.
Sedan hämtar vi kollisionens riktning `dir` och vektorn `diff_vector` ur tupeln för att till sist göra
kollisionshanteringen.

Först kontrollerar vi om kollisionens riktning är vågrät eller lodrät och vänder hastigheten därefter. Om den är vågrät
räknar vi ut inträngningen ur x-komponenten i `diff_vector` och lägger antingen till eller drar av den från bollens
position beroende på riktningen. Samma sak gäller de lodräta kollisionerna, men den här gången arbetar vi med
y-komponenten i alla vektorer.

Gör nu uppgiften **resolve**. Bygg och kör. Det förväntade resultatet visar nu **2.0 s** (bildruta 120), och den ser
helt annorlunda ut än i förra kapitlet: **alla block finns kvar**, och bollen är på väg *nedåt*, till höger om racketen.
Vad som hände: på väg upp är bollens första kontakt den solida stenen i rad 5, kolumn 9 – den som den flög igenom förut.
I bildruta 86 når dess cirkel stenen underifrån, riktning `DOWN`: dess lodräta hastighet vänds, från (100, −350) till
(100, 350), och den flyttas ut ur stenen. Stenen är solid, så ingenting förstörs, och bollen kommer ned åt höger.

```quiz
Hanteringen hittar en vågrät kollision med `diff_vector` = (−9, 2), och bollens radie är 12.5. Hur långt flyttas bollen, och åt vilket håll?
- [ ] 9 pixlar åt vänster
- [ ] 12.5 pixlar, hela radien
- [ ] 3.5 pixlar åt vänster: −9 är LEFT, så bollen flyttas åt vänster
- [x] 3.5 pixlar (12.5 − |−9|) åt höger: (−9, 2) pekar åt vänster, `VectorDirection` returnerar LEFT, och `Position.x += penetration`
---
Bollens mittpunkt ligger 9 pixlar från den närmaste punkten, men dess radie är 12.5, så den når 3.5 pixlar in i blocket. Vektorn pekar åt vänster – från bollen till blocket till vänster om den – så bollen flyttas åt höger, bort från det, och dess x-hastighet vänds.
```

## Kollisioner mellan spelare och boll

Kollisioner mellan bollen och spelaren hanteras lite annorlunda än det vi har gått igenom, eftersom bollens vågräta
hastighet den här gången ska uppdateras utifrån hur långt från mitten den träffade racketen. Ju längre från mitten
bollen träffar racketen, desto kraftigare ska den vågräta hastigheten ändras.

:::opengl
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        glm::vec2 oldVelocity = Ball.Velocity;
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity); // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```
:::
:::vulkan
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result)) {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        glm::vec2 oldVelocity = Ball.Velocity;
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        Ball.Velocity = glm::normalize(Ball.Velocity) * glm::length(oldVelocity); // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```
:::
:::d3d12
```cpp
    // check collisions for player pad (unless stuck)
    Collision result = CheckCollision(Ball, Player);
    if (!Ball.Stuck && std::get<0>(result))
    {
        // check where it hit the board, and change velocity based on where it hit the board
        float centerBoard = Player.Position.x + Player.Size.x / 2.0f;
        float distance = (Ball.Position.x + Ball.Radius) - centerBoard;
        float percentage = distance / (Player.Size.x / 2.0f);
        // then move accordingly
        float strength = 2.0f;
        XMVECTOR oldVelocity = XMLoadFloat2(&Ball.Velocity);
        Ball.Velocity.x = INITIAL_BALL_VELOCITY.x * percentage * strength;
        // keep speed consistent over both axes (multiply by length of old velocity, so total strength is not changed)
        XMStoreFloat2(&Ball.Velocity, XMVector2Normalize(XMLoadFloat2(&Ball.Velocity)) * XMVector2Length(oldVelocity));
        // fix sticky paddle: always bounce upwards
        Ball.Velocity.y = -1.0f * std::abs(Ball.Velocity.y);
    }
```

Farten behålls med DirectXMath: den gamla hastigheten sparas som en `XMVECTOR`, och `XMVector2Normalize(…) *
XMVector2Length(oldVelocity)` är learnopengls `glm::normalize(Ball->Velocity) * glm::length(oldVelocity)`.
:::

Efter att vi har letat efter kollisioner mellan bollen och varje block kontrollerar vi om bollen krockade med
spelarens racket (racketen är ett vanligt `GameObject`, så anropet använder cirkeltestet med racketens låda). Om den gjorde
det (och bollen inte sitter fast på racketen) räknar vi ut i procent hur långt bollens mittpunkt ligger från racketens
mitt jämfört med racketens halva bredd. Bollens vågräta hastighet uppdateras sedan utifrån hur långt från mitten den
träffade racketen. Förutom att uppdatera den vågräta hastigheten måste vi också vända y-hastigheten.

Observera att den gamla hastigheten sparas som `oldVelocity`. Skälet är att vi uppdaterar den vågräta komponenten i
bollens hastighetsvektor medan y-hastigheten förblir densamma. Det skulle betyda att vektorns längd hela tiden ändras,
med följden att bollens hastighetsvektor blir mycket längre (och alltså starkare) om bollen träffar racketens kant än om
den träffar mitten. Därför normeras den nya hastighetsvektorn och multipliceras med den gamla vektorns längd. På så sätt
är bollens fart alltid densamma, oavsett var den träffar racketen.

**Klistrig racket.** Du kanske har märkt det, kanske inte, när du körde koden, men det finns fortfarande ett stort
problem med kollisionshanteringen mellan spelaren och bollen. learnopengl kallar det problemet med den klistriga
racketen (sticky paddle). Det uppstår eftersom racketen rör sig snabbt mot bollen, så att bollens mittpunkt hamnar inuti
racketen. Eftersom vi inte tog hänsyn till fallet där bollens mittpunkt ligger inuti en AABB försöker spelet hela tiden
reagera på alla kollisionerna. När den till sist kommer loss har den vänt sin y-hastighet så många gånger att det är
oklart om den ska gå uppåt eller nedåt. Vi kan enkelt rätta till det med ett litet hack, som är möjligt eftersom vi alltid
kan anta att kollisionen sker på racketens ovansida: i stället för att vända y-hastigheten returnerar vi helt enkelt
alltid en positiv y-riktning, så att den kommer loss direkt när den fastnar. "Positiv" betyder med learnopengls ord uppåt
på skärmen – i spelets koordinater ett *negativt* y: därav `-1.0f * std::abs(Ball.Velocity.y)`.

En liten ändring mot learnopengl: där står `abs(…)`. På en `float` kan ett vanligt `abs` hamna på C-funktionen
`int abs(int)` – beroende på vilka headers som deklarerade vad – och i tysthet hugga av farten till hela pixlar per
sekund. `std::abs` (från `<cmath>`) har överlagringen för `float`; learnopengl använder den själv för inträngningen två
rader ovanför.

Gör nu uppgiften **paddle**. Bygg och kör: bilden ändras inte – och kan inte göra det. **Med kursens fasta indata möter
bollen aldrig racketen.** Ingen flyttar racketen, så den står kvar på x 350…450, och bollen kommer ned efter sin studs
mot stenen på x ≈ 576, en bra bit till höger om den. Bollen studsar en gång, mot stenen, och går sedan förlorad.
Racketstudsen finns i koden – uppgiften kontrolleras där –, men inte i bilden. I ditt eget program kan du styra racketen
under bollen med A och D och se att det fungerar.

```quiz
Bollen träffar racketen med sin mittpunkt 40 pixlar till höger om racketens mitt; racketen är 100 pixlar bred. Vad händer med dess hastighet, med learnopengls `strength` på 2?
- [ ] Dess x-hastighet blir 40 × 2 = 80, och farten ändras
- [ ] Bara dess y-hastighet vänds
- [ ] Den behåller sin hastighet: träffar utanför mitten ignoreras
- [x] `percentage` är 40 / 50 = 0.8, så `Velocity.x` = 100 × 0.8 × 2 = 160 innan vektorn normeras och skalas tillbaka till den gamla farten – och y görs negativt: uppåt
---
Ju längre från mitten, desto mer åt sidan lämnar bollen racketen; en träff på vänstra halvan ger ett negativt x. Normeringen och multiplikationen med den gamla längden behåller farten, så bara riktningen ändras. En träff längst ut, percentage 1, ger x = 200 före normeringen.
```

## Att tappa bollen

Nu studsar bollen, men vad händer när den kommer förbi racketen? Den lämnar fönstret genom nederkanten – kanten som
`Move` inte kontrollerar – och spelaren har förlorat det här försöket. learnopengl återställer då banan och spelaren:
varje block kommer tillbaka, racketen återvänder nere i mitten, och bollen sitter fast på den igen:

:::opengl
```cpp
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
}
```
:::
:::vulkan
```cpp
void ResetLevel(Game& game) {
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game) {
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, Player.Position + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -(BALL_RADIUS * 2.0f)), INITIAL_BALL_VELOCITY);
}
```

`ResetLevel` anropar `LoadLevel` igen, som skapar blocken på nytt med texturernas descriptor sets: inget Vulkan-objekt
skapas eller förstörs, så att ladda om en bana mitt i spelet är billigt och säkert medan en bildruta är i farten.
:::
:::d3d12
```cpp
void ResetLevel(Game& game)
{
    if (game.Level == 0)
        LoadLevel(game.Levels[0], "levels/one.lvl", game.Width, game.Height / 2);
    else if (game.Level == 1)
        LoadLevel(game.Levels[1], "levels/two.lvl", game.Width, game.Height / 2);
    else if (game.Level == 2)
        LoadLevel(game.Levels[2], "levels/three.lvl", game.Width, game.Height / 2);
    else if (game.Level == 3)
        LoadLevel(game.Levels[3], "levels/four.lvl", game.Width, game.Height / 2);
}

void ResetPlayer(Game& game)
{
    // reset player/ball stats
    Player.Size = PLAYER_SIZE;
    Player.Position = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Reset(Ball, XMFLOAT2(Player.Position.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, Player.Position.y - BALL_RADIUS * 2.0f), INITIAL_BALL_VELOCITY);
}
```
:::

och i `Update`, efter kollisionerna:

:::opengl
```cpp
void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::
:::vulkan
```cpp
void Update(Game& game, float dt) {
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) { // did ball reach bottom edge?
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::
:::d3d12
```cpp
void Update(Game& game, float dt)
{
    // update objects
    Move(Ball, dt, game.Width);
    // check for collisions
    DoCollisions(game);
    // check loss condition
    if (Ball.Position.y >= game.Height) // did ball reach bottom edge?
    {
        ResetLevel(game);
        ResetPlayer(game);
    }
}
```
:::

Bollens `Position` är dess övre vänstra hörn, så `Position.y >= game.Height` betyder att hela bollen ligger nedanför
fönstret. (Senare i delen får spelaren ett antal liv, och bara den sist tappade bollen avslutar spelet.)

Gör nu uppgiften **lose-ball**. Vid 2.0 s ändras ingenting: bollen är fortfarande på väg nedåt. Den lämnar fönstret i
bildruta 151, och återställningen sätter tillbaka den på racketen. För att det ska synas kontrolleras uppgiften också vid
**3.0 s**: där ligger bollen på racketen igen, fastsittande – mellanslag trycktes bara ned en gång – och varje block är på
plats.

```quiz
Kursens boll studsar mot en sten vid 1.4 s, missar racketen och återställs vid ungefär 2.5 s. Varför ligger den sedan kvar på racketen resten av körningen?
- [ ] Därför att `ResetPlayer` sätter dess hastighet till noll
- [ ] Därför att banan är klar
- [x] Därför att `Reset` gör den fastsittande igen, och kursens fasta indata trycker bara ned mellanslag en gång, vid 0.5 s – ingenting släpper den en andra gång
- [ ] Därför att `Move` slutar flytta bollar efter en återställning
---
`Stuck = true` betyder att `Move` låter bollen vara och att `ProcessInput` väntar på mellanslag. Med ett riktigt tangentbord skulle du skjuta iväg den igen.
```

## Några anmärkningar

Kollisionsdetektering är ett svårt område inom spelutveckling och möjligen dess mest krävande. De flesta system för
kollisionsdetektering och kollisionshantering kombineras med fysikmotorer, som i de flesta moderna spel. Det system vi
använde för det här spelet är dock mycket enkelt och särskilt anpassat till den här sortens spel.

Det bör betonas att den här sortens kollisionsdetektering och kollisionshantering inte är perfekt. Den räknar ut möjliga
kollisioner bara per bildruta och bara för positionerna precis som de är vid det tidssteget; det betyder att ett objekt
med så hög hastighet att det passerar ett annat objekt inom en enda bildruta ser ut att aldrig ha krockat med det. Om
bildrutor tappas, eller hastigheterna blir tillräckligt höga, håller alltså inte det här systemet. Det kallas
*tunnling* (tunnelling).

Några av de saker som fortfarande kan gå fel:

- Eftersom bollen kan träffa flera block i samma bildruta kan den vända sin hastighet två gånger och fortsätta i sin
  gamla riktning – den verkar flyga igenom blocken.
- När bollens mittpunkt hamnar inuti ett block får `VectorDirection` en vektor som kan peka åt fel håll, och
  hanteringen får bollen att hoppa.
- Racketens klisterfix är ett hack, som learnopengl säger: den bygger på att bollen alltid träffar racketen ovanifrån.

Vad kan vi göra åt problemen? De vanliga svaren är *kontinuerlig* kollisionsdetektering (att kontrollera vägen mellan två
bildrutor, inte bara positionerna), att dela upp en bildruta i flera mindre fysiksteg när objekt rör sig snabbt, eller en
fysikmotor som Box2D, som sköter allt detta åt dig – learnopengl nämner den också. För ett spel som det här fungerar det
enkla systemet tillräckligt bra.

## Mer att läsa

- [Collision resolution](https://learnopengl.com/In-Practice/2D-Game/Collisions/Collision-resolution): learnopengls
  kapitel som det här kapitlet följer, med bilderna av inträngningen och racketstudsen.
- [std::tuple](https://en.cppreference.com/w/cpp/utility/tuple): kollisionens tre värden i ett.

:::d3d12
- [XMVector2Dot](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmvector2dot):
  DirectXMaths skalärprodukt.
:::
