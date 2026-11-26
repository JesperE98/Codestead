# Matematiken bakom 3D

Hittills har allt vi ritat varit platt och stilla: en triangel och en texturerad rektangel, med hörnen skrivna rakt
in i vertexbufferten som normaliserade enhetskoordinater (NDC). I den här delen av kursen går vi över till 3D. I
*Transformationer* skalar, roterar och flyttar vi lådan; i *Koordinatsystem* placerar vi den i en 3D-värld och tittar
på den genom en perspektivprojektion; och i *Kamera* flyger vi genom världen med tangentbordet och musen. Alla tre
kapitlen bygger på samma lilla verktygslåda av matematik, och det här kapitlet öppnar verktygslådan innan vi behöver
den, så att de följande kapitlen kan ägna sig åt grafiken.

Oroa dig inte om din matematik är ringrostig – vi börjar från början, och varje idé kommer med tal som du kan
kontrollera för hand. Det här går vi igenom, och här möter du det igen:

| Matematik | Används till |
|---|---|
| Axlar och högerhänthet | Åt vilket håll x, y och z pekar – i varje kapitel från och med nu |
| Grader och radianer | Varje rotationsfunktion, synfältet, kamerans vinklar |
| Sinus och cosinus | Rotationsmatriser, en kamera som cirklar runt scenen, yaw och pitch, animationer över tid |
| Vektorer, skalär- och kryssprodukt | Positioner, riktningar, kamerans axlar och senare all belysning |
| Matriser | Transformationer, och model-, view- och projektionsmatriserna |

Allt i det här kapitlet är detsamma för alla tre API:erna, och det finns ingen kod att skriva: programmet från
*Texturer* får vara som det är. I stället finns det frågor längs vägen där du kan testa dig själv. Ha penna och papper
till hands – att räkna några av exemplen för hand är det snabbaste sättet att bli bekväm med dem.

## Koordinater och axlar

En position är bara en lista med tal, ett per *axel*. I 2D finns två axlar, x och y, som korsar varandra i *origo*
(0, 0); punkten (3, 2) ligger 3 steg längs x och 2 steg längs y. Matematiken i kursen använder de vanliga
matematiska riktningarna: **x åt höger och y uppåt**. Du har redan använt sådana axlar för de normaliserade
enhetskoordinaterna i *Hello Triangle*: fönstret går från −1 till 1 på båda axlarna, med (0, 0) i mitten.
:::opengl d3d12
Även där är +x åt höger och +y uppåt.
:::
:::vulkan
En detalj skiljer sig i Vulkan: där pekar +y **nedåt** i de normaliserade enhetskoordinaterna, så en vertex med
negativt y hamnar i fönstrets övre halva. Från och med nästa kapitel räknar vi all matematik med y uppåt, som
learnopengl, och vänder y en gång allra sist – *Transformationer* visar hur.
:::

### Tre axlar

I 3D behöver vi en tredje axel, z, i rät vinkel mot både x och y. Med x åt höger och y uppåt kan den peka åt två
håll: ut ur skärmen mot dig, eller in i skärmen bort från dig. De två valen kallas ett *högerhänt* och ett
*vänsterhänt* koordinatsystem, och de är varandras spegelbilder – det går inte att vrida det ena så att det blir det
andra.

Namnen kommer från händerna. Håll upp högerhanden, låt tummen peka åt höger (+x) och pekfingret uppåt (+y), och böj
sedan långfingret så att det pekar rakt ut från handflatan: det pekar mot dig. Det är +z i ett högerhänt system. Gör
likadant med vänsterhanden, så pekar långfingret bort från dig, in i skärmen: det är ett vänsterhänt system.

Kursen använder ett **högerhänt** system i alla API:er, OpenGL:s och learnopengls konvention: +x åt höger, +y uppåt och
+z ut ur skärmen mot dig. Saker som är längre bort från dig har därför *mindre* (mer negativa) z-värden, och en kamera
tittar längs den **negativa** z-axeln – kom ihåg det, det kommer tillbaka i *Koordinatsystem* och *Kamera*.

:::opengl vulkan
GLM, matematikbiblioteket som du använder från och med nästa kapitel, är högerhänt som standard, så det stämmer med
konventionen utan några inställningar.
:::
:::d3d12
DirectXMath, matematikbiblioteket som du använder från och med nästa kapitel, har båda sorternas funktioner: `…RH`
för högerhänt och `…LH` för vänsterhänt (den klassiska DirectX-konventionen). Kursen väljer alltid `…RH`-funktionerna,
så att alla learnopengls positioner och rotationer fungerar oförändrade.
:::

```quiz
I ett högerhänt koordinatsystem pekar +x åt höger och +y uppåt. Åt vilket håll pekar +z?
- [ ] In i skärmen, bort från dig
- [x] Ut ur skärmen, mot dig
- [ ] Nedåt, motsatt +y
- [ ] Det beror på fönstrets storlek
---
Tummen åt höger (+x), pekfingret uppåt (+y): högerhandens långfinger pekar ut ur skärmen, mot dig. In i skärmen vore ett vänsterhänt system. Fönstrets storlek har inget med axlarnas riktning att göra.
```

![Ett högerhänt och ett vänsterhänt koordinatsystem](images/handedness.webp "Med x åt höger och y uppåt pekar +z ut ur skärmen i ett högerhänt system och in i den i ett vänsterhänt. Kursen använder det högerhänta i alla tre API:erna.")

## Vinklar: grader och radianer

Rotationer, en kameras synfält och kamerans riktning anges alla som *vinklar*. Du känner förmodligen till vinklar i
**grader**, där ett helt varv är 360°: ett kvarts varv är 90°, ett halvt varv 180°.

Datorer föredrar **radianer**. Rita en cirkel med radien 1 runt origo och gå längs dess kant: vinkeln i radianer är
helt enkelt sträckan du har gått. Hela omkretsen av den cirkeln är 2π ≈ 6,283, så ett helt varv är 2π radianer, ett
halvt varv π ≈ 3,142 och ett kvarts varv π/2 ≈ 1,571. En radian är lite mer än 57°. Att räkna om mellan dem är bara
en multiplikation:

```text
vinkel i radianer = vinkel i grader · (π / 180)
vinkel i grader   = vinkel i radianer · (180 / π)
```

Alltså är 45° lika med 45 · π / 180 = π/4 ≈ 0,785 radianer, och 1 radian är 180 / π ≈ 57,3°.

Vinklar har också en riktning. I matematiken – och i kursen – vrider en **positiv** vinkel **moturs**: från +x mot
+y, så som du ser det när du tittar på xy-planet med +z riktad mot dig. En negativ vinkel vrider medurs.

Sinus- och cosinusfunktionerna i C++ (`std::sin`, `std::cos`) och i {{shaderLanguage}} (`sin`, `cos`) vill alla ha
radianer. Människor tycker att grader är lättare att läsa, så program brukar spara sina vinklar i grader och räkna om
dem precis innan de används.
:::opengl vulkan
Med GLM görs det med `glm::radians(90.0f)`, som ger π/2.
:::
:::d3d12
Med DirectXMath görs det med `XMConvertToRadians(90.0f)`, som ger π/2.
:::
Att glömma att räkna om är en av de klassiska buggarna: en vinkel på 90 som används som radianer är ungefär 14,3 hela
varv, och hamnar på ett helt annat ställe än det kvarts varv du ville ha.

```quiz
Ett program använder tiden i sekunder direkt som en vinkel i radianer för att rotera ett objekt. Hur lång tid tar ett helt varv?
- [ ] 1 sekund
- [ ] 360 sekunder
- [x] Ungefär 6,28 sekunder
- [ ] Ungefär 3,14 sekunder
---
Ett helt varv är 2π ≈ 6,28 radianer, så det tar ungefär 6,28 sekunder när vinkeln växer med en radian per sekund. 360 sekunder vore svaret om tiden användes som grader; 3,14 sekunder är bara ett halvt varv.
```

## Sinus och cosinus: enhetscirkeln

*Enhetscirkeln* är cirkeln med radien 1 runt origo. Börja i punkten (1, 0) på dess högra sida och gå moturs längs den
en vinkel θ (den grekiska bokstaven theta). Punkten där du hamnar har två koordinater, och de har namn: dess
x-koordinat är **cosinus** för θ och dess y-koordinat är **sinus** för θ.

```text
punkten på enhetscirkeln vid vinkeln θ = (cos θ, sin θ)
```

Mer än så är inte sinus och cosinus. Med den bilden i huvudet kan du läsa av deras värden för kvartsvarven utan
miniräknare:

| Vinkel | Radianer | cos θ | sin θ | Punkten |
|---|---|---|---|---|
| 0° | 0 | 1 | 0 | (1, 0), höger |
| 60° | π/3 ≈ 1,047 | 0,5 | ≈ 0,866 | uppåt till höger |
| 90° | π/2 ≈ 1,571 | 0 | 1 | (0, 1), överst |
| 180° | π ≈ 3,142 | −1 | 0 | (−1, 0), vänster |
| 270° | 3π/2 ≈ 4,712 | 0 | −1 | (0, −1), nederst |
| 360° | 2π ≈ 6,283 | 1 | 0 | tillbaka vid start |

Några saker följer direkt av cirkeln:

- Båda värdena ligger alltid mellan −1 och 1, eftersom cirkeln har radien 1.
- cos² θ + sin² θ = 1 för varje vinkel: punkten ligger på avståndet 1 från origo, och det är Pythagoras sats, som vi
  snart möter igen för en vektors längd.
- Att gå ett varv till ändrar ingenting: θ + 2π ger samma punkt som θ.
- Negativa vinklar går medurs: cos(−θ) = cos θ och sin(−θ) = −sin θ. Till exempel hamnar −90° längst ner, i (0, −1).

För en cirkel med radien r i stället för 1 multiplicerar du båda koordinaterna med r: punkten är (r · cos θ, r · sin θ).

```quiz
En punkt börjar i (1, 0) på enhetscirkeln och vrids −90°. Var hamnar den?
- [ ] (0, 1)
- [ ] (−1, 0)
- [ ] (1, 0)
- [x] (0, −1)
---
En negativ vinkel vrider medurs, så ett kvarts varv från högra sidan hamnar längst ner: (cos(−90°), sin(−90°)) = (0, −1). (0, 1) är där +90° skulle hamna, (−1, 0) efter ett halvt varv.
```

![Enhetscirkeln, och sinus och cosinus över ett helt varv](images/unit-circle.webp "Till vänster: punkten vid vinkeln θ på enhetscirkeln är (cos θ, sin θ) – cos längs x, sin längs y. Till höger: sin t och cos t över ett helt varv, från 0 till 2π, med samma θ markerad; båda upprepas efter 2π.")

### Här dyker sinus och cosinus upp

Du kommer att möta de här två funktionerna genom hela den här delen av kursen:

- **Animation över tid.** Om t är tiden i sekunder svänger sin t mjukt mellan −1 och 1 och upprepas var
  2π ≈ 6,28:e sekund. Det har du redan använt i *Shaders*: `sin(time) / 2.0 + 0.5` trycker ihop svängningen till
  intervallet 0 till 1, ett användbart färgvärde, och fick triangeln att pulsera i grönt.
- **Rotationsmatriser.** En rotation byggs av cosinus och sinus för sin vinkel, som du ser i slutet av det här
  kapitlet och i *Transformationer*.
- **Rörelse i en cirkel.** I *Kamera* cirklar kameran runt scenen med radien r: dess position är (r · sin t, r · cos t)
  i xz-planet – en punkt på en cirkel med radien r, vid en vinkel som växer med tiden.
- **Riktningar från vinklar.** Också i *Kamera* räknas riktningen som kameran tittar åt ut från två vinklar, yaw och
  pitch, med precis samma idé om en punkt på en cirkel: cos för den ena koordinaten, sin för den andra.

```quiz
`sin(time) / 2.0 + 0.5` används som färgvärde medan programmet kör. Mellan vilka värden svänger det?
- [x] Mellan 0 och 1
- [ ] Mellan −1 och 1
- [ ] Mellan 0 och 0,5
- [ ] Mellan −0,5 och 0,5
---
sin svänger mellan −1 och 1. Dividerat med 2 blir det −0,5 till 0,5, och när 0,5 läggs till flyttas det till 0 till 1 – precis intervallet för en färgkanal.
```

## Vektorer

I sin mest grundläggande definition är vektorer *riktningar* och inget mer. En vektor har en **riktning** och en
**storlek** (även kallad styrka eller längd). Du kan tänka på vektorer som anvisningarna på en skattkarta: "gå 10
steg åt vänster, gå nu 3 steg norrut och gå 5 steg åt höger"; här är "vänster" riktningen och "10 steg" vektorns
storlek. Anvisningarna på skattkartan innehåller alltså 3 vektorer. Vektorer kan ha valfritt antal dimensioner, men
vi arbetar oftast med 2 till 4. Om en vektor har 2 dimensioner representerar den en riktning i ett plan (tänk på
2D-grafer), och när den har 3 dimensioner kan den representera vilken riktning som helst i en 3D-värld.

Om du ritar vektorer i en 2D-graf är varje vektor en pil; var pilen börjar spelar ingen roll, bara dess riktning och
längd. Vektorn (2, 3) ritad från origo och (2, 3) ritad från punkten (4, 1) är samma vektor.

Matematiker föredrar i allmänhet att beteckna vektorer med en bokstav med ett litet streck över, som v̄. När vektorer
visas i formler skrivs de dessutom oftast som en kolumn av tal:

```text
    | x |
v = | y |
    | z |
```

I löptext skriver vi samma vektor som v = (x, y, z) för att spara plats. Eftersom vektorer anges som riktningar är
det ibland svårt att se dem som positioner. Om vi vill se vektorer som positioner kan vi tänka oss att
riktningsvektorns början ligger i (0, 0, 0) och att den pekar i en viss riktning som anger punkten, vilket gör den
till en *positionsvektor* (vi kan också ange ett annat origo och då säga: "den här vektorn pekar på den punkten i
rummet från det här origot"). Positionsvektorn (3, 5) skulle då peka på (3, 5) i grafen med origo i (0, 0). Med
vektorer kan vi alltså beskriva riktningar **och** positioner i 2D och 3D.

Precis som med vanliga tal kan vi definiera flera operationer på vektorer (några av dem har du redan sett).

### Skalära vektoroperationer

En *skalär* är ett enda tal. När vi adderar, subtraherar, multiplicerar eller dividerar en vektor med en skalär
adderar, subtraherar, multiplicerar eller dividerar vi helt enkelt varje element i vektorn med skalären. För addition
ser det ut så här:

```text
| 1 |       | 1 + 3 |   | 4 |
| 2 | + 3 = | 2 + 3 | = | 5 |
| 3 |       | 3 + 3 |   | 6 |
```

där + kan vara +, −, · eller ÷. Observera att den omvända ordningen (skalär − vektor, skalär ÷ vektor) inte är
definierad för minus och division. Strängt taget är inte heller addition av en skalär och en vektor definierad i
matematiken; det är en vanlig förkortning för "addera skalären till varje element", och {{shaderLanguage}} stöder
den också.

### Negation av vektorer

Att negera en vektor ger en vektor i motsatt riktning. En vektor som pekar mot nordost pekar mot sydväst efter
negationen. För att negera en vektor sätter vi ett minustecken framför varje komponent (du kan också se det som en
multiplikation med skalären −1):

```text
       | vx |   | −vx |
−v = − | vy | = | −vy |
       | vz |   | −vz |
```

### Addition och subtraktion

Addition av två vektorer definieras som *komponentvis* addition, det vill säga varje komponent i den ena vektorn
adderas till samma komponent i den andra:

```text
    | 1 |       | 4 |           | 1 + 4 |   | 5 |
v = | 2 |,  k = | 5 |,  v + k = | 2 + 5 | = | 7 |
    | 3 |       | 6 |           | 3 + 6 |   | 9 |
```

Visuellt sätter du den andra pilen vid spetsen av den första: summan är pilen från den förstas början till den
andras spets. Om v = (4, 2) och k = (1, 2) är v + k = (5, 4) – gå 4 åt höger och 2 uppåt, sedan 1 åt höger och 2
uppåt, så har du hamnat 5 åt höger och 4 uppåt.

Precis som för vanliga tal är vektorsubtraktion detsamma som addition med en negerad andra vektor:

```text
    | 1 |       | 4 |                      | 1 − 4 |   | −3 |
v = | 2 |,  k = | 5 |,  v + (−k) = v − k = | 2 − 5 | = | −3 |
    | 3 |       | 6 |                      | 3 − 6 |   | −3 |
```

Att subtrahera två vektorer från varandra ger en vektor som är skillnaden mellan de positioner som de två vektorerna
pekar på. Det är användbart när vi behöver vektorn mellan två punkter: vektorn från punkten p till punkten q är q − p.

### Längd

För att få fram en vektors längd/storlek använder vi Pythagoras sats, som du kanske minns från mattelektionerna. En
vektor bildar en triangel om du ser dess x- och y-komponent som två sidor i en triangel, och vektorn själv är
hypotenusan. Eftersom längderna på de två sidorna (x, y) är kända och vi vill veta längden på den sneda sidan v, kan
vi räkna ut den med Pythagoras sats:

```text
||v|| = √(x² + y²)
```

där ||v|| betecknar *längden av vektorn v*. Det utvidgas lätt till 3D genom att lägga till z² i ekvationen. För
v = (4, 2):

```text
||v|| = √(4² + 2²) = √(16 + 4) = √20 ≈ 4.47
```

Det finns också en speciell sorts vektor som vi kallar *enhetsvektor*. En enhetsvektor har en extra egenskap,
nämligen att dess längd är exakt 1. Vi kan räkna ut en enhetsvektor n från vilken vektor som helst genom att dividera
var och en av vektorns komponenter med dess längd:

```text
n = v / ||v||
```

Det kallas att *normalisera* en vektor. Enhetsvektorer skrivs med ett litet tak över sig och är i allmänhet lättare
att arbeta med, särskilt när vi bara bryr oss om deras riktning (riktningen ändras inte om vi ändrar en vektors
längd). Normaliseras v = (4, 2) blir det ungefär (0.894, 0.447): samma riktning, längd 1.

![Addition och subtraktion av vektorer, och en vektors längd](images/vectors.webp "v + k: den andra pilen börjar vid den förstas spets. q − p: vektorn från punkten p till punkten q. Längden av v = (4, 2): hypotenusan till dess komponenter.")

### Multiplikation av vektorer

Att multiplicera två vektorer är lite speciellt. Vanlig multiplikation är egentligen inte definierad för vektorer
eftersom den saknar visuell betydelse, men det finns två specifika fall att välja mellan: det ena är
*skalärprodukten* (dot product), skriven v · k, och det andra är *kryssprodukten* (cross product), skriven v × k.

#### Skalärprodukt

Skalärprodukten av två vektorer är lika med produkten av deras längder gånger cosinus för vinkeln mellan dem. Om
det låter förvirrande, titta på formeln:

```text
v · k = ||v|| · ||k|| · cos θ
```

där vinkeln mellan dem betecknas theta (θ). Varför är det intressant? Tänk dig att v och k är enhetsvektorer; då är
deras längder lika med 1. Formeln förenklas då till:

```text
v · k = 1 · 1 · cos θ = cos θ
```

Nu bestämmer skalärprodukten **bara** vinkeln mellan vektorerna. Som vi såg på enhetscirkeln är cos θ lika med 1 när
vinkeln är 0, 0 när vinkeln är 90 grader och −1 när den är 180 grader. Det gör att vi enkelt kan testa med
skalärprodukten om två vektorer är *ortogonala* eller *parallella* (ortogonala betyder att vektorerna står i rät
vinkel mot varandra).

> Du kan också räkna ut vinkeln mellan två vektorer som inte är enhetsvektorer, men då måste du dividera resultatet
> med båda vektorernas längder för att få kvar cos θ.

Hur räknar vi då ut skalärprodukten? Skalärprodukten är en komponentvis multiplikation där vi adderar resultaten. Så
här ser det ut med två enhetsvektorer (du kan kontrollera att båda har längden exakt 1):

```text
|  0.6 |   | 0 |
| −0.8 | · | 1 | = (0.6 · 0) + (−0.8 · 1) + (0 · 0) = −0.8
|  0   |   | 0 |
```

För att få vinkeln mellan de två enhetsvektorerna använder vi inversen till cosinus, cos⁻¹ (acos), vilket ger 143,1
grader. Vi har nu räknat ut vinkeln mellan de två vektorerna. Skalärprodukter visar sig vara mycket användbara i
ljusberäkningar längre fram.

```quiz
Skalärprodukten av två enhetsvektorer är 0. Vad säger det om dem?
- [x] De är vinkelräta mot varandra (vinkeln är 90°)
- [ ] De pekar åt samma håll
- [ ] De pekar åt motsatta håll
- [ ] En av dem måste vara nollvektorn
---
För enhetsvektorer är skalärprodukten cos θ, och cos θ är 0 precis vid 90°. Samma riktning ger 1, motsatta riktningar ger −1. En nollvektor kan inte vara en enhetsvektor: dess längd är 0.
```

#### Kryssprodukt

Kryssprodukten är bara definierad i 3D och tar två icke-parallella vektorer som indata och ger en tredje vektor som är
ortogonal mot båda. Om de två indatavektorerna också är ortogonala mot varandra ger kryssprodukten 3 ortogonala
vektorer; det kommer att visa sig användbart i kommande kapitel. Så här räknar man ut kryssprodukten av vektorerna
A och B:

```text
| Ax |   | Bx |   | Ay·Bz − Az·By |
| Ay | × | By | = | Az·Bx − Ax·Bz |
| Az |   | Bz |   | Ax·By − Ay·Bx |
```

Som du ser verkar det inte riktigt vara meningsfullt. Men om du bara följer stegen får du en ny vektor som är
ortogonal mot dina indatavektorer. Prova med x-axeln och y-axeln:

```text
| 1 |   | 0 |   | 0·0 − 0·1 |   | 0 |
| 0 | × | 1 | = | 0·0 − 1·0 | = | 0 |
| 0 |   | 0 |   | 1·1 − 0·0 |   | 1 |
```

Resultatet är z-axeln. Ordningen spelar roll: y × x ger (0, 0, −1), z-axeln åt andra hållet. Det är
högerhandsregeln från början av kapitlet: i ett högerhänt system är x × y = z.

![Skalärprodukt och kryssprodukt](images/dot-cross.webp "För enhetsvektorer är skalärprodukten cos θ: 1 i samma riktning, 0 i rät vinkel, −1 i motsatta riktningar. Kryssprodukten av x och y är z – och y × x är −z.")

## Matriser

Nu när vi har gått igenom nästan allt som finns att säga om vektorer är det dags att gå in i matrisen! En matris är
en rektangulär uppställning av tal, symboler och/eller matematiska uttryck. Varje enskild post i en matris kallas ett
*element* i matrisen. Här är ett exempel på en 2×3-matris:

```text
| 1  2  3 |
| 4  5  6 |
```

Matriser indexeras med (i, j) där i är raden och j kolumnen; därför kallas matrisen ovan en 2×3-matris (2 rader och
3 kolumner, även kallat matrisens *dimensioner*). Det är tvärtom mot vad du är van vid när du indexerar 2D-grafer
som (x, y). För att hämta värdet 4 indexerar vi (2, 1) (andra raden, första kolumnen).

Matriser är egentligen inget mer än så, bara rektangulära uppställningar av matematiska uttryck. De har dock en
mycket trevlig uppsättning matematiska egenskaper, och precis som för vektorer kan vi definiera flera operationer på
matriser, nämligen addition, subtraktion och multiplikation.

### Addition och subtraktion

Addition och subtraktion av två matriser görs elementvis. Samma regler som vi känner från vanliga tal gäller alltså,
men tillämpade på elementen med samma index i båda matriserna. Det betyder att addition och subtraktion bara är
definierade för matriser med samma dimensioner. En 3×2-matris och en 2×3-matris (eller en 3×3-matris och en
4×4-matris) kan inte adderas eller subtraheras. Så här fungerar matrisaddition för två 2×2-matriser:

```text
| 1  2 |   | 5  6 |   | 1 + 5  2 + 6 |   |  6   8 |
| 3  4 | + | 7  8 | = | 3 + 7  4 + 8 | = | 10  12 |
```

Samma regler gäller för matrissubtraktion:

```text
| 4  2 |   | 2  4 |   | 4 − 2  2 − 4 |   | 2  −2 |
| 1  6 | − | 0  1 | = | 1 − 0  6 − 1 | = | 1   5 |
```

### Produkter av matris och skalär

En produkt av en matris och en skalär multiplicerar varje element i matrisen med skalären. Följande exempel visar
multiplikationen:

```text
    | 1  2 |   | 2·1  2·2 |   | 2  4 |
2 · | 3  4 | = | 2·3  2·4 | = | 6  8 |
```

Nu blir det också begripligt varför enskilda tal kallas skalärer. En skalär *skalar* i princip alla element i
matrisen med sitt värde. I exemplet ovan skalades alla element med 2.

Så långt allt väl, inget av fallen var särskilt komplicerat. Det vill säga, tills vi börjar med multiplikation av
två matriser.

### Matrismultiplikation

Att multiplicera matriser är inte nödvändigtvis komplicerat, men ganska svårt att känna sig bekväm med.
Matrismultiplikation innebär i princip att man följer en uppsättning fördefinierade regler. Det finns dock några
begränsningar:

1. Du kan bara multiplicera två matriser om antalet kolumner i den vänstra matrisen är lika med antalet rader i den
   högra matrisen.
2. Matrismultiplikation är inte *kommutativ*, det vill säga A · B ≠ B · A.

Vi börjar med ett exempel på en multiplikation av två 2×2-matriser:

```text
| 1  2 |   | 5  6 |   | 1·5 + 2·7   1·6 + 2·8 |   | 19  22 |
| 3  4 | · | 7  8 | = | 3·5 + 4·7   3·6 + 4·8 | = | 43  50 |
```

Just nu försöker du förmodligen lista ut vad i hela friden som hände? Matrismultiplikation är en kombination av vanlig
multiplikation och addition, där den vänstra matrisens rader kombineras med den högra matrisens kolumner. För att få
elementet i rad i och kolumn j i resultatet tar du rad i i den vänstra matrisen och kolumn j i den högra,
multiplicerar elementen parvis och adderar produkterna. För elementet uppe till höger ovan är det rad 1 i den vänstra
matrisen, (1, 2), och kolumn 2 i den högra, (6, 8): 1·6 + 2·8 = 22. Med andra ord: varje element i resultatet är
skalärprodukten av en rad i den vänstra matrisen och en kolumn i den högra.

Resultatmatrisen har dimensionerna (n, m), där n är antalet rader i den vänstra matrisen och m antalet kolumner i den
högra: en 2×3-matris gånger en 3×4-matris är en 2×4-matris.

Byt nu plats på de två matriserna:

```text
| 5  6 |   | 1  2 |   | 5·1 + 6·3   5·2 + 6·4 |   | 23  34 |
| 7  8 | · | 3  4 | = | 7·1 + 8·3   7·2 + 8·4 | = | 31  46 |
```

Ett helt annat resultat – det är vad "inte kommutativ" betyder, och det kommer att spela stor roll när vi kombinerar
transformationer. Oroa dig inte om du har svårt att föreställa dig multiplikationerna i huvudet. Fortsätt att räkna
för hand och kom tillbaka hit när det blir svårt. Med tiden blir matrismultiplikation en självklarhet.

```quiz
A är en 2×3-matris (2 rader, 3 kolumner) och B en 3×4-matris. Vilka påståenden stämmer?
- [ ] A · B är definierad, och resultatet är en 3×3-matris
- [ ] A · B och B · A är båda definierade, och de är lika
- [x] B · A är inte definierad, eftersom B har 4 kolumner men A bara 2 rader
- [x] A · B är definierad, och resultatet är en 2×4-matris
---
Den vänstra matrisens kolumner måste stämma med den högras rader: A har 3 kolumner och B har 3 rader, så A · B fungerar och har A:s rader och B:s kolumner (2×4). För B · A stämmer inte B:s 4 kolumner med A:s 2 rader. Och även när båda ordningarna är definierade är matrismultiplikation inte kommutativ.
```

## Multiplikation av matris och vektor

Hittills har vi sett vår beskärda del av vektorer. Vi har använt dem för att representera positioner, färger och
till och med texturkoordinater. Låt oss gå lite längre ner i kaninhålet och berätta att en vektor i grunden är en
N×1-matris, där N är vektorns antal komponenter (även kallad en N-dimensionell vektor). Tänker man efter är det
mycket logiskt. Vektorer är precis som matriser en uppställning av tal, men med bara 1 kolumn. Hur hjälper den här
nya informationen oss då? Jo, om vi har en M×N-matris kan vi multiplicera den med vår N×1-vektor, eftersom matrisens
antal kolumner är lika med vektorns antal rader; matrismultiplikationen är alltså definierad.

Men varför bryr vi oss om att vi kan multiplicera matriser med en vektor? Jo, det råkar finnas massor av intressanta
2D/3D-transformationer som vi kan lägga i en matris, och att multiplicera den matrisen med en vektor *transformerar*
då vektorn. Om du fortfarande är lite förvirrad, låt oss börja med några exempel så ser du snart vad vi menar.

### Identitetsmatris

I grafikprogrammering, och i den här kursen, arbetar vi oftast med 4×4-transformationsmatriser av flera skäl, och
ett av dem är att de flesta vektorerna har 4 komponenter. Den enklaste transformationsmatris vi kan tänka oss är
*identitetsmatrisen*. Identitetsmatrisen är en N×N-matris med bara nollor utom på diagonalen. Som du ser lämnar den
här transformationsmatrisen en vektor helt opåverkad:

```text
| 1  0  0  0 |   | 1 |   | 1·1 |   | 1 |
| 0  1  0  0 |   | 2 |   | 1·2 |   | 2 |
| 0  0  1  0 | · | 3 | = | 1·3 | = | 3 |
| 0  0  0  1 |   | 4 |   | 1·4 |   | 4 |
```

Vektorn är helt orörd. Det blir uppenbart av multiplikationsreglerna: det första elementet i resultatet är varje
element i matrisens första rad multiplicerat med motsvarande element i vektorn. Eftersom alla element i raden är 0
utom det första får vi: 1·1 + 0·2 + 0·3 + 0·4 = 1, och detsamma gäller för vektorns andra 3 element.

> Du kanske undrar vad man ska med en transformationsmatris som inte transformerar? Identitetsmatrisen är oftast
> utgångspunkten när man skapar andra transformationsmatriser, och om vi gräver ännu djupare i linjär algebra är den
> en mycket användbar matris för att bevisa satser och lösa linjära ekvationssystem.

### En matris kolumner

Det finns ett enkelt sätt att se vad en matris gör med en vektor, och det är värt att känna till innan du möter
transformationsmatriserna. Ta en 2×2-matris och multiplicera den med de två *enhetsvektorerna* längs axlarna, (1, 0)
och (0, 1):

```text
| a  b |   | 1 |   | a |        | a  b |   | 0 |   | b |
| c  d | · | 0 | = | c |        | c  d | · | 1 | = | d |
```

x-axeln hamnar på matrisens första kolumn och y-axeln på dess andra. Varje annan vektor är byggd av de två – (x, y)
är x gånger (1, 0) plus y gånger (0, 1) – så den hamnar på x gånger den första kolumnen plus y gånger den andra. Med
andra ord: **en matris kolumner är dit den skickar axlarna**, och det avgör vart varje annan vektor tar vägen.
Detsamma gäller i 3D och 4D, med en kolumn per axel. Identitetsmatrisen lämnar varje axel där den är, och därför
ändrar den ingenting.

Låt oss använda det för att bygga en matris själva: en som vrider allting ett kvarts varv (90°) moturs. En sådan
vridning skickar x-axeln (1, 0) uppåt till (0, 1), och y-axeln (0, 1) åt vänster, till (−1, 0). Det är de två
kolumnerna:

```text
| 0  −1 |   | 2 |   | 0·2 + (−1)·1 |   | −1 |
| 1   0 | · | 1 | = | 1·2 +   0·1  | = |  2 |
```

Vektorn (2, 1), två steg åt höger och ett uppåt, blir (−1, 2): ett steg åt vänster och två uppåt – samma pil, vriden
ett kvarts varv.

### Rotera med vilken vinkel som helst

Nu för en godtycklig vinkel θ. Att vrida x-axeln (1, 0) med θ är precis promenaden längs enhetscirkeln från förra
avsnittet: den slutar i (cos θ, sin θ). y-axeln börjar ett kvarts varv längre fram, så den slutar i punkten ett
kvarts varv längre fram, som är (−sin θ, cos θ). Sätt in dem som kolumner, så har du matrisen som roterar vilken
2D-vektor som helst med θ:

```text
| cos θ  −sin θ |
| sin θ   cos θ |
```

Kontrollera med θ = 90°: cos 90° = 0 och sin 90° = 1 ger precis kvartsvarvsmatrisen ovan. Det här är kärnan i varje
rotationsmatris du kommer att använda. I *Transformationer* möter du den igen i sin 3D-form, där en rotation också
behöver en axel att vrida kring: rotation kring z-axeln är just den här matrisen, med z lämnat som det är.

```quiz
En 2×2-matris skickar x-axeln (1, 0) till (0, 1) och y-axeln (0, 1) till (−1, 0). Vad gör den med vektorn (3, 0)?
- [x] Den gör om den till (0, 3)
- [ ] Den lämnar den som (3, 0)
- [ ] Den gör om den till (−3, 0)
- [ ] Den gör om den till (0, −3)
---
(3, 0) är 3 gånger x-axeln, så den hamnar på 3 gånger den första kolumnen: 3 · (0, 1) = (0, 3). Matrisen är kvarts varvet moturs: pilen som pekade åt höger pekar nu uppåt.
```

![En rotationsmatris kolumner](images/rotation-columns.webp "Till vänster: en rotation med θ skickar x-axeln till (cos θ, sin θ) och y-axeln till (−sin θ, cos θ) – matrisens två kolumner. Till höger: kvartsvarvsmatrisen gör om (2, 1) till (−1, 2).")

## Varför 4×4-matriser?

Matriser kan rotera, som vi just såg, och i nästa kapitel ser du att de kan skala också. Men titta på vad en
2×2-matris (eller 3×3-matris) gör med origo: varje element i resultatet är en summa av matriselement gånger 0, så
origo stannar alltid i origo. En sådan matris kan vrida och töja rummet kring origo, men den kan aldrig *flytta*
något – och att flytta runt objekt är precis vad vi behöver.

Tricket som grafikprogrammerare använder är att ge varje position en fjärde komponent, w, som är 1 för punkter, och
att använda 4×4-matriser vars extra kolumn kan rymma en förflyttning. Därför var identitetsmatrisen ovan en
4×4-matris, och därför har positionerna i dina vertex shaders haft fyra komponenter hela tiden. *Transformationer*
visar hur den extra kolumnen gör sitt jobb, och *Koordinatsystem* använder w till en sak till: perspektiv.

```quiz
Varför kan inte en 3×3-matris flytta (translatera) en punkt i 3D?
- [ ] För att den har för få element för att rymma tre tal för förflyttningen
- [ ] För att matrismultiplikation inte är kommutativ
- [x] För att den alltid skickar origo (0, 0, 0) till origo, så den kan inte flytta allt lika mycket
- [ ] För att bara 4×4-matriser kan multipliceras med vektorer
---
Varje element i resultatet är en summa av produkter med vektorns komponenter – alla 0 för origo – så origo stannar alltid där det är. En förflyttning skulle behöva flytta origo också. Multiplikationens ordning har inget med saken att göra, och matriser av alla storlekar kan multipliceras med en vektor som har lika många rader som matrisen har kolumner.
```

## Sammanfattning

- Positioner är listor med tal längs axlar. Kursen använder ett **högerhänt** system: +x åt höger, +y uppåt, +z ut ur
  skärmen mot dig.
- Vinklar mäts i grader (ett helt varv är 360°) eller radianer (2π); matematikfunktionerna vill ha radianer, och en
  positiv vinkel vrider moturs.
- Punkten vid vinkeln θ på enhetscirkeln är (cos θ, sin θ); för radien r är den (r · cos θ, r · sin θ).
- Vektorer har en riktning och en längd; de kan adderas, subtraheras, skalas och normaliseras. Skalärprodukten av
  enhetsvektorer är cosinus för vinkeln mellan dem, och kryssprodukten ger en vektor i rät vinkel mot båda.
- Matriser multipliceras rad gånger kolumn, och ordningen spelar roll. En matris gånger en vektor transformerar
  vektorn, och matrisens kolumner är dit axlarna hamnar.
- En rotation med θ har kolumnerna (cos θ, sin θ) och (−sin θ, cos θ); för att också kunna flytta saker behöver vi
  en fjärde komponent, w, och 4×4-matriser.

Det är verktygslådan. I nästa kapitel, *Transformationer*, använder vi den för att bygga matriserna som skalar,
flyttar och roterar lådan – och sätter dem i arbete i dina shaders.
