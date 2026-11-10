# Banor

Ett spel av det här slaget handlar tyvärr inte bara om en enda glad grön boll, utan också om block – en hel mur av dem,
som spelaren ska röja. Vi vill att blocken ska gå att konfigurera, så att de stöder både flera banor och olika
blocklayouter. Hedgerow har fyra egna banor, var och en i learnopengls format, och ett block kan vara av två slag:

- Ett **solitt** block: ett block av grå sten som inte kan förstöras.
- Ett **vanligt** block: en ljus platta, tonad i en av fyra färger, som bollen förstör när den träffar den.

För att det ska vara enkelt att definiera banor är en bana en vanlig textfil med tal. Varje tal är ett block, och talen
ligger på filens rader så som blocken ligger i muren: en rad per blockrad, talen åtskilda av mellanslag. learnopengls
banformat:

- Talet **0**: inget block, en tom plats i banan.
- Talet **1**: ett solitt block, ett block som inte kan förstöras.
- Ett tal **större än 1**: ett block som kan förstöras; varje följande tal skiljer sig bara i färg.

Kursens banor är 15 block breda och 8 rader höga. Bana ett, `levels/one.lvl`, består av fyra hela rader med färgade
block – talen 5, 4, 3, 2 uppifrån –, en tom rad och en rad stenar med luckor:

```text
5 5 5 5 5 5 5 5 5 5 5 5 5 5 5
4 4 4 4 4 4 4 4 4 4 4 4 4 4 4
3 3 3 3 3 3 3 3 3 3 3 3 3 3 3
2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
1 1 0 0 1 1 0 0 0 1 1 0 0 1 1
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
```

Banorna två till fyra bildar former: en arena inramad av stenar, två färgade diamanter kring en sten och en rutig mur
med inbyggda stenar. De tomma raderna längst ned i varje bana är avsiktliga: de håller muren i den övre delen av ytan
som banan får, med plats för bollen att komma tillbaka.

En bana bearbetas till spelobjekt: ett för varje tal som inte är 0. Innan vi kommer till banan behöver vi spelobjektet.

## Spelobjekt

Ett objekt i ett spel är allt som har en position, en storlek och en bild – racketen, bollen, varje block. learnopengl
skriver en klass `GameObject` som innehåller det minimala tillstånd som vart och ett behöver, och kursen skriver den som
en struct med learnopengls standardvärden:

:::opengl
```cpp
struct GameObject
{
    // object state
    glm::vec2    Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3    Color = glm::vec3(1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID
};
```

learnopengls objekt sparar sin `Texture2D`; kursen sparar texturens ID, som är det `DrawSprite` tar.
:::
:::vulkan
```cpp
struct GameObject {
    // object state
    glm::vec2       Position = glm::vec2(0.0f, 0.0f), Size = glm::vec2(1.0f, 1.0f), Velocity = glm::vec2(0.0f);
    glm::vec3       Color = glm::vec3(1.0f);
    float           Rotation = 0.0f;
    bool            IsSolid = false;
    bool            Destroyed = false;
    // render state
    VkDescriptorSet Sprite = VK_NULL_HANDLE; // the texture's descriptor set
};
```

learnopengls objekt sparar sin `Texture2D`; Vulkan-versionen sparar texturens **descriptor set**, som är det
`DrawSprite` binder för ritanropet.
:::
:::d3d12
```cpp
struct GameObject
{
    // object state
    XMFLOAT2     Position = XMFLOAT2(0.0f, 0.0f), Size = XMFLOAT2(1.0f, 1.0f), Velocity = XMFLOAT2(0.0f, 0.0f);
    XMFLOAT3     Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
    float        Rotation = 0.0f;
    bool         IsSolid = false;
    bool         Destroyed = false;
    // render state
    unsigned int Sprite = 0; // the texture's ID (its view's slot in the heap)
};
```

learnopengls objekt sparar sin `Texture2D`; Direct3D 12-versionen sparar texturens ID – platsen för dess shader resource
view i heapen, som är det `DrawSprite` pekar root-parameter 2 på.
:::

Förutom position, storlek och sprite finns en hastighet (bollen kommer att behöva den), en färg som tonar spriten, en
rotation och två flaggor för blocken: `IsSolid` – det kan inte förstöras – och `Destroyed`. learnopengls konstruktor
blir en funktion som skapar ett objekt, med samma standardargument, och dess `Draw` en fri funktion:

:::opengl
```cpp
// creates a game object (learnopengl's GameObject constructor)
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, unsigned int sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::
:::vulkan
```cpp
GameObject MakeGameObject(glm::vec2 pos, glm::vec2 size, VkDescriptorSet sprite, glm::vec3 color = glm::vec3(1.0f), glm::vec2 velocity = glm::vec2(0.0f, 0.0f)) {
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer) {
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::
:::d3d12
```cpp
GameObject MakeGameObject(XMFLOAT2 pos, XMFLOAT2 size, unsigned int sprite, XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f), XMFLOAT2 velocity = XMFLOAT2(0.0f, 0.0f))
{
    GameObject obj;
    obj.Position = pos;
    obj.Size = size;
    obj.Velocity = velocity;
    obj.Color = color;
    obj.Sprite = sprite;
    return obj;
}

// draw sprite
void DrawObject(GameObject& obj, SpriteRenderer& renderer)
{
    DrawSprite(renderer, obj.Sprite, obj.Position, obj.Size, obj.Rotation, obj.Color);
}
```
:::

## Texturerna

Innan det finns något att göra objekt av behöver spelet sina bilder. Kursens egna, i `textures/`:

- `background.png` – 800 × 600, trädgården i skymningen: en natthimmel som ljusnar nedåt, månen, kullar och häckar;
- `block.png` – 128 × 128, en ljus platta med fasad kant, som spelet tonar med blockets färg;
- `block_solid.png` – 128 × 128, ett block av grå sten;
- `paddle.png` – 512 × 128 med genomskinliga hörn, en racket av trä med mässingsändar;
- och `ball.png` från förra kapitlet, som förblir laddad för kapitlet Bollen men inte längre ritas.

learnopengl laddar sina egna bilder här under samma namn.

:::opengl
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
```

Bakgrunden och blocken har inga genomskinliga delar och laddas som RGB; racketen och bollen med alfa.
:::
:::vulkan
```cpp
        // load textures
        LoadTexture("textures/ball.png", "ball");
        LoadTexture("textures/background.png", "background");
        LoadTexture("textures/block.png", "block");
        LoadTexture("textures/block_solid.png", "block_solid");
        LoadTexture("textures/paddle.png", "paddle");
```

Varje textur är RGBA i Vulkan-versionen (RGB-filerna får alfa 255), så det finns inget argument `alpha`. Descriptor
poolen innehåller nu 5 av sina 16 sets.
:::
:::d3d12
```cpp
    // load textures
    LoadTexture("textures/ball.png", true, "ball");
    LoadTexture("textures/background.png", false, "background");
    LoadTexture("textures/block.png", false, "block");
    LoadTexture("textures/block_solid.png", false, "block_solid");
    LoadTexture("textures/paddle.png", true, "paddle");
```

Varje bild laddas som RGBA i Direct3D 12 (RGB-filerna får alfa 255); `alpha` finns kvar för learnopengls signatur.
Texturernas vyer tar heapens platser 1 (ball) till 5 (paddle).
:::

Bakgrunden fyller hela fönstret. I `Render`, bara medan spelet är aktivt (menyn och vinstskärmen kommer att rita något
annat):

:::opengl
```cpp
    if (game.State == GAME_ACTIVE)
    {
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
```
:::
:::vulkan
```cpp
    if (game.State == GAME_ACTIVE) {
        // draw background
        DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
```
:::
:::d3d12
```cpp
    if (game.State == GAME_ACTIVE)
    {
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f), XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);
```
:::

Kommentarerna `// TODO:` i projektet visar var koden för varje uppgift ska in. Gör nu den första uppgiften,
**background**: ladda de fyra texturerna efter bollens och rita bakgrunden i stället för bollen. Tryck på **Build & run**
(Ctrl+Enter): **trädgården i skymningen fyller fönstret** – stjärnorna, månen uppe till höger, kullarna och häckarna.

Gör nu uppgiften **game-object**: structen, `MakeGameObject` och `DrawObject`. Ingenting använder dem ännu – bilden är
densamma.

## Spelbanor

En bana är en lista med block, och learnopengls klass `GameLevel` innehåller just det, tillsammans med funktioner för att
ladda en bana från en fil, rita den och avgöra om den är klar:

:::opengl d3d12
```cpp
struct GameLevel
{
    // level state
    std::vector<GameObject> Bricks;
};
```
:::
:::vulkan
```cpp
struct GameLevel {
    // level state
    std::vector<GameObject> Bricks;
};
```
:::

Att ladda en bana betyder att läsa filen rad för rad och varje rad tal för tal, till rader av blockkoder:

:::opengl d3d12
```cpp
void LoadLevel(GameLevel& level, const char *file, unsigned int levelWidth, unsigned int levelHeight)
{
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream)
    {
        while (std::getline(fstream, line)) // read each line from level file
        {
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}
```
:::
:::vulkan
```cpp
void LoadLevel(GameLevel& level, const char* file, unsigned int levelWidth, unsigned int levelHeight) {
    // clear old data
    level.Bricks.clear();
    // load from file
    unsigned int tileCode;
    std::string line;
    std::ifstream fstream(file);
    std::vector<std::vector<unsigned int>> tileData;
    if (fstream) {
        while (std::getline(fstream, line)) { // read each line from level file
            std::istringstream sstream(line);
            std::vector<unsigned int> row;
            while (sstream >> tileCode) // read each word separated by spaces
                row.push_back(tileCode);
            tileData.push_back(row);
        }
        if (tileData.size() > 0)
            InitLevel(level, tileData, levelWidth, levelHeight);
    }
}
```
:::

De laddade blockdata skickas sedan till banans funktion `InitLevel` (learnopengls privata `init`), som gör koderna till
block. `levelWidth` och `levelHeight` är storleken på ytan som banan fyller, i pixlar – det behöver inte vara hela
fönstret, och spelet ger den bara den övre halvan:

:::opengl
```cpp
void InitLevel(GameLevel& level, std::vector<std::vector<unsigned int>> tileData, unsigned int levelWidth, unsigned int levelHeight)
{
    // calculate dimensions
    unsigned int height = tileData.size();
    unsigned int width = tileData[0].size(); // note we can index vector at [0] since this function is only called if height > 0
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
    // initialize level tiles based on tileData
    for (unsigned int y = 0; y < height; ++y)
    {
        for (unsigned int x = 0; x < width; ++x)
        {
            // check block type from level data (2D level array)
            if (tileData[y][x] == 1) // solid
            {
                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").ID, glm::vec3(0.8f, 0.8f, 0.7f));
                obj.IsSolid = true;
                level.Bricks.push_back(obj);
            }
            else if (tileData[y][x] > 1) // non-solid; now determine its color based on level data
            {
                glm::vec3 color = glm::vec3(1.0f); // original: white
                if (tileData[y][x] == 2)
                    color = glm::vec3(0.2f, 0.6f, 1.0f);
                else if (tileData[y][x] == 3)
                    color = glm::vec3(0.0f, 0.7f, 0.0f);
                else if (tileData[y][x] == 4)
                    color = glm::vec3(0.8f, 0.8f, 0.4f);
                else if (tileData[y][x] == 5)
                    color = glm::vec3(1.0f, 0.5f, 0.0f);

                glm::vec2 pos(unit_width * x, unit_height * y);
                glm::vec2 size(unit_width, unit_height);
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").ID, color));
            }
        }
    }
}
```
:::
:::vulkan
Vulkan-versionen är samma funktion med descriptor seten som sprites:

```cpp
                GameObject obj = MakeGameObject(pos, size, GetTexture("block_solid").DescriptorSet, glm::vec3(0.8f, 0.8f, 0.7f));
```

för de solida blocken (med `obj.IsSolid = true;`), och för de andra, efter learnopengls kedja av färger – 2 →
(0.2, 0.6, 1.0), 3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0):

```cpp
                level.Bricks.push_back(MakeGameObject(pos, size, GetTexture("block").DescriptorSet, color));
```

Måtten är learnopengls:

```cpp
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
```

och varje block ligger på `glm::vec2 pos(unit_width * x, unit_height * y);` med storleken `glm::vec2 size(unit_width,
unit_height);`, för `x` över kolumnerna och `y` över raderna i `tileData`.
:::
:::d3d12
Direct3D 12-versionen är samma funktion med DirectXMaths typer:

```cpp
    float unit_width = levelWidth / static_cast<float>(width), unit_height = levelHeight / static_cast<float>(height);
```

varje block på `XMFLOAT2 pos(unit_width * x, unit_height * y);` med storleken `XMFLOAT2 size(unit_width, unit_height);`,
för `x` över kolumnerna och `y` över raderna i `tileData`; ett solitt block är
`MakeGameObject(pos, size, GetTexture("block_solid").ID, XMFLOAT3(0.8f, 0.8f, 0.7f))` med `obj.IsSolid = true;`, de
andra `MakeGameObject(pos, size, GetTexture("block").ID, color)` efter learnopengls kedja av färger – 2 →
(0.2, 0.6, 1.0), 3 → (0.0, 0.7, 0.0), 4 → (0.8, 0.8, 0.4), 5 → (1.0, 0.5, 0.0), med början i
`XMFLOAT3 color = XMFLOAT3(1.0f, 1.0f, 1.0f);`.
:::

Init-funktionen går igenom vart och ett av de laddade talen och lägger till ett spelobjekt i banans vektor `Bricks`
utifrån det bearbetade talet. Varje blocks storlek (`unit_width` och `unit_height`) räknas ut automatiskt utifrån det
totala antalet block, så att varje block passar perfekt inom skärmens gränser: ytans bredd delat med antalet kolumner,
dess höjd med antalet rader. För bana ett med 15 kolumner och 8 rader på en yta av 800 × 300 pixlar är ett block
800 / 15 ≈ 53.3 pixlar brett och 300 / 8 = **37.5** pixlar högt. Positionen för blocket i kolumn x och rad y är
(unit_width · x, unit_height · y) – dess övre vänstra hörn, som sprite-renderaren förväntar sig.

Här laddar vi spelobjekten med två nya texturer: en blocktextur och en textur för solida block. De solida blocken får en
ljust gråbeige toning, färgkoderna färgerna från learnopengls spel. Ett trevligt litet knep här är att blocktexturen är
ljusgrå överallt, med bara lite skuggning vid kanterna: tonad med en färg blir den ett block i den färgen – en textur
för alla färger.

**En skillnad mot learnopengl.** learnopengl räknar ut höjden som `levelHeight / height`, båda `unsigned int` – en
heltalsdivision: 300 / 8 = 37, så dess rader är 37 pixlar höga och muren slutar 4 pixlar före ytans nederkant. Kursen
dividerar som floats, `levelHeight / static_cast<float>(height)`, som koden tydligt avser (bredden divideras som float
även hos learnopengl) – i varje API, så att bilderna stämmer överens.

```quiz
Bana ett har 15 tal per rad och 8 rader, och laddas in på en yta av 800 × 300 pixlar. Var ligger det övre vänstra hörnet av blocket i kolumn 4, rad 5 (räknat från 0) – den tredje stenen från vänster?
- [ ] På (4, 5)
- [x] På (4 · 53.33, 5 · 37.5) ≈ (213.3, 187.5)
- [ ] På (5 · 53.33, 4 · 37.5) ≈ (266.7, 150)
- [ ] På (4 · 53.33, 5 · 75) ≈ (213.3, 375)
---
x räknar kolumnerna och skalas med `unit_width` = 800 / 15, y raderna med `unit_height` = 300 / 8. Raderna 0–3 innehåller färgerna (y 0 … 150), rad 4 är tom, stenarna ligger i rad 5 på y 187.5 … 225.
```

För att rita en bana ritar vi vart och ett av dess block som inte har förstörts – kollisionskapitlen kommer att sätta
`Destroyed` när bollen träffar ett block:

:::opengl d3d12
```cpp
void DrawLevel(GameLevel& level, SpriteRenderer& renderer)
{
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}
```
:::
:::vulkan
```cpp
void DrawLevel(GameLevel& level, SpriteRenderer& renderer) {
    for (GameObject& tile : level.Bricks)
        if (!tile.Destroyed)
            DrawObject(tile, renderer);
}
```
:::

Loopen tar varje block som referens (`GameObject&`): en kopia av varje block i varje bildruta skulle också fungera, men
det finns ingen anledning att göra en. learnopengls banklass har också `IsCompleted`, som kontrollerar om varje
icke-solitt block är förstört: då är banan klar. Ingenting kan förstöras ännu, så kursen lägger till den i ett senare
kapitel, när spelet behöver den.

Gör nu uppgiften **load-level**: structen, `LoadLevel` och `InitLevel`. Ingenting laddar en bana ännu – bilden är
densamma.

### I spelet

Vi vill stödja flera banor i spelet, så vi behöver bygga ut spelets struct lite med en vektor som innehåller banorna och
indexet för den aktuella:

:::opengl d3d12
```cpp
struct Game
{
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = SCREEN_WIDTH, Height = SCREEN_HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};
```
:::
:::vulkan
```cpp
struct Game {
    // game state
    GameState               State = GAME_ACTIVE;
    bool                    Keys[1024] = {};
    unsigned int            Width = WIDTH, Height = HEIGHT;
    std::vector<GameLevel>  Levels;
    unsigned int            Level = 0;
};
```
:::

I `Init`, efter texturerna, laddas de fyra banorna i ordning, på en yta lika bred som fönstret och **halvt så hög** –
den övre halvan, där muren hör hemma –, och den första väljs:

```cpp
    // load levels
    GameLevel one; LoadLevel(one, "levels/one.lvl", game.Width, game.Height / 2);
    GameLevel two; LoadLevel(two, "levels/two.lvl", game.Width, game.Height / 2);
    GameLevel three; LoadLevel(three, "levels/three.lvl", game.Width, game.Height / 2);
    GameLevel four; LoadLevel(four, "levels/four.lvl", game.Width, game.Height / 2);
    game.Levels.push_back(one);
    game.Levels.push_back(two);
    game.Levels.push_back(three);
    game.Levels.push_back(four);
    game.Level = 0;
```

Texturerna måste laddas före banorna: `InitLevel` ber resurshanteraren om `"block"` och `"block_solid"`.

```quiz
Vad skulle hända om `Init` laddade banorna *före* blocktexturerna?
- [x] Varje block skulle behålla en sprite som inte är någon textur: `GetTexture("block")` på ett namn som inte har laddats ännu skapar en tom `Texture2D` med standardvärden i mappen, och blocken sparar dess ID (eller descriptor set) för gott
- [ ] Ingenting: blocken slår upp sin textur igen varje gång de ritas
- [ ] `LoadLevel` skulle inte kunna öppna banfilen
- [ ] Resurshanteraren skulle ladda texturerna själv när någon frågar efter dem
---
`InitLevel` kopierar texturens ID (eller descriptor set) till varje block när det skapas. `std::map`s `operator[]`, som `GetTexture` använder, lägger in ett standardkonstruerat värde för en okänd nyckel – inget fel, bara en tom textur.
```

Och i `Render`, efter bakgrunden:

```cpp
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
```

Gör nu uppgiften **draw-level**: `DrawLevel`, de två medlemmarna i `Game`, banorna i `Init` och anropet i `Render`. Tryck
på **Build & run**: **bana ett dyker upp i den övre halvan** – raderna med orange, gula, gröna och blå plattor, varje
platta ljusare och mörkare vid sina fasade kanter runt en platt mitt, och under en lucka raden av grå stenar. Månen är nu
dold bakom den gröna raden.

:::opengl
Det är 69 ritanrop per bildruta – bakgrunden och 68 block –, vart och ett med sina `glUniform*`-anrop, en texturbindning
och ett `glDrawArrays` med 6 vertex.
:::
:::vulkan
Det är 69 ritanrop per bildruta – bakgrunden och 68 block. Varje `DrawSprite` spelar in ett `vkCmdBindPipeline`, sina
push constants (blockets modellmatris och färg), ett `vkCmdBindDescriptorSets` med sin texturs set och ett `vkCmdDraw`;
de 68 blocken använder bara två descriptor sets, `block`s och `block_solid`s.
:::
:::d3d12
Det är 69 ritanrop per bildruta – bakgrunden och 68 block. Varje `DrawSprite` spelar in `SetPipelineState`, sina root
constants (blockets modellmatris och färg), descriptor-tabellen för sin textur (heapens plats 3 för `block`, 4 för
`block_solid`) och ett `DrawInstanced` med 6 vertex.
:::

Att rita varje block med ett eget ritanrop är learnopengls enkla sätt och fungerar bra för några hundra sprites. Ett
spel med tusentals skulle lägga alla block med samma textur i ett instansierat ritanrop, eller alla i en atlas och ett
ritanrop.

:::opengl
```quiz
Vad ändrar varje blocks ritanrop i OpenGL-tillståndet, jämfört med blocket före det?
- [ ] Vertex array objectet, eftersom varje block har sin egen rektangel
- [x] Uniforms `model` och `spriteColor` (och den bundna texturen när den växlar mellan block och sten) – rektangeln, shadern och projektionen är desamma
- [ ] Ingenting: alla block ritas med ett enda ritanrop
- [ ] Projektionsmatrisen, som sätts till blockets yta
---
Den enda enhetsrektangeln skalas och flyttas av modellmatrisen; färgen tonar den gemensamma ljusa plattan. Därför kan en enda blocktextur ge block i fyra färger.
```
:::
:::vulkan
```quiz
68 block ritas med bara två texturer. Vad spelar varje blocks `DrawSprite` in som skiljer sig från blocket före det?
- [ ] En ny vertex buffer, eftersom varje block har sin egen rektangel
- [ ] En ny descriptor set per block, allokerad under inspelningen
- [x] Sina push constants – modellmatrisen och färgen –, och descriptor seten för sin textur (block eller sten); pipelinen och rektangeln är desamma för alla
- [ ] Ingenting: alla block ritas med ett enda `vkCmdDraw`
---
Push constants är gjorda för just det här: små värden som ändras från ritanrop till ritanrop, inspelade i command buffern. Att binda samma pipeline och descriptor set igen är tillåtet och billigt; en renderare skulle kunna hoppa över de upprepade bindningarna.
```
:::
:::d3d12
```quiz
68 block ritas med bara två texturer. Vad spelar varje blocks `DrawSprite` in som skiljer sig från blocket före det?
- [ ] En ny vertex buffer view, eftersom varje block har sin egen rektangel
- [ ] En ny shader resource view per block, skapad under inspelningen
- [ ] Ingenting: alla block ritas med ett enda `DrawInstanced`
- [x] Sina root constants – modellmatrisen och färgen –, och descriptor-tabellen för sin textur (block eller sten); pipeline staten och rektangeln är desamma för alla
---
Root constants är gjorda för just det här: små värden som ändras från ritanrop till ritanrop, inspelade i command listen. Att sätta samma pipeline state och tabell igen är tillåtet och billigt; en renderare skulle kunna hoppa över de upprepade anropen.
```
:::

## Spelarens racket

Härnäst lägger vi till en racket längst ned i scenen som styrs av spelaren. Racketen kan bara röra sig i sidled, och när
den når någon av scenens kanter ska den stanna. Till spelarens racket använder vi kursens racket-textur – en racket av
trä med mässingsändar.

Ett racket-objekt har en position, en storlek och en sprite-textur, så det är rimligt att definiera racketen som ett
spelobjekt också:

:::opengl vulkan
```cpp
// Initial size of the player paddle
const glm::vec2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
```
:::
:::d3d12
```cpp
// Initial size of the player paddle
const XMFLOAT2 PLAYER_SIZE(100.0f, 20.0f);
// Initial velocity of the player paddle
const float PLAYER_VELOCITY(500.0f);
```
:::

och en global `GameObject Player;` bredvid `Hedgerow` och `Renderer`. Här definierade vi några konstanter som anger
racketens storlek och hastighet: 100 × 20 pixlar, 500 pixlar per sekund. I spelets funktion `Init` räknar vi ut
racketens startposition i scenen. Vi ser till att racketens mitt ligger i scenens vågräta mitt och att den står på
nederkanten:

:::opengl
```cpp
    // configure game objects
    glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
```
:::
:::vulkan
```cpp
        // configure game objects
        glm::vec2 playerPos = glm::vec2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
        Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").DescriptorSet);
```
:::
:::d3d12
```cpp
    // configure game objects
    XMFLOAT2 playerPos = XMFLOAT2(game.Width / 2.0f - PLAYER_SIZE.x / 2.0f, game.Height - PLAYER_SIZE.y);
    Player = MakeGameObject(playerPos, PLAYER_SIZE, GetTexture("paddle").ID);
```
:::

Det är (800 / 2 − 50, 600 − 20) = **(350, 580)**. I `Render` ritas den sist, efter banan:

```cpp
        // draw player
        DrawObject(Player, Renderer);
```

Eftersom racketen ritas efter bakgrunden ritas den ovanpå den – ritanropens ordning är lagrens ordning, och blending
låter bakgrunden synas genom racketens genomskinliga hörn.

Eftersom vi redan definierade racketens rörelsetangenter i tangenthanteringen i de tidigare kapitlen kan vi nu flytta
den med A och D i `ProcessInput`:

:::vulkan
```cpp
    if (game.State == GAME_ACTIVE) {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A]) {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys[GLFW_KEY_D]) {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```
:::
:::opengl
```cpp
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys[GLFW_KEY_A])
        {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys[GLFW_KEY_D])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```
:::
:::d3d12
```cpp
    if (game.State == GAME_ACTIVE)
    {
        float velocity = PLAYER_VELOCITY * dt;
        // move playerboard
        if (game.Keys['A'])
        {
            if (Player.Position.x >= 0.0f)
                Player.Position.x -= velocity;
        }
        if (game.Keys['D'])
        {
            if (Player.Position.x <= game.Width - Player.Size.x)
                Player.Position.x += velocity;
        }
    }
```

`Keys['A']` och `Keys['D']`: bokstävernas virtual-key codes är deras ASCII-koder för versaler, samma tal som GLFW:s
`GLFW_KEY_A` och `GLFW_KEY_D`.
:::

Här flyttar vi spelarens racket åt vänster eller höger beroende på vilken tangent användaren trycker på (observera att
vi multiplicerar hastigheten med delta time). Om racketens x-värde vore mindre än 0 skulle den ha flyttats utanför
vänsterkanten, så vi flyttar bara racketen åt vänster om dess x-värde är större än vänsterkantens x-position (0.0). Vi
gör detsamma när racketen passerar högerkanten, men då måste vi jämföra högerkantens position med racketens högra kant
(dra av racketens bredd från högerkantens x-position). Observera att testet görs *före* förflyttningen: en racket på
x = 3 flyttas ändå 8.3 pixlar åt vänster, till x = −5.3, och stannar först då. Racketen kan sticka ut ur fönstret med
upp till en bildrutas rörelse – learnopengls enkla kontroll, tillräckligt bra här.

Gör nu uppgiften **player**: konstanterna, den globala variabeln, racketen i `Init`, dess rörelse i `ProcessInput` och
dess ritanrop i `Render`. Tryck på **Build & run**: **träracketen dyker upp nere i mitten**, från (350, 580) till
(450, 600), med sina mässingsändar på båda sidor. Kursen trycker inte på några rörelsetangenter, så den stannar där; på
din egen dator, utanför kursen, skulle A och D flytta den.

:::opengl
70 ritanrop per bildruta: bakgrund, 68 block, racket.
:::
:::vulkan
70 ritanrop per bildruta: bakgrund, 68 block, racket. Jämförd pixel för pixel med OpenGL-versionen är bilden densamma
utom längs blockens kanter på y = 37.5, 112.5 och 187.5: där går en blockkant exakt genom mittpunkterna i en rad pixlar,
och Vulkans top-left-rasteriseringsregel (med y nedåt) ger de pixlarna till blocket under, där OpenGL:s (med y uppåt)
ger dem till blocket över. Ingen av dem har fel; båda reglerna ser till att en pixel på en gemensam kant ritas exakt en
gång.
:::
:::d3d12
70 ritanrop per bildruta: bakgrund, 68 block, racket. Direct3D:s top-left-rasteriseringsregel avgör som Vulkans: längs
blockens kanter på y = 37.5, 112.5 och 187.5, som går exakt genom mittpunkterna i en rad pixlar, går de pixlarna till
blocket under, där OpenGL ger dem till blocket över. Ingen av dem har fel; båda reglerna ser till att en pixel på en
gemensam kant ritas exakt en gång.
:::

```quiz
Varför jämför `ProcessInput` `Player.Position.x <= game.Width - Player.Size.x` för högerkanten i stället för `Player.Position.x <= game.Width`?
- [ ] Därför att `game.Width` är fönstrets mitt
- [x] Därför att `Position` är racketens vänstra kant: dess högra kant är `Position.x + Size.x`, och den måste stanna inne i fönstret
- [ ] Därför att racketen ritas spegelvänd
- [ ] Därför att `Size.x` är racketens hastighet
---
Ett objekts position är dess övre vänstra hörn i hela spelet (sprite-renderarens konvention). För vänsterkanten räcker `Position.x >= 0`; för den högra måste bredden räknas med.
```

Och det var allt för det här kapitlet: spelet ritar sin bakgrund, sin första bana och racketen, som spelaren kan flytta.
I nästa kapitel kommer bollen, och med den kollisioner.

## Mer att läsa

- [Levels](https://learnopengl.com/In-Practice/2D-Game/Levels): learnopengls kapitel som det här kapitlet följer.
- [std::getline](https://en.cppreference.com/w/cpp/string/basic_string/getline) och
  [std::basic_istringstream](https://en.cppreference.com/w/cpp/io/basic_istringstream): C++-koden som läser banfilerna.

:::vulkan
- [Descriptor sets (Vulkan-specifikationen)](https://docs.vulkan.org/spec/latest/chapters/descriptorsets.html): det ett
  ritanrop binder för sin textur.
:::
:::d3d12
- [Descriptor tables](https://learn.microsoft.com/en-us/windows/win32/direct3d12/descriptor-tables): det ett ritanrop
  pekar root-parameter 2 på.
:::
