# Bollen

Nu har vi en bana full av block och en racket som går att flytta. Det enda som saknas är bollen. Målet är att låta
bollen krocka med alla block tills varje block som kan förstöras är förstört, men allt under villkoret att bollen inte
får nå skärmens nederkant.

Utöver de vanliga komponenterna i ett spelobjekt har en boll en radie och ett extra booleskt värde som anger om bollen
*sitter fast* (stuck) på spelarens racket eller får röra sig fritt. När spelet startar sitter bollen fast på racketen
tills spelaren startar spelet genom att trycka på en viss tangent – i Hedgerow, som i learnopengls spel, mellanslag.

## Bollobjektet

Eftersom bollen i praktiken är ett `GameObject` med några extra egenskaper är det rimligt att göra bollobjektet till
en underklass till `GameObject`. learnopengl skriver en klass `BallObject` som härleds från `GameObject`; kursen
behåller härledningen – en struct kan härledas från en struct lika bra – och skriver dess medlemsfunktioner som fria
funktioner, som överallt i spelet:

:::opengl
```cpp
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, unsigned int sprite)
{
    BallObject ball;
    ball.Position = pos;
    ball.Size = glm::vec2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```
:::
:::vulkan
```cpp
struct BallObject : GameObject {
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(glm::vec2 pos, float radius, glm::vec2 velocity, VkDescriptorSet sprite) {
    BallObject ball;
    ball.Position = pos;
    ball.Size = glm::vec2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```

Spriten är `ball`-texturens descriptor set, som för varje spelobjekt sedan kapitlet Banor.
:::
:::d3d12
```cpp
struct BallObject : GameObject
{
    // ball state
    float Radius = 12.5f;
    bool  Stuck = true;
};

BallObject MakeBallObject(XMFLOAT2 pos, float radius, XMFLOAT2 velocity, unsigned int sprite)
{
    BallObject ball;
    ball.Position = pos;
    ball.Size = XMFLOAT2(radius * 2.0f, radius * 2.0f);
    ball.Velocity = velocity;
    ball.Sprite = sprite;
    ball.Radius = radius;
    ball.Stuck = true;
    return ball;
}
```

Spriten är `ball`-texturens ID – platsen för dess vy i heapen –, som för varje spelobjekt sedan kapitlet Banor.
:::

`struct BallObject : GameObject` betyder: en `BallObject` *är* ett `GameObject` – den har varje fält som ett sådant har
(Position, Size, Velocity, Color, Rotation, IsSolid, Destroyed, Sprite, med sina standardvärden), följt av sina egna
två, `Radius` och `Stuck`. Det är det som gör bollen användbar överallt där ett spelobjekt förväntas: en `BallObject`
kan skickas till en funktion som tar en `GameObject&`, som då ser bollens `GameObject`-del. Bollen ritas precis som
racketen, med `DrawObject(Ball, Renderer)`.

`MakeBallObject` är learnopengls konstruktor. Storleken är en kvadrat med sidan två gånger radien – bollens sprite ritas
i den kvadraten – och den börjar fastsittande.

Bollen har två egna funktioner. `Move` flyttar bollen utifrån dess hastighet, kontrollerar om den når någon av scenens
kanter och vänder i så fall bollens hastighet:

:::opengl
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```
:::
:::vulkan
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width) {
    // if not stuck to player board
    if (!ball.Stuck) {
        // move the ball
        ball.Position += ball.Velocity * dt;
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        } else if (ball.Position.x + ball.Size.x >= window_width) {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f) {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```
:::
:::d3d12
```cpp
void Move(BallObject& ball, float dt, unsigned int window_width)
{
    // if not stuck to player board
    if (!ball.Stuck)
    {
        // move the ball (DirectXMath computes with XMVECTOR: load the stored XMFLOAT2s, compute, store)
        XMStoreFloat2(&ball.Position, XMLoadFloat2(&ball.Position) + XMLoadFloat2(&ball.Velocity) * dt);
        // then check if outside window bounds and if so, reverse velocity and restore at correct position
        if (ball.Position.x <= 0.0f)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = 0.0f;
        }
        else if (ball.Position.x + ball.Size.x >= window_width)
        {
            ball.Velocity.x = -ball.Velocity.x;
            ball.Position.x = window_width - ball.Size.x;
        }
        if (ball.Position.y <= 0.0f)
        {
            ball.Velocity.y = -ball.Velocity.y;
            ball.Position.y = 0.0f;
        }
    }
}
```

Det enda vektorsteget skrivs med DirectXMath, som Microsofts guide till biblioteket rekommenderar: `XMFLOAT2` *lagrar*
en vektor (i structs, globala variabler, parametrar), `XMVECTOR` *räknar* med den. `XMLoadFloat2` läser in de lagrade
värdena i ett register, DirectXMaths operatorer `+` och `*` räknar, och `XMStoreFloat2` skriver tillbaka resultatet –
learnopengls `this->Position += this->Velocity * dt;`. Enskilda komponenter förblir vanliga floats (`ball.Position.x`),
som hos learnopengl.
:::

Förutom att vända bollens hastighet vill vi också flytta tillbaka bollen till kanten; bollen kan bara röra sig om den
inte sitter fast. Bollens position är dess övre vänstra hörn, så dess högra kant är `Position.x + Size.x`, och det är
den som jämförs med fönstrets bredd. learnopengls `Move` returnerar också den nya positionen, som ingen använder;
kursens returnerar ingenting.

Observera att det inte finns någon kontroll av nederkanten. Spelaren förlorar när bollen når nederkanten – den måste
fångas med racketen. Att upptäcka det och starta ett nytt försök hör till kapitlet Kollisionshantering.

Den andra funktionen, `Reset`, sätter tillbaka bollen på en given position med en given hastighet, fastsittande igen:

:::opengl
```cpp
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::
:::vulkan
```cpp
void Reset(BallObject& ball, glm::vec2 position, glm::vec2 velocity) {
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::
:::d3d12
```cpp
void Reset(BallObject& ball, XMFLOAT2 position, XMFLOAT2 velocity)
{
    ball.Position = position;
    ball.Velocity = velocity;
    ball.Stuck = true;
}
```
:::

Kommentarerna `// TODO:` i projektet visar var din kod ska in, och **Build & run** (Ctrl+Enter) kör den i den inbyggda
simulatorn. Gör nu de två första uppgifterna: **ball-object** – structen och `MakeBallObject` – och **move-reset** – de
två funktionerna. Ingenting använder dem ännu, så bilden ändras inte.

```quiz
När bollen passerar vänsterkanten vänder `Move` på `Velocity.x` *och* sätter `Position.x = 0.0f`. Vad skulle gå fel utan den andra delen?
- [ ] Ingenting: att vända hastigheten räcker
- [ ] Bollen skulle lämna fönstret vid högerkanten i stället
- [x] Bollen kunde fortfarande vara bortom kanten i nästa bildruta och vända igen – den skulle darra längs kanten eller fastna i den
- [ ] Bollen skulle sluta röra sig
---
På en bildruta flyttas bollen några pixlar på en gång, så den hamnar oftast en bit bortom kanten. Att sätta tillbaka den på kanten ser till att den vända hastigheten för bort den från kanten i nästa bildruta.
```

## I spelet

Bollens tal är learnopengls: en starthastighet på (100, −350) – uppåt (y pekar nedåt i spelets koordinater) och lite
åt höger – och en radie på 12.5 pixlar:

:::opengl vulkan
```cpp
// Initial velocity of the Ball
const glm::vec2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;
```
:::
:::d3d12
```cpp
// Initial velocity of the Ball
const XMFLOAT2 INITIAL_BALL_VELOCITY(100.0f, -350.0f);
// Radius of the ball object
const float BALL_RADIUS = 12.5f;
```
:::

och en global `BallObject Ball;` bredvid racketen. I `Init` skapas den efter racketen, ovanpå den, i dess mitt:

:::opengl
```cpp
    glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
```
:::
:::vulkan
```cpp
        glm::vec2 ballPos = playerPos + glm::vec2(PLAYER_SIZE.x / 2.0f - BALL_RADIUS, -BALL_RADIUS * 2.0f);
        Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").DescriptorSet);
```
:::
:::d3d12
```cpp
    XMFLOAT2 ballPos = XMFLOAT2(playerPos.x + PLAYER_SIZE.x / 2.0f - BALL_RADIUS, playerPos.y - BALL_RADIUS * 2.0f);
    Ball = MakeBallObject(ballPos, BALL_RADIUS, INITIAL_BALL_VELOCITY, GetTexture("ball").ID);
```

(komponent för komponent: en `XMFLOAT2` har ingen operator `+`; DirectXMaths vektorräkning arbetar med `XMVECTOR`).
:::

Racketen står på (350, 580) och är 100 pixlar bred, så bollens övre vänstra hörn hamnar på (350 + 50 − 12.5,
580 − 25) = **(387.5, 555)**: centrerad på racketen och vilande på dess ovansida. I `Render` ritas bollen sist, efter
racketen:

```cpp
        // draw ball
        DrawObject(Ball, Renderer);
```

Gör nu uppgiften **draw-ball**. Tryck på **Build & run**: **den ljusgröna bollen ligger på racketen.**

Varje bildruta flyttar spelets `Update` bollen:

```cpp
    // update objects
    Move(Ball, dt, game.Width);
```

Gör nu uppgiften **update**. Ingenting ändras i bilden: bollen sitter fast, och `Move` låter en fastsittande boll
ligga kvar. Det som saknas är indata. Medan bollen sitter fast ska den följa med racketen, och mellanslag släpper den –
i `ProcessInput`:

:::opengl
```cpp
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}
```
:::
:::vulkan
```cpp
void ProcessInput(Game& game, float dt) {
    if (game.State == GAME_ACTIVE) {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A]) {
            if (Player.Position.x >= 0.0f) {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys[GLFW_KEY_D]) {
            if (Player.Position.x <= game.Width - Player.Size.x) {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        if (game.Keys[GLFW_KEY_SPACE])
            Ball.Stuck = false;
    }
}
```
:::
:::d3d12
```cpp
void ProcessInput(Game& game, float dt)
{
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys['A'])
        {
            if (Player.Position.x >= 0.0f)
            {
                Player.Position.x -= velocity;
                if (Ball.Stuck)
                    Ball.Position.x -= velocity;
            }
        }
        if (game.Keys['D'])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
            {
                Player.Position.x += velocity;
                if (Ball.Stuck)
                    Ball.Position.x += velocity;
            }
        }
        // release the ball
        if (game.Keys[VK_SPACE])
            Ball.Stuck = false;
    }
}
```

`VK_SPACE` är mellanslagets virtual-key code, 0x20 – samma tal som `GLFW_KEY_SPACE`.
:::

Om användaren trycker på mellanslag sätts bollens `Stuck` till false. Observera att vi också flyttar bollens position
tillsammans med racketens så länge bollen sitter fast.

Gör nu uppgiften **launch**. Kom ihåg kursens fasta indata (Förberedelser): ingen trycker på A eller D, och mellanslag
trycks ned en gång, vid 0.5 s – bildruta 30 – och släpps vid 0.55 s. Under en halv sekund ligger bollen alltså på
racketen; i bildruta 30 sätter `ProcessInput` `Stuck = false`, och samma bildrutas `Update` flyttar den för första
gången, med (100, −350) × 1/60. Tryck på **Build & run**: bilden visar **1.0 s** – bildruta 60 –, och **bollen flyger
uppåt åt höger**, på (439.17, 374.17), med den tomma racketen under sig.

```quiz
Bollen släpps i bildruta 30 och flyttas med `INITIAL_BALL_VELOCITY / 60` i varje bildruta från och med då, bildruta 30 inräknad. Var ligger dess övre vänstra hörn i bildruta 60 (bilden vid 1.0 s)?
- [ ] På (387.5, 555): bollen sitter fortfarande fast
- [ ] På (437.5, 380): 30 bildrutors rörelse
- [x] På ungefär (439.17, 374.17): 31 bildrutors rörelse (bildrutorna 30 till 60), 31 × (100, −350) / 60 från (387.5, 555)
- [ ] På (487.5, 205): en sekunds rörelse
---
31 × 100 / 60 ≈ 51.67 och 31 × 350 / 60 ≈ 180.83. Eftersom kursens tid är fast, 1/60 per bildruta, är positionen densamma i alla API:er, med alla drivrutiner och i simulatorn – och i learnopengls program med en riktig klocka skulle den bli ungefär densamma.
```

Bollen flyger rakt igenom blocken: ingenting kontrollerar kollisioner ännu. Kör projektet lite längre i huvudet, så når
den överkanten (bildruta 125), studsar mot den – `Move`s kontroll av överkanten –, kommer ned igen och lämnar fönstret
genom nederkanten, och ingenting hämtar tillbaka den. De två nästa kapitlen ändrar på det.

```quiz
Varför kan `DrawObject(Ball, Renderer)` rita bollen, fast `DrawObject` tar en `GameObject&`?
- [ ] Därför att `DrawObject` är överlagrad för `BallObject`
- [x] Därför att `BallObject` härleds från `GameObject`: en referens till basklassen binds till bollens `GameObject`-del, som har position, storlek, färg och sprite
- [ ] Därför att kompilatorn gör om bollen till ett nytt `GameObject` som ritas i stället
- [ ] Därför att C++ ignorerar `Radius` när den inte används
---
Det är skälet att härleda bollen från spelobjektet: varje funktion som skrivits för spelobjekt fungerar på den. Bara det som är specifikt för bollen – Radius, Stuck – behöver egna funktioner.
```

```quiz
`Move` kontrollerar fönstrets vänster-, höger- och överkant. Varför inte nederkanten?
- [ ] Därför att racketen täcker hela nederkanten
- [ ] Därför att y-axeln pekar nedåt, så nederkanten ligger på y = 0
- [ ] Därför att bollen aldrig kan röra sig nedåt
- [x] Därför att nederkanten är där spelaren förlorar: bollen måste fångas med racketen, och en boll som kommer förbi den är förlorad
---
En studs mot nederkanten skulle göra spelet omöjligt att förlora. Spelet kontrollerar själv förlusten – att bollens y når fönstrets höjd – i kapitlet Kollisionshantering.
```

## Mer att läsa

- [Ball](https://learnopengl.com/In-Practice/2D-Game/Ball): learnopengls kapitel som det här kapitlet följer.

:::opengl
- [LearnOpenGL-källkod: 2D-spelet](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengls spel, med `ball_object.h` / `.cpp`.
:::
:::vulkan
- [LearnOpenGL-källkod: 2D-spelet](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/7.in_practice/3.2d_game):
  learnopengls spel, med `ball_object.h` / `.cpp`.
:::
:::d3d12
- [Code optimization with the DirectXMath library](https://learn.microsoft.com/en-us/windows/win32/dxmath/pg-xnamath-optimizing):
  varför XMFLOAT2 lagrar och XMVECTOR räknar.
:::
