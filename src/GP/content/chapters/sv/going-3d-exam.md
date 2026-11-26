# Prov: Till 3D

Visa vad du har lärt dig i *Till 3D*: vektorer, matriser och vinklar, transformationer, koordinatsystem och kameran.
Frågorna täcker hela delen, och några gäller {{api}} särskilt. Svara på alla och tryck på **Lämna in svaren**; du
behöver 80 % rätt för att bli godkänd, och du kan göra provet igen.

```quiz
Ett helt varv är 360°. Hur många radianer är 90°?
- [ ] 90
- [ ] π
- [x] π / 2, ungefär 1,571
- [ ] 2π
---
360° är 2π radianer, så 90° – ett kvarts varv – är 2π / 4 = π / 2. Matematikbibliotekens rotate- och perspective-funktioner vill ha radianer.
```

```quiz
**a** och **b** är enhetsvektorer, och **a** · **b** = 0. Vad säger det dig?
- [ ] De pekar åt samma håll
- [ ] De pekar åt motsatta håll
- [ ] En av dem måste vara nollvektorn
- [x] De är vinkelräta mot varandra
---
För enhetsvektorer är skalärprodukten cosinus för vinkeln mellan dem. cos θ = 0 betyder θ = 90°. Samma riktning ger 1, motsatta riktningar −1.
```

```quiz
Vad är kryssprodukten av x-axeln (1, 0, 0) och y-axeln (0, 1, 0)?
- [x] (0, 0, 1), z-axeln: en vektor som är vinkelrät mot båda
- [ ] 0, eftersom axlarna är vinkelräta
- [ ] (1, 1, 0), summan av de två
- [ ] (0, 0, −1), eftersom kryssprodukten alltid pekar bort från dig
---
Kryssprodukten ger en vektor som är vinkelrät mot båda. I ett högerhänt system är x × y = z; kamerakapitlet använder det för att bygga sina höger- och uppåtaxlar. Ett enda tal är vad skalärprodukten ger.
```

```quiz
En 4 × 4-matris multipliceras med vektorn (x, y, z, 1). Hur räknas resultatets första komponent ut?
- [ ] Som produkten av alla tal i matrisens första kolumn
- [x] Som skalärprodukten av matrisens första rad och vektorn
- [ ] Som matrisens första tal gånger x
- [ ] Som summan av vektorns komponenter gånger matrisens första tal
---
Varje komponent i M · v är en rad i M "skalärmultiplicerad" med v. Med enhetsmatrisen plockar varje rad ut en komponent, så vektorn kommer tillbaka oförändrad.
```

```quiz
Med kolumnvektorer (som i läroboken och GLM) vill du att varje vertex först skalas, sedan roteras och sist flyttas. Vilken matris använder du?
- [ ] `S · R · T`
- [x] `T · R · S`
- [ ] Vilken som helst: ordningen i matrismultiplikation spelar ingen roll
- [ ] `R · T · S`
---
Med kolumnvektorer tillämpas matrisen närmast vektorn – den längst till höger – först: `T · R · S · v` skalar, roterar och flyttar sedan. Matrismultiplikation är inte kommutativ, så ordningen spelar roll.
```

:::opengl
```quiz
Tio kuber ritas genom att `model`-uniformen sätts och `glDrawArrays` anropas, tio gånger per bildruta. Varför får varje kub sin egen matris?
- [ ] Det gör den inte: alla tio kuberna får den sista matrisen som sattes
- [ ] Varje anrop till `setMat4` skapar en ny uniform med samma namn
- [x] Varje draw-anrop använder de uniform-värden som programmet har i det ögonblick anropet görs
- [ ] OpenGL behåller en egen kopia av varje uniform för varje draw-anrop fram till `glfwSwapBuffers`
---
En uniform behåller sitt värde tills du ändrar det, och OpenGL ser till att varje draw-anrop använder de värden som gäller när det görs. Därför räcker det att sätta model-matrisen före varje draw-anrop.
```
:::
:::vulkan
```quiz
Tio kuber ritas per bildruta. Varför är varje kubs model-matris en push constant, medan view och projection ligger i uniform buffern?
- [ ] Uniform buffers kan bara hålla två matriser
- [ ] Push constants läses bara av vertex shadern, uniform buffers bara av fragment shadern
- [ ] Push constants behålls till nästa bildruta, uniform buffers bara till nästa draw-anrop
- [x] Push constants spelas in i command buffern per draw-anrop; uniform bufferns innehåll läses först när GPU:n kör kommandona, så tio matriser skrivna i den skulle alla bli den sista
---
`vkCmdPushConstants` kopierar byten in i command buffern, så varje draw-anrop ser de värden som pushats före det. En descriptor pekar bara på bufferten; det den innehåller när GPU:n kör kommandona är vad varje draw-anrop i bildrutan ser – rätt för view och projection, fel för model-matrisen.
```
:::
:::d3d12
```quiz
Tio kuber ritas per bildruta. Varför ligger varje kubs model-matris i root constants, medan view och projection ligger i constant buffern?
- [ ] En constant buffer kan bara hålla två matriser
- [ ] Root constants behålls till nästa bildruta, constant buffers bara till nästa draw-anrop
- [ ] Root constants läses bara av vertex shadern, constant buffers bara av pixel shadern
- [x] Root constants spelas in i command listen per draw-anrop; constant bufferns innehåll läses först när GPU:n kör kommandona, så tio matriser skrivna i den skulle alla bli den sista
---
`SetGraphicsRoot32BitConstants` spelar in värdena i command listen, så varje draw-anrop ser de värden som satts före det. CBV:n pekar bara på bufferten; det den innehåller när GPU:n kör kommandona är vad varje draw-anrop i bildrutan ser – rätt för view och projection, fel för model-matrisen.
```
:::

:::opengl
```quiz
Projektionen görs med `glm::perspective(45.0f, 800.0f / 600.0f, 0.1f, 100.0f);` – utan `glm::radians`. Vad händer?
- [ ] Ingenting: `glm::perspective` tar grader
- [ ] GLM räknar om 45 till radianer av sig själv, med en varning
- [ ] Det nära och det bortre planet byter plats
- [x] Synfältet blir 45 radianer – många hela varv – i stället för 45°, och scenen ser helt fel ut
---
GLM:s funktioner tar vinklar i radianer. 45 radianer är ungefär 2578°, så projektionens synfält blir nonsens; `glm::radians(45.0f)` är ungefär 0,785.
```
:::
:::vulkan
```quiz
Varför multiplicerar projektet `proj[1][1]` med -1 efter `glm::perspective`?
- [ ] Eftersom Vulkans texturkoordinater börjar längst upp i bilden
- [ ] För att avbilda djupet från -1..1 till 0..1
- [x] GLM skrevs för OpenGL, där y pekar uppåt i klipprummet; i Vulkan pekar det nedåt, så y-skalan vänds för att +y ska hamna överst i fönstret
- [ ] Eftersom swap chainen lagrar sina bilder med den nedersta raden först
---
Utan vändningen skulle hela scenen stå upp och ned. Djupintervallet är en annan skillnad, som `GLM_FORCE_DEPTH_ZERO_TO_ONE` tar hand om.
```
:::
:::d3d12
```quiz
Projektionen görs med `XMMatrixPerspectiveFovRH`. Vad händer om du bygger vymatrisen med `XMMatrixLookAtLH` i stället för `XMMatrixLookAtRH`?
- [x] LH-vymatrisen får kameran att titta längs +z, men RH-projektionen förväntar sig att den tittar längs -z, så scenen hamnar bakom kameran
- [ ] Ingenting: LH och RH skiljer sig bara i hur de lagrar matrisen
- [ ] Bilden blir spegelvänd i sidled men är annars rätt
- [ ] Djupintervallet ändras från 0..1 till -1..1
---
Vymatrisen och projektionen måste vara överens om vyrummet. Kursen använder de högerhänta funktionerna överallt, som har samma vyrum som GLM och OpenGL.
```
:::

:::opengl
```quiz
Transformationen skickas med `glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));`. Varför är det tredje argumentet `GL_FALSE`?
- [ ] Det betyder att uniformen bara sätts en gång, inte varje bildruta
- [ ] Det betyder att matrisen inte är normaliserad, vilket är rätt för transformationer
- [ ] GLM-matriser är radvisa, och OpenGL transponerar dem på egen hand
- [x] Det betyder "transponera inte": GLM lagrar sina matriser kolumn för kolumn, vilket är den ordning OpenGL förväntar sig
---
Argumentet ber OpenGL att transponera matrisen när den läses. GLM:s minneslayout stämmer redan med OpenGL:s kolumnvisa konvention, så ingen transponering behövs.
```
:::
:::vulkan
```quiz
`struct PushConstants { glm::mat4 model; };` kopieras byte för byte till shaderns `mat4 model`, utan transponering. Varför är det rätt?
- [ ] Det är inte rätt, men transformationer ser likadana ut i båda fallen
- [ ] Push constants kan bara hålla symmetriska matriser
- [ ] `vkCmdPushConstants` transponerar varje matris den kopierar
- [x] GLM lagrar en `mat4` kolumn för kolumn, och det är också så GLSL lägger ut en `mat4`
---
Båda sidorna lagrar kolumnvis, så byten betyder samma matris på CPU:n och på GPU:n. (En transponerad rotation skulle vrida åt andra hållet, så det spelar roll.)
```
:::
:::d3d12
```quiz
Innan en matris lagras i konstanterna anropar projektet `XMMatrixTranspose`, och shadern beräknar `mul(position, transform)`. Varför transponeringen?
- [x] `XMFLOAT4X4` lagrar rad för rad, medan HLSL som standard läser en matris i en constant buffer kolumn för kolumn; transponeringen gör att shadern ser samma matris
- [ ] `mul` i HLSL fungerar bara med transponerade matriser
- [ ] DirectXMath-matriser är fel och måste alltid rättas
- [ ] Root constants lagras i omvänd ordning
---
Radvis lagring plus kolumnvis packning skulle ge shadern den transponerade matrisen. Att lagra transponatet tar ut det, och `mul` med vektorn först beräknar v · M, precis som DirectXMath på CPU:n.
```
:::

```quiz
Vad gör att objekt längre bort ser mindre ut med en perspektivprojektion?
- [ ] Rasteriseraren ritar avlägsna trianglar med färre fragment
- [ ] Vymatrisen skalar varje objekt med dess avstånd från kameran
- [x] Projektionsmatrisen lägger avståndet i w, och perspektivdivisionen delar x och y med det
- [ ] Djuptestet krymper fragment som ligger längre bort
---
Efter projektionen växer w med avståndet från kameran. Divisionen med w i slutet av vertexsteget drar punkter långt bort närmare mitten: perspektiv.
```

```quiz
Djuptestningen är på, men programmet glömmer att rensa djupbufferten i början av varje bildruta. Vad händer?
- [x] Fragmenten testas mot djupvärden som finns kvar från tidigare bildrutor, så många klarar inte testet och delar av scenen försvinner
- [ ] Bara det första objektet i varje bildruta ritas
- [ ] Scenen ritas utan djuptestning
- [ ] Ingenting ändras: varje fragment skriver ändå över djupbufferten
---
Rensningen sätter varje djup till 1,0, fjärrplanet, så att det första fragmentet på en pixel alltid klarar testet. Utan den döljer de gamla värdena den här bildrutans fragment överallt där de inte ligger närmare än förut.
```

```quiz
Kamerakoden håller pitch mellan -89° och 89°. Varför inte tillåta 90°?
- [ ] Eftersom projektionsmatrisen bara klarar vinklar under 90°
- [ ] Så att musen inte kan vrida kameran mer än 89° per bildruta
- [x] Vid 90° är tittriktningen parallell med världens uppåtvektor, så kryssprodukten för högervektorn blir noll och vyn slår runt
- [ ] Eftersom `sin` och `cos` inte är definierade vid 90°
---
LookAt-matrisen beräknar kamerans högeraxel som kryssprodukten av riktningen och världens uppåtvektor. När de två är parallella blir produkten noll och kamerans orientering är inte längre definierad.
```

```quiz
Varför multipliceras kamerans hastighet med `deltaTime`, tiden som den förra bildrutan tog?
- [x] Så att kameran rör sig lika fort på snabba och långsamma datorer, hur många bildrutor per sekund de än ritar
- [ ] Så att kameran stannar när fönstret tappar fokus
- [ ] Så att rörelsen går fortare ju längre en tangent hålls nere
- [ ] Eftersom vymatrisen förväntar sig avstånd i sekunder
---
Utan den flyttar sig kameran en fast sträcka per bildruta, så en dator som ritar dubbelt så många bildrutor rör sig dubbelt så fort. Hastighet gånger bildrutans tid ger en sträcka per sekund.
```

```quiz
Mushjulet ändrar `fov`, projektionsmatrisens synfält. Vad ser du när `fov` går från 45° till 20°?
- [x] Scenen ser större ut: du zoomar in
- [ ] Scenen ser mindre ut: du zoomar ut
- [ ] Objekt nära kameran klipps bort
- [ ] Kameran flyttar sig framåt längs sin riktning
---
Ett mindre synfält får plats med en mindre del av scenen i samma fönster, så allt i den ser större ut. Själva kameran flyttar sig inte.
```
