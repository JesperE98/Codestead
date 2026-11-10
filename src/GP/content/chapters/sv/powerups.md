# Power-ups

Hedgerow är nästan klart, men det vore roligt att lägga till åtminstone en spelmekanik till, så att det inte bara blir
ett vanligt spel av sin sort; vad sägs om power-ups?

Idén är att varje gång ett block förstörs har blocket en liten chans att skapa en power-up. En sådan power-up faller
sakta nedåt, och om den kolliderar med racketen händer något intressant, beroende på vilken sorts power-up det är. Till
exempel gör en power-up racketen större, och en annan låter bollen gå igenom block. Vi tar också med några negativa
power-ups som påverkar spelaren negativt – de två efterbehandlingseffekter som förra kapitlet provade får ett jobb här.

Vi kan modellera en power-up som ett spelobjekt med några extra egenskaper: en typ (som sträng), en varaktighet för hur
länge den är aktiv, och om den är aktiverad just nu. Hedgerow har learnopengls 4 positiva och 2 negativa power-ups:

- **Speed** (fart): ökar bollens hastighet med 20 %.
- **Sticky** (klibbig): när bollen kolliderar med racketen fastnar den på racketen tills mellanslag trycks igen. Det
  låter spelaren placera bollen bättre innan den släpps.
- **Pass-through** (genomgång): kollisionshanteringen är avstängd för block som inte är solida, så att bollen kan gå
  igenom flera block.
- **Pad-size-increase** (större racket): gör racketen 50 pixlar bredare.
- **Confuse** (förvirra): slår på efterbehandlingseffekten confuse en kort stund och förvirrar spelaren.
- **Chaos** (kaos): slår på efterbehandlingseffekten chaos en kort stund och desorienterar spelaren rejält.

Kursens power-up-texturer är sex ljusa piller med en mörk ikon, 512 × 128 pixlar, i `textures/`: `powerup_speed.png`,
`powerup_sticky.png`, `powerup_pass.png`, `powerup_increase.png`, `powerup_confuse.png` och `powerup_chaos.png`
(learnopengl har egna texturer). Precis som blocktexturerna är de ljusa och nästan utan färg, så varje power-ups
färgvektor tonar dem: färgen gör varje sort lätt att känna igen.

**Ett test, eftersom inget block går sönder.** Med kursens fasta indata studsar bollen mot den solida stenen (5, 9) i
bildruta 86 och tappas i bildruta 151 (se `collision-resolution`): inget block förstörs någonsin, så ingen power-up
skulle någonsin skapas, och inget i det här kapitlet skulle synas. Därför lägger den andra uppgiften in en power-up av
varje sort i spelet för hand, i `Init`, som om sex block just hade gått sönder i den tomma raden mellan de blå blocken
och stenarna. Ett riktigt spel skulle inte ha de raderna; de finns kvar genom kapitlet `audio`, och första uppgiften i
`render-text` tar bort dem igen. Kapitlets bilder tas vid **1,5 s** (bildruta 90), när power-upsen faller, och vid
**3,0 s** (bildruta 180).

## Power-upen

En power-up är ett spelobjekt med extra tillstånd. learnopengls klass `PowerUp` ärver från `GameObject`; kursens struct
gör detsamma, och learnopengls konstruktor blir `MakePowerUp`:

:::opengl
```cpp
const glm::vec2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const glm::vec2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, glm::vec3 color, float duration, glm::vec2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```
:::
:::vulkan
```cpp
const glm::vec2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const glm::vec2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject {
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, glm::vec3 color, float duration, glm::vec2 position, VkDescriptorSet sprite) {
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```

Som för varje spelobjekt är spriten texturens descriptor set.
:::
:::d3d12
```cpp
const XMFLOAT2 POWERUP_SIZE(60.0f, 20.0f);
// Velocity a PowerUp block has when spawned
const XMFLOAT2 VELOCITY(0.0f, 150.0f);

struct PowerUp : GameObject
{
    // powerup state
    std::string Type;
    float       Duration = 0.0f;
    bool        Activated = false;
};

PowerUp MakePowerUp(std::string type, XMFLOAT3 color, float duration, XMFLOAT2 position, unsigned int sprite)
{
    PowerUp powerUp;
    powerUp.Position = position;
    powerUp.Size = POWERUP_SIZE;
    powerUp.Velocity = VELOCITY;
    powerUp.Color = color;
    powerUp.Sprite = sprite;
    powerUp.Type = type;
    powerUp.Duration = duration;
    powerUp.Activated = false;
    return powerUp;
}
```
:::

Varje power-up är 60 × 20 pixlar och faller med 150 pixlar per sekund. Eftersom effekterna sticky och pass-through ändrar
spelets logik lagrar learnopengl dem som egenskaper hos bollen – `bool Sticky = false, PassThrough = false;` i
`BallObject`, som nollställs igen i `Reset`. Eftersom power-ups har tillstånd, en varaktighet och effekter håller spelet
alla – fallande eller aktiva – i en vektor, `std::vector<PowerUp> PowerUps;` i `Game`. De sex texturerna laddas efter
partikeltexturen (`powerup_pass.png` som `"powerup_pass"`), och `Render` ritar varje power-up som inte är förstörd, efter
racketen:

```cpp
// draw PowerUps
for (PowerUp& powerUp : game.PowerUps)
    if (!powerUp.Destroyed)
        DrawObject(powerUp, Renderer);
```

Gör nu uppgiften **powerup-object**. Vektorn är tom: **ingen synlig förändring**.

Gör sedan uppgiften **try-powerups**: i slutet av `Init`, efter bollen, lägg in en power-up av varje sort i
`game.PowerUps`, vid y = 160 och x = 40, 150, 260, 370, 480 och 590, med learnopengls färger och varaktigheter:

:::opengl
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, glm::vec2(40.0f, 160.0f), GetTexture("powerup_speed").ID));
game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, glm::vec2(150.0f, 160.0f), GetTexture("powerup_sticky").ID));
game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, glm::vec2(260.0f, 160.0f), GetTexture("powerup_pass").ID));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, glm::vec2(370.0f, 160.0f), GetTexture("powerup_increase").ID));
game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, glm::vec2(480.0f, 160.0f), GetTexture("powerup_confuse").ID));
game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, glm::vec2(590.0f, 160.0f), GetTexture("powerup_chaos").ID));
```
:::
:::vulkan
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, glm::vec2(40.0f, 160.0f), GetTexture("powerup_speed").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, glm::vec2(150.0f, 160.0f), GetTexture("powerup_sticky").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, glm::vec2(260.0f, 160.0f), GetTexture("powerup_pass").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, glm::vec2(370.0f, 160.0f), GetTexture("powerup_increase").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, glm::vec2(480.0f, 160.0f), GetTexture("powerup_confuse").DescriptorSet));
game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, glm::vec2(590.0f, 160.0f), GetTexture("powerup_chaos").DescriptorSet));
```
:::
:::d3d12
```cpp
// try the power-ups out: one of each kind in the empty row above the stones (no brick breaks with the fixed input)
game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, XMFLOAT2(40.0f, 160.0f), GetTexture("powerup_speed").ID));
game.PowerUps.push_back(MakePowerUp("sticky", XMFLOAT3(1.0f, 0.5f, 1.0f), 20.0f, XMFLOAT2(150.0f, 160.0f), GetTexture("powerup_sticky").ID));
game.PowerUps.push_back(MakePowerUp("pass-through", XMFLOAT3(0.5f, 1.0f, 0.5f), 10.0f, XMFLOAT2(260.0f, 160.0f), GetTexture("powerup_pass").ID));
game.PowerUps.push_back(MakePowerUp("pad-size-increase", XMFLOAT3(1.0f, 0.6f, 0.4f), 0.0f, XMFLOAT2(370.0f, 160.0f), GetTexture("powerup_increase").ID));
game.PowerUps.push_back(MakePowerUp("confuse", XMFLOAT3(1.0f, 0.3f, 0.3f), 15.0f, XMFLOAT2(480.0f, 160.0f), GetTexture("powerup_confuse").ID));
game.PowerUps.push_back(MakePowerUp("chaos", XMFLOAT3(0.9f, 0.25f, 0.25f), 15.0f, XMFLOAT2(590.0f, 160.0f), GetTexture("powerup_chaos").ID));
```
:::

En varaktighet på 0 betyder att effekten är permanent: farten och racketens storlek förblir ändrade när de väl har
ändrats. Tryck på **Build & run**: **sex tonade piller i raden ovanför stenarna** – blått, rosa, grönt, orange och två
röda. De rör sig inte än: inget uppdaterar dem.

## Uppdatera power-upsen

Power-ups måste röra sig när de har skapats, och de måste stängas av så snart deras tid är slut; annars skulle de vara
aktiva för alltid. learnopengls `UpdatePowerUps` flyttar varje power-up med dess hastighet och räknar ned de aktivas
varaktighet. När en varaktighet når 0 stängs power-upen av och dess effekt slås av – de berörda variablerna återställs
till sitt ursprungliga tillstånd:

:::opengl
```cpp
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        powerUp.Position += powerUp.Velocity * dt;
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = glm::vec3(1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```
:::
:::vulkan
```cpp
void UpdatePowerUps(Game& game, float dt) {
    for (PowerUp& powerUp : game.PowerUps) {
        powerUp.Position += powerUp.Velocity * dt;
        if (powerUp.Activated) {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f) {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky")) { // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = glm::vec3(1.0f);
                    }
                } else if (powerUp.Type == "pass-through") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through")) { // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = glm::vec3(1.0f);
                    }
                } else if (powerUp.Type == "confuse") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse")) { // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                } else if (powerUp.Type == "chaos") {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos")) { // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```
:::
:::d3d12
```cpp
void UpdatePowerUps(Game& game, float dt)
{
    for (PowerUp& powerUp : game.PowerUps)
    {
        XMStoreFloat2(&powerUp.Position, XMLoadFloat2(&powerUp.Position) + XMLoadFloat2(&powerUp.Velocity) * dt);
        if (powerUp.Activated)
        {
            powerUp.Duration -= dt;

            if (powerUp.Duration <= 0.0f)
            {
                // remove powerup from list (will later be removed)
                powerUp.Activated = false;
                // deactivate effects
                if (powerUp.Type == "sticky")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "sticky"))
                    {   // only reset if no other PowerUp of type sticky is active
                        Ball.Sticky = false;
                        Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "pass-through")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "pass-through"))
                    {   // only reset if no other PowerUp of type pass-through is active
                        Ball.PassThrough = false;
                        Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
                    }
                }
                else if (powerUp.Type == "confuse")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "confuse"))
                    {   // only reset if no other PowerUp of type confuse is active
                        Effects.Confuse = false;
                    }
                }
                else if (powerUp.Type == "chaos")
                {
                    if (!IsOtherPowerUpActive(game.PowerUps, "chaos"))
                    {   // only reset if no other PowerUp of type chaos is active
                        Effects.Chaos = false;
                    }
                }
            }
        }
    }
    // Remove all PowerUps from vector that are destroyed AND !activated (thus either off the map or finished)
    // Note we use a lambda expression to remove each PowerUp which is destroyed and not activated
    game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(),
        [](const PowerUp& powerUp) { return powerUp.Destroyed && !powerUp.Activated; }
    ), game.PowerUps.end());
}
```

Positionen är ett DirectXMath-steg som överallt i spelet: ladda, räkna, lagra.
:::

Det kan hända att en annan power-up av samma typ fångas medan en power-ups effekt fortfarande är aktiv. Då har vektorn två
aktiva power-ups av den typen, och när den första tar slut vill vi inte slå av effekten än. Det är vad
`IsOtherPowerUpActive` kontrollerar: bara om ingen annan power-up av samma typ fortfarande är aktiv slås effekten av – så
effekten varar tills den sista av sin typ har tagit slut.

:::opengl
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::
:::vulkan
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type) {
    for (const PowerUp& powerUp : powerUps) {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::
:::d3d12
```cpp
bool IsOtherPowerUpActive(std::vector<PowerUp>& powerUps, std::string type)
{
    for (const PowerUp& powerUp : powerUps)
    {
        if (powerUp.Activated)
            if (powerUp.Type == type)
                return true;
    }
    return false;
}
```
:::

I slutet av `UpdatePowerUps` tas varje power-up som både är förstörd och inte aktiverad – den föll ut ur fönstret, eller
den fångades och har tagit slut – bort ur vektorn. learnopengl gör det med `std::remove_if` från `<algorithm>` och en
**lambda**, en namnlös funktion som skrivs där den behövs: `[](const PowerUp& powerUp) { return powerUp.Destroyed &&
!powerUp.Activated; }` tar en power-up och säger om den ska bort. `remove_if` flyttar alla element som ska behållas till
vektorns början, i sin ordning, och returnerar en iterator till första elementet efter dem; vektorns `erase` tar sedan
bort allt från den iteratorn till slutet. (`remove_if` ensam tar inte bort något – den kan inte ändra vektorns storlek;
paret kallas *erase-remove-idiomet*.)
:::vulkan
Vulkan-projektet inkluderar redan `<algorithm>`.
:::

Anropa den i `Update`, efter partiklarna:

```cpp
UpdatePowerUps(game, dt);
```

Gör nu uppgiften **update-powerups**. Tryck på **Build & run**: vid 1,5 s **har alla sex pillren fallit till mitten av
fönstret** (y = 385, 2,5 pixlar per bildruta), och raden ovanför stenarna är tom igen. Bollen flyger förbi dem; en
power-up reagerar bara på racketen. Vid 3,0 s har de fallit ut ur fönstret – men inget förstör dem än, så de finns kvar i
vektorn och ritas nedanför fönstret.

```quiz
`UpdatePowerUps` slutar med `game.PowerUps.erase(std::remove_if(game.PowerUps.begin(), game.PowerUps.end(), […](…) { … }), game.PowerUps.end());`. Vad gör `std::remove_if` ensam?
- [ ] Den tar bort de matchande elementen och gör vektorn kortare
- [ ] Den returnerar en ny vektor utan de matchande elementen
- [x] Den flyttar elementen som ska behållas till början, i sin ordning, och returnerar en iterator till första elementet efter dem; vektorns storlek ändras inte, och därför följer `erase`
- [ ] Den sätter de matchande elementens flagga `Destroyed`
---
En algoritm ser bara iteratorer, inte behållaren, så den kan inte ändra behållarens storlek. `erase` från den returnerade iteratorn till `end()` tar bort resterna.
```

```quiz
En power-up som fångas markeras som `Destroyed` och `Activated`. Varför tas den inte bort direkt?
- [x] Därför att dess varaktighet räknas ned i vektorn: först när den har tagit slut och `UpdatePowerUps` sätter `Activated` till false är den förstörd *och* inte aktiverad – och tas bort
- [ ] Därför att en fångad power-up fortfarande måste ritas under resten av sin varaktighet
- [ ] Därför att `std::remove_if` inte kan ta bort det sista elementet
- [ ] Därför att en förstörd power-up fortfarande kan kollidera med bollen
---
`Render` hoppar över förstörda power-ups, så en fångad är osynlig medan dess effekt varar. En med varaktigheten 0 tar slut i samma bildruta som den fångades.
```

## Aktivera power-upsen

För varje power-up som inte är förstörd kontrollerar `DoCollisions` nu, efter blocken, om den har nått fönstrets nederkant
eller kolliderat med racketen. I båda fallen förstörs den, men om den kolliderade med racketen aktiveras den också:

:::opengl d3d12
```cpp
// also check collisions on PowerUps and if so, activate them
for (PowerUp& powerUp : game.PowerUps)
{
    if (!powerUp.Destroyed)
    {
        // first check if powerup passed bottom edge, if so: keep as inactive and destroy
        if (powerUp.Position.y >= game.Height)
            powerUp.Destroyed = true;

        if (CheckCollision(Player, powerUp))
        {   // collided with player, now activate powerup
            ActivatePowerUp(powerUp);
            powerUp.Destroyed = true;
            powerUp.Activated = true;
        }
    }
}
```
:::
:::vulkan
```cpp
// also check collisions on PowerUps and if so, activate them
for (PowerUp& powerUp : game.PowerUps) {
    if (!powerUp.Destroyed) {
        // first check if powerup passed bottom edge, if so: keep as inactive and destroy
        if (powerUp.Position.y >= game.Height)
            powerUp.Destroyed = true;

        if (CheckCollision(Player, powerUp)) { // collided with player, now activate powerup
            ActivatePowerUp(powerUp);
            powerUp.Destroyed = true;
            powerUp.Activated = true;
        }
    }
}
```
:::

`CheckCollision(Player, powerUp)` är **AABB**-överlagringen från `collision-detection`: racketen och power-upen är båda
vanliga spelobjekt (en `PowerUp` är ett `GameObject`), så överlagringen för två lådor väljs – den andra tar bollen först.
Att aktivera en power-up är `ActivatePowerUp`s jobb: den kontrollerar typen och ändrar spelets tillstånd. För effekterna
sticky och pass-through ändrar den också racketens och bollens färg, för att ge spelaren återkoppling om vilken effekt som
är aktiv just nu:

:::opengl
```cpp
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        Ball.Velocity *= 1.2f;
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = glm::vec3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = glm::vec3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```
:::
:::vulkan
```cpp
void ActivatePowerUp(PowerUp& powerUp) {
    if (powerUp.Type == "speed") {
        Ball.Velocity *= 1.2f;
    } else if (powerUp.Type == "sticky") {
        Ball.Sticky = true;
        Player.Color = glm::vec3(1.0f, 0.5f, 1.0f);
    } else if (powerUp.Type == "pass-through") {
        Ball.PassThrough = true;
        Ball.Color = glm::vec3(1.0f, 0.5f, 0.5f);
    } else if (powerUp.Type == "pad-size-increase") {
        Player.Size.x += 50;
    } else if (powerUp.Type == "confuse") {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    } else if (powerUp.Type == "chaos") {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```

Inget nytt för Vulkan här: en fångad confuse-power-up sätter bara `Effects.Confuse`, som nästa bildrutas
`Render(Effects, …)` skickar som push constant till efterbehandlingsshadern.
:::
:::d3d12
```cpp
void ActivatePowerUp(PowerUp& powerUp)
{
    if (powerUp.Type == "speed")
    {
        XMStoreFloat2(&Ball.Velocity, XMLoadFloat2(&Ball.Velocity) * 1.2f);
    }
    else if (powerUp.Type == "sticky")
    {
        Ball.Sticky = true;
        Player.Color = XMFLOAT3(1.0f, 0.5f, 1.0f);
    }
    else if (powerUp.Type == "pass-through")
    {
        Ball.PassThrough = true;
        Ball.Color = XMFLOAT3(1.0f, 0.5f, 0.5f);
    }
    else if (powerUp.Type == "pad-size-increase")
    {
        Player.Size.x += 50;
    }
    else if (powerUp.Type == "confuse")
    {
        if (!Effects.Chaos)
            Effects.Confuse = true; // only activate if chaos wasn't already active
    }
    else if (powerUp.Type == "chaos")
    {
        if (!Effects.Confuse)
            Effects.Chaos = true;
    }
}
```

Fart-power-upen är learnopengls `Ball->Velocity *= 1.2` som ett DirectXMath-steg. En fångad confuse-power-up sätter bara
`Effects.Confuse`, som nästa bildrutas `Render(Effects, …)` ger efterbehandlingsshadern som root constant.
:::

Confuse slås bara på om chaos inte är aktivt, och tvärtom: de två bör inte vara på samtidigt.

Gör nu uppgiften **activate**. Vid 1,5 s har inget ändrats. Vid 3,0 s: **den förvirrade bilden – upp och ned,
spegelvänd, inverterad – med en racket på 150 pixlar upptill.** Så här gick det till. Bollen tappades i bildruta 151 och
lades tillbaka på racketen mitt i fönstret (x 350…450). I bildruta 161 når de fallande pillren racketens överkant;
pad-size-increase-pillret (x 370…430) överlappar racketen och fångas först – loopen kommer till det före
confuse-pillret – och racketen växer till 150 pixlar (x 350…500). I samma loop överlappar nu confuse-pillret (x 480…540)
den bredare racketen och fångas också: **skärmen är förvirrad** i 15 sekunder. De andra fyra pillren missar racketen,
faller ut ur fönstret, förstörs i bildruta 177 och tas bort. Pad-size-pillret, med varaktigheten 0, tar slut i samma
bildrutas `UpdatePowerUps` och tas bort; confuse-pillret stannar i vektorn, aktivt, tills dess 15 sekunder är slut.

```quiz
Confuse-pillret ligger vid x = 480…540, utanför den vanliga racketen (350…450). Varför fångas det ändå i bildruta 161?
- [ ] Därför att en power-up fångas när den kommer inom 50 pixlar från racketen
- [ ] Därför att confuse-effekten speglar racketen till andra sidan
- [x] Därför att loopen kontrollerar power-upsen i sin ordning: pad-size-increase-pillret kommer först, gör racketen bredare till 350…500, och när loopen når confuse-pillret överlappar den bredare racketen det
- [ ] Därför att confuse har chansen 1 på 15 och hade tur
---
`ActivatePowerUp` ändrar `Player.Size` direkt, inne i loopen. Om confuse-pillret hade kommit först i vektorn hade det missats i den bildrutan – och fångats i nästa, medan det fortfarande överlappar racketens överkant.
```

## Skapa power-ups

Varje gång ett block förstörs vill vi, med en liten chans, skapa en power-up. learnopengls `ShouldSpawn` returnerar sant
med chansen 1 på `chance`, och `SpawnPowerUps` ger varje sort sin egen chans: 1 på 75 för de positiva, 1 på 15 för de
negativa, som ska dyka upp oftare. En ny power-up börjar på det förstörda blockets position:

:::opengl
```cpp
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}
```
:::
:::vulkan
```cpp
bool ShouldSpawn(unsigned int chance) {
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block) {
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", glm::vec3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", glm::vec3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", glm::vec3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").DescriptorSet));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", glm::vec3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").DescriptorSet));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", glm::vec3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").DescriptorSet));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", glm::vec3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").DescriptorSet));
}
```
:::
:::d3d12
```cpp
bool ShouldSpawn(unsigned int chance)
{
    unsigned int random = rand() % chance;
    return random == 0;
}

void SpawnPowerUps(Game& game, GameObject& block)
{
    if (ShouldSpawn(75)) // 1 in 75 chance
        game.PowerUps.push_back(MakePowerUp("speed", XMFLOAT3(0.5f, 0.5f, 1.0f), 0.0f, block.Position, GetTexture("powerup_speed").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("sticky", XMFLOAT3(1.0f, 0.5f, 1.0f), 20.0f, block.Position, GetTexture("powerup_sticky").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pass-through", XMFLOAT3(0.5f, 1.0f, 0.5f), 10.0f, block.Position, GetTexture("powerup_pass").ID));
    if (ShouldSpawn(75))
        game.PowerUps.push_back(MakePowerUp("pad-size-increase", XMFLOAT3(1.0f, 0.6f, 0.4f), 0.0f, block.Position, GetTexture("powerup_increase").ID));
    if (ShouldSpawn(15)) // Negative powerups should spawn more often
        game.PowerUps.push_back(MakePowerUp("confuse", XMFLOAT3(1.0f, 0.3f, 0.3f), 15.0f, block.Position, GetTexture("powerup_confuse").ID));
    if (ShouldSpawn(15))
        game.PowerUps.push_back(MakePowerUp("chaos", XMFLOAT3(0.9f, 0.25f, 0.25f), 15.0f, block.Position, GetTexture("powerup_chaos").ID));
}
```
:::

`DoCollisions` anropar den direkt efter att ett block har förstörts – `if`-satsen behöver nu klamrar runt sina två
satser:

:::opengl d3d12
```cpp
if (!box.IsSolid)
{
    box.Destroyed = true;
    SpawnPowerUps(game, box);
}
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::
:::vulkan
```cpp
if (!box.IsSolid) {
    box.Destroyed = true;
    SpawnPowerUps(game, box);
} else { // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::

`rand()` är C-bibliotekets: utan `srand` får varje körning samma följd, som partiklarna.
:::d3d12
På Windows får ett Direct3D 12-program MSVC:s `rand()`, en annan följd (med `RAND_MAX` 32767) än glibc:s, som kursens
bilder mättes med: i ett riktigt spel skulle andra power-ups skapas. Kursens bilder beror inte på det – med de fasta
indata körs `SpawnPowerUps` aldrig.
:::

Gör nu uppgiften **spawn-powerups**. Inget block förstörs, så inget skapas och `rand()` anropas inte ens – partiklarnas
slumptal förblir som de var: **ingen synlig förändring**.

## Sticky och pass-through

Effekterna sticky och pass-through behöver två små ändringar i `DoCollisions`. Sticky: i slutet av studsen mot racketen
blir bollens `Stuck` dess `Sticky` – om sticky-effekten är aktiv fastnar bollen på racketen varje gång den landar där,
och spelaren måste trycka på mellanslag igen för att släppa den:

```cpp
Ball.Stuck = Ball.Sticky;
```

Pass-through: när bollens `PassThrough` är satt gör vi ingen kollisionshantering för block som inte är solida – de
förstörs, men bollen flyger vidare:

:::opengl d3d12
```cpp
if (!(Ball.PassThrough && !box.IsSolid)) // don't do collision resolution on non-solid bricks if pass-through is activated
```
:::
:::vulkan
```cpp
if (!(Ball.PassThrough && !box.IsSolid)) { // don't do collision resolution on non-solid bricks if pass-through is activated
```
:::

Och `ResetPlayer` – en tappad boll – slår av alla power-up-effekter igen:

:::opengl vulkan
```cpp
// also disable all active powerups
Effects.Chaos = Effects.Confuse = false;
Ball.PassThrough = Ball.Sticky = false;
Player.Color = glm::vec3(1.0f);
Ball.Color = glm::vec3(1.0f);
```
:::
:::d3d12
```cpp
// also disable all active powerups
Effects.Chaos = Effects.Confuse = false;
Ball.PassThrough = Ball.Sticky = false;
Player.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
Ball.Color = XMFLOAT3(1.0f, 1.0f, 1.0f);
```
:::

Gör nu uppgiften **sticky-pass**. Bollen återställs i bildruta 151, innan pillren fångas i bildruta 161, och den möter
aldrig något block den skulle kunna gå igenom eller någon racket den skulle kunna fastna på: **ingen synlig förändring**
– bilden vid 3,0 s förblir förvirrad. Sätter vi ihop allt detta har vi ett fungerande power-up-system som inte bara gör
spelet roligare, utan också mycket mer utmanande.

```quiz
Power-upsen speed och pad-size-increase har varaktigheten 0. Vad betyder det?
- [ ] Att de aldrig aktiveras
- [ ] Att deras effekt varar tills banan återställs
- [ ] Att deras effekt varar exakt en bildruta
- [x] Att deras effekt är permanent: power-upen tar slut i den bildruta den fångas, men `UpdatePowerUps` har inget att slå av för de här två typerna – bara `ResetPlayer` ger racketen dess storlek tillbaka
---
`UpdatePowerUps` återställer bara sticky, pass-through, confuse och chaos. `ResetPlayer` ger racketen dess `PLAYER_SIZE` och bollen dess ursprungliga hastighet igen.
```

:::opengl
```quiz
`DoCollisions` anropar `CheckCollision(Player, powerUp)`. Vilken överlagring är det, och varför?
- [ ] Cirkelöverlagringen, eftersom power-upen är rund i ändarna
- [x] AABB-överlagringen `CheckCollision(GameObject&, GameObject&)`: racketen är ett `GameObject` och en `PowerUp` är också ett, medan cirkelöverlagringen tar en `BallObject&` först
- [ ] Ingen av dem: en power-up har en egen kollisionsfunktion
- [ ] Cirkelöverlagringen, eftersom `PowerUp` ärver från `BallObject`
---
C++ väljer överlagring efter argumentens typer. En `PowerUp&` kan omvandlas till `GameObject&` (sin basklass), inte till `BallObject&`.
```
:::
:::vulkan
```quiz
Vad behöver Vulkan-projektet för power-upsen utöver learnopengls C++?
- [ ] En ny pipeline för power-upsen
- [ ] Ett andra render pass, eftersom power-upsen faller framför blocken
- [x] Inget i Vulkan-koden: en power-up är en sprite till som ritas med `DrawObject` i passet utanför skärmen, och en fångad confuse-power-up sätter bara `Effects.Confuse`, som skickas till efterbehandlingsshadern nästa bildruta – de sex texturerna tar bara sex descriptor sets till ur poolen
- [ ] En storage buffer med alla power-ups
---
Det är fördelen med att bygga spelet på sprite-renderaren och efterbehandlaren: spelets logik rör inte API:et.
```
:::
:::d3d12
```quiz
Vad behöver Direct3D 12-projektet för power-upsen utöver learnopengls C++?
- [ ] En ny pipeline state för power-upsen
- [ ] En andra command list, eftersom power-upsen faller framför blocken
- [x] Inget i Direct3D-koden: en power-up är en sprite till som ritas med `DrawObject` i det multisamplade målet, och en fångad confuse-power-up sätter bara `Effects.Confuse`; de sex texturerna tar platserna 7 till 12 i heapen, och efterbehandlarens textur flyttar till plats 13
- [ ] En structured buffer med alla power-ups
---
Det är fördelen med att bygga spelet på sprite-renderaren och efterbehandlaren: spelets logik rör inte API:et.
```
:::

## Mer att läsa

- [Powerups](https://learnopengl.com/In-Practice/2D-Game/Powerups): learnopengls kapitel som det här kapitlet följer.
- [std::remove_if](https://en.cppreference.com/w/cpp/algorithm/remove) och
  [lambdauttryck](https://en.cppreference.com/w/cpp/language/lambda): erase-remove-idiomet och predikatet.
