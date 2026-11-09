# Transformationer

Nu vet vi hur man skapar objekt, färgar dem och ger dem ett detaljerat utseende med texturer, men de är fortfarande
inte särskilt intressanta eftersom de alla är statiska. Vi skulle kunna försöka få dem att röra sig genom att ändra
deras vertices och ladda upp buffertarna på nytt varje bildruta, men det är krångligt och kostar en hel del
beräkningskraft. Det finns mycket bättre sätt att *transformera* ett objekt, och det är att använda (flera)
*matriser*. Det betyder inte att vi ska prata om kung fu och en stor digital artificiell värld.

Matriser är mycket kraftfulla matematiska konstruktioner som verkar skrämmande till en början, men när du väl har
vant dig vid dem visar de sig vara extremt användbara. För att diskutera matriser måste vi göra en liten dykning i
matematiken. Men för att helt förstå transformationer måste vi först gå lite djupare in på vektorer innan vi
diskuterar matriser.

Kapitlets första halva är matematik och densamma för alla API:er. Koden börjar i avsnittet *I praktiken*, där du
använder matematiken för att skala, rotera och flytta den texturerade lådan från förra kapitlet.

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

Nu bestämmer skalärprodukten **bara** vinkeln mellan vektorerna. Du kanske minns att cosinus, cos, blir 0 när vinkeln
är 90 grader och 1 när vinkeln är 0. Det gör att vi enkelt kan testa med skalärprodukten om två vektorer är
*ortogonala* eller *parallella* (ortogonala betyder att vektorerna står i rät vinkel mot varandra). Om du vill veta
mer om sin och cos rekommenderar jag en grundläggande repetition av trigonometri.

> Du kan också räkna ut vinkeln mellan två vektorer som inte är enhetsvektorer, men då måste du dividera resultatet
> med båda vektorernas längder för att få kvar cos θ.

Hur räknar vi då ut skalärprodukten? Skalärprodukten är en komponentvis multiplikation där vi adderar resultaten. Så
här ser det ut med två enhetsvektorer (du kan kontrollera att båda har längden exakt 1):

```text
|  0.6 |   | 0 |
| −0.8 | · | 1 | = (0.6 · 0) + (−0.8 · 1) + (0 · 0) = −0.8
|  0   |   | 0 |
```

För att få vinkeln mellan de två enhetsvektorerna använder vi inversen till cosinus, cos⁻¹ (acos), vilket ger 143.1
grader. Vi har nu räknat ut vinkeln mellan de två vektorerna. Skalärprodukter visar sig vara mycket användbara i
ljusberäkningar längre fram.

```quiz
Skalärprodukten av två enhetsvektorer är 0. Vad säger det om dem?
- [ ] De pekar åt samma håll
- [x] De är vinkelräta mot varandra (vinkeln är 90°)
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

Resultatet är z-axeln. Ordningen spelar roll: y × x ger (0, 0, −1), z-axeln åt andra hållet.

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
- [x] A · B är definierad, och resultatet är en 2×4-matris
- [x] B · A är inte definierad, eftersom B har 4 kolumner men A bara 2 rader
- [ ] A · B och B · A är båda definierade, och de är lika
- [ ] A · B är definierad, och resultatet är en 3×3-matris
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

### Skalning

När vi skalar en vektor ökar vi pilens längd med den faktor vi vill skala med, medan riktningen förblir densamma.
Eftersom vi arbetar i 2 eller 3 dimensioner kan vi definiera skalning med en vektor av 2 eller 3 skalningsvariabler,
som var och en skalar en axel (x, y eller z).

Låt oss skala vektorn v = (3, 2). Vi skalar vektorn längs x-axeln med 0.5, vilket gör den hälften så bred, och längs
y-axeln med 2, vilket gör den dubbelt så hög: resultatet är (1.5, 4).

Kom ihåg att grafik-API:er oftast arbetar i 3D, så i 2D-fall kan vi sätta z-axelns skalning till 1 och lämna den
opåverkad. Skalningen vi just gjorde är en *icke-likformig* skalning (non-uniform scale), eftersom skalfaktorn inte
är densamma för alla axlar. Om skalären vore lika för alla axlar skulle det kallas en *likformig skalning* (uniform
scale).

Nu bygger vi en transformationsmatris som sköter skalningen åt oss. Vi såg i identitetsmatrisen att varje
diagonalelement multiplicerades med motsvarande element i vektorn. Vad händer om vi ändrar ettorna i
identitetsmatrisen till treor? Då multiplicerar vi varje element i vektorn med 3 och skalar alltså vektorn likformigt
med 3. Om vi betecknar skalningsvariablerna (S1, S2, S3) kan vi definiera en skalningsmatris för en godtycklig vektor
(x, y, z) så här:

```text
| S1  0   0   0 |   | x |   | S1·x |
| 0   S2  0   0 |   | y |   | S2·y |
| 0   0   S3  0 | · | z | = | S3·z |
| 0   0   0   1 |   | 1 |   | 1    |
```

Observera att vi behåller det fjärde skalningsvärdet 1. Komponenten w används till annat, som vi ska se senare.

### Translation

*Translation* är att lägga till en annan vektor ovanpå den ursprungliga vektorn för att få en ny vektor med en annan
position, alltså att *flytta* vektorn med en translationsvektor. Vi har redan gått igenom vektoraddition, så det här
borde inte vara alltför nytt.

Precis som för skalningsmatrisen finns det platser i en 4×4-matris som vi kan använda för vissa operationer, och för
translation är det de 3 översta värdena i den 4:e kolumnen. Om vi betecknar translationsvektorn (Tx, Ty, Tz) kan vi
definiera translationsmatrisen så här:

```text
| 1  0  0  Tx |   | x |   | x + Tx |
| 0  1  0  Ty |   | y |   | y + Ty |
| 0  0  1  Tz | · | z | = | z + Tz |
| 0  0  0  1  |   | 1 |   | 1      |
```

Det fungerar eftersom alla translationsvärden multipliceras med vektorns w-komponent och adderas till vektorns
ursprungliga värden (kom ihåg reglerna för matrismultiplikation). Det hade inte gått med en 3×3-matris.

### Homogena koordinater

En vektors w-komponent kallas också en *homogen koordinat*. För att få 3D-vektorn ur en homogen vektor dividerar vi
x-, y- och z-koordinaten med w-koordinaten. Det märker vi oftast inte, eftersom w-komponenten för det mesta är 1.0.
Homogena koordinater har flera fördelar: de låter oss göra translationer med matriser på 3D-vektorer (utan
w-komponent kan vi inte translatera vektorer), och i nästa kapitel använder vi w-värdet för att skapa perspektiv i
3D.

När den homogena koordinaten är 0 kallas vektorn dessutom en *riktningsvektor*, eftersom en vektor med w-koordinaten
0 inte kan translateras: translationskolumnen multipliceras med 0. Det är precis rätt för riktningar – att flytta en
pil någon annanstans ändrar inte vart den pekar.

Du har redan stött på den homogena koordinaten i dina vertex shaders.
:::opengl
`gl_Position = vec4(aPos, 1.0);` gör om positionen med 3 komponenter till en med 4 komponenter och w = 1.0: en punkt,
som en translation kommer att flytta.
:::
:::vulkan
`gl_Position = vec4(inPosition, 1.0);` gör om positionen med 3 komponenter till en med 4 komponenter och w = 1.0: en
punkt, som en translation kommer att flytta.
:::
:::d3d12
`VSMain` tar en `float4 position : POSITION` fast vertexbufferten bara innehåller tre floats per position; input
assemblern fyller i det saknade w med 1.0. Varje vertex kommer alltså fram som en punkt, som en translation kommer
att flytta.
:::

```quiz
Du multiplicerar translationsmatrisen som flyttar med (1, 2, 3) med vektorn (4, 0, 0, w). Vad blir resultatet för w = 1 och för w = 0?
- [x] (5, 2, 3, 1) för w = 1, och (4, 0, 0, 0) för w = 0
- [ ] (5, 2, 3, 1) för båda värdena av w
- [ ] (4, 0, 0, 1) för w = 1, och (5, 2, 3, 0) för w = 0
---
Translationen ligger i den 4:e kolumnen, som multipliceras med w. Med w = 1 adderas den en gång: en punkt flyttas. Med w = 0 bidrar den inte alls: en riktningsvektor förblir densamma.
```

### Rotation

De senaste avsnitten var relativt lätta att förstå och att föreställa sig för 2D- eller 3D-vektorer, men rotationer
är lite knepigare. Om du vill veta exakt hur de här matriserna konstrueras rekommenderar jag avsnitten om rotation i
en bra videoserie eller lärobok om linjär algebra.

Först definierar vi vad en rotation av en vektor egentligen är. En rotation i 2D eller 3D anges med en *vinkel*. En
vinkel kan vara i grader eller radianer, där ett helt varv är 360 grader eller 2π radianer. Jag föredrar att förklara
rotationer i grader eftersom vi i allmänhet är mer vana vid dem, men matematikbiblioteken – både GLM och
DirectXMath – vill ha radianer, så här räknar du om:

```text
vinkel i grader   = vinkel i radianer · (180 / π)
vinkel i radianer = vinkel i grader · (π / 180)
```

där π är (avrundat) 3.14159265359. Att rotera ett halvt varv är att rotera 360/2 = 180 grader, och att rotera en
femtedel åt höger betyder att vi roterar 360/5 = 72 grader åt höger. Ett kvarts varv, 90 grader, är π/2 ≈ 1.5708
radianer.

Rotationer i 3D anges med en vinkel **och** en *rotationsaxel*. Objektet roteras med den angivna vinkeln kring den
angivna rotationsaxeln. Försök föreställa dig det genom att vrida huvudet ett visst antal grader medan du hela tiden
tittar längs en och samma rotationsaxel. När vi till exempel roterar 2D-vektorer i en 3D-värld sätter vi
rotationsaxeln till z-axeln (försök föreställa dig det).

Med trigonometri går det att omvandla vektorer till nya, roterade vektorer givet en vinkel. Det görs oftast med en
smart kombination av sinus- och cosinusfunktionerna (som brukar förkortas sin och cos). Hur rotationsmatriserna tas
fram ligger utanför det här kapitlet.

Det finns en rotationsmatris för varje enhetsaxel i 3D, där vinkeln betecknas med theta, θ.

Rotation kring X-axeln:

```text
| 1  0      0       0 |   | x |   | x                 |
| 0  cos θ  −sin θ  0 |   | y |   | cos θ·y − sin θ·z |
| 0  sin θ  cos θ   0 | · | z | = | sin θ·y + cos θ·z |
| 0  0      0       1 |   | 1 |   | 1                 |
```

Rotation kring Y-axeln:

```text
| cos θ   0  sin θ  0 |   | x |   | cos θ·x + sin θ·z  |
| 0       1  0      0 |   | y |   | y                  |
| −sin θ  0  cos θ  0 | · | z | = | −sin θ·x + cos θ·z |
| 0       0  0      1 |   | 1 |   | 1                  |
```

Rotation kring Z-axeln:

```text
| cos θ  −sin θ  0  0 |   | x |   | cos θ·x − sin θ·y |
| sin θ  cos θ   0  0 |   | y |   | sin θ·x + cos θ·y |
| 0      0       1  0 | · | z | = | z                 |
| 0      0       0  1 |   | 1 |   | 1                 |
```

Med rotationsmatriserna kan vi rotera våra positionsvektorer kring en av de tre enhetsaxlarna. Kontrollera
Z-rotationen med ett kvarts varv: cos 90° = 0 och sin 90° = 1, så punkten (1, 0, 0) blir (0, 1, 0). Med x åt höger
och y uppåt flyttas punkten från höger till toppen: en positiv vinkel vrider **moturs** när du tittar ner på
xy-planet från +z.

För att rotera kring en godtycklig 3D-axel kan vi kombinera alla 3, till exempel genom att först rotera kring
X-axeln, sedan Y och sedan Z. Men det leder snabbt till ett problem som kallas *gimbal lock*. När en rotation lägger
två av axlarna i linje – till exempel vrider en rotation på 90° kring Y X-axeln till den (negativa) Z-axeln – sker
rotationerna kring den första och den sista axeln nu kring samma riktning, och du har förlorat en frihetsgrad: ingen
kombination av de tre vinklarna kan då rotera objektet kring den saknade axeln.

En bättre lösning är att direkt rotera kring en godtycklig enhetsaxel, till exempel (Rx, Ry, Rz), i stället för att
kombinera rotationsmatriserna. En sådan (omständlig) matris finns och ges nedan med (Rx, Ry, Rz) som den godtyckliga
rotationsaxeln:

```text
| cos θ + Rx²(1 − cos θ)        Rx·Ry(1 − cos θ) − Rz·sin θ   Rx·Rz(1 − cos θ) + Ry·sin θ   0 |
| Ry·Rx(1 − cos θ) + Rz·sin θ   cos θ + Ry²(1 − cos θ)        Ry·Rz(1 − cos θ) − Rx·sin θ   0 |
| Rz·Rx(1 − cos θ) − Ry·sin θ   Rz·Ry(1 − cos θ) + Rx·sin θ   cos θ + Rz²(1 − cos θ)        0 |
| 0                             0                             0                             1 |
```

Hur en sådan matris tas fram matematiskt ligger utanför det här kapitlet. Tänk på att inte ens den här matrisen helt
förhindrar gimbal lock i ett program som bygger sin orientering av en följd av Eulervinklar. För att verkligen undvika
det måste vi representera rotationer med *kvaternioner*: fyra tal som lagrar en axel och en vinkel, är säkrare och
dessutom effektivare att räkna med, och kan interpoleras mjukt mellan två orienteringar. Både GLM (`glm::quat`) och
DirectXMath (`XMQuaternionRotationAxis`, `XMMatrixRotationQuaternion`) stöder dem. En genomgång av kvaternioner
sparar vi dock till ett senare kapitel.

### Kombinera matriser

Den verkliga styrkan med att använda matriser för transformationer är att vi kan kombinera flera transformationer i
en enda matris tack vare matrismultiplikation. Låt oss se om vi kan skapa en transformationsmatris som kombinerar
flera transformationer. Säg att vi har en vektor (x, y, z) och vill skala den med 2 och sedan translatera den med
(1, 2, 3). Vi behöver en translations- och en skalningsmatris för de här stegen. Den resulterande
transformationsmatrisen ser då ut så här:

```text
| 1  0  0  1 |   | 2  0  0  0 |   | 2  0  0  1 |
| 0  1  0  2 |   | 0  2  0  0 |   | 0  2  0  2 |
| 0  0  1  3 | · | 0  0  2  0 | = | 0  0  2  3 |
| 0  0  0  1 |   | 0  0  0  1 |   | 0  0  0  1 |
     Trans          Scale
```

Observera att vi skriver translationen först och skalningen sedan när vi multiplicerar matriserna. Matrismultiplikation
är inte kommutativ, så ordningen är viktig. När man multiplicerar matriser multipliceras den matris som står längst
till höger först med vektorn, så du ska läsa multiplikationerna från höger till vänster. Det rekommenderas att först
skala, sedan rotera och sist translatera när man kombinerar matriser; annars kan de påverka varandra (negativt). Om
du till exempel först translaterar och sedan skalar, skalas translationsvektorn också!

Om vi tillämpar den slutliga transformationsmatrisen på vår vektor får vi följande vektor:

```text
| 2  0  0  1 |   | x |   | 2x + 1 |
| 0  2  0  2 |   | y |   | 2y + 2 |
| 0  0  2  3 | · | z | = | 2z + 3 |
| 0  0  0  1 |   | 1 |   | 1      |
```

Utmärkt! Vektorn skalas först med två och translateras sedan med (1, 2, 3). I allmänhet sätts en modells matris
samman som M = T · R · S: vertices skalas, roteras och translateras sedan.

```quiz
M = Trans · Scale, där Scale skalar med 2 och Trans translaterar med (1, 2, 3). Vad är M · (1, 1, 1, 1)?
- [x] (3, 4, 5, 1)
- [ ] (4, 6, 8, 1)
- [ ] (2, 3, 4, 1)
---
Matrisen närmast vektorn tillämpas först: skalningen ger (2, 2, 2), sedan ger translationen (3, 4, 5). (4, 6, 8) är vad Scale · Trans skulle ge – först translation till (2, 3, 4), sedan skalning, så att translationen också skalas.
```

:::d3d12
> Kom ihåg de här matriserna och den här ordningen, men vet att DirectXMath – matematikbiblioteket du använder med
> DirectX 12 – skriver dem alla *transponerade*, och att dess produkter läses i motsatt riktning. Avsnittet
> *I praktiken* förklarar varför; själva transformationerna är exakt desamma.
:::

## I praktiken

Nu när vi har gått igenom all teori bakom transformationer är det dags att se hur vi faktiskt kan använda den här
kunskapen till vår fördel.

:::opengl
OpenGL har ingen inbyggd kunskap om matriser eller vektorer, så vi måste definiera egna matematikklasser och
funktioner. I den här kursen vill vi hellre slippa alla små matematiska detaljer och helt enkelt använda färdiga
matematikbibliotek. Som tur är finns det ett lättanvänt matematikbibliotek skräddarsytt för OpenGL som heter GLM.

### GLM

GLM står för Open**GL** **M**athematics och är ett *header-only*-bibliotek, vilket betyder att vi bara behöver
inkludera rätt headerfiler; ingen länkning eller kompilering behövs. I den inbyggda miljön finns det redan. Det mesta
av GLM:s funktionalitet som vi behöver finns i 3 headerfiler, som vi inkluderar så här:

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
```

`glm.hpp` har typerna (`glm::vec3`, `glm::vec4`, `glm::mat4` …), `matrix_transform.hpp` funktionerna som bygger
transformationsmatriser, och `type_ptr.hpp` har `glm::value_ptr`, som vi behöver för att lämna över en matris till
OpenGL.

Låt oss se om vi kan använda våra kunskaper om transformationer genom att translatera vektorn (1, 0, 0) med (1, 1, 0)
(observera att vi definierar den som en `glm::vec4` med den homogena koordinaten satt till 1.0). Det här är bara ett
exempel, inte en del av projektet:

```cpp
glm::vec4 vec(1.0f, 0.0f, 0.0f, 1.0f);
glm::mat4 trans = glm::mat4(1.0f);
trans = glm::translate(trans, glm::vec3(1.0f, 1.0f, 0.0f));
vec = trans * vec;
std::cout << vec.x << vec.y << vec.z << std::endl;
```

Först definierar vi en vektor `vec` med GLM:s inbyggda vektorklass. Sedan definierar vi en `mat4` och initierar den
uttryckligen till identitetsmatrisen genom att sätta diagonalen till 1.0; om vi inte initierar den till
identitetsmatrisen blir den en nollmatris (alla element 0), och alla efterföljande matrisoperationer blir också en
nollmatris (sedan GLM 0.9.9 är matriser inte längre identitetsmatrisen som standard).

Nästa steg är att skapa en transformationsmatris genom att skicka identitetsmatrisen till funktionen
`glm::translate` tillsammans med en translationsvektor (den givna matrisen multipliceras då med en
translationsmatris och resultatet returneras). Sedan multiplicerar vi vektorn med transformationsmatrisen och skriver
ut resultatet. Om vi minns hur translation med matriser fungerar ska resultatet bli (1 + 1, 0 + 1, 0 + 0), alltså
(2, 1, 0). Kodsnutten skriver ut `210`, så translationsmatrisen gjorde sitt jobb.

Lägg märke till hur GLM-anropen bygger produkten: `glm::translate(trans, …)` returnerar `trans · T` – den nya
matrisen multipliceras från **höger**. GLM skriver vektorer som kolumner, precis som matematiken ovan, och
`trans * vec` multiplicerar matrisen med kolumnvektorn.
:::
:::vulkan
Vulkan har inte heller någon inbyggd kunskap om matriser eller vektorer, så vi använder samma matematikbibliotek som
learnopengl och vulkan-tutorial: GLM. Ditt projekt har använt det sedan *Hello Triangle* för `glm::vec3` och
`glm::vec2` i `struct Vertex`.

### GLM

GLM står för Open**GL** **M**athematics och är ett *header-only*-bibliotek, vilket betyder att vi bara behöver
inkludera rätt headerfiler; ingen länkning eller kompilering behövs. Trots namnet fungerar det med alla API:er – det
räknar bara. Utöver `<glm/glm.hpp>`, som projektet redan inkluderar, behöver vi en header till för funktionerna som
bygger transformationsmatriser:

```cpp
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
```

(learnopengl inkluderar även `<glm/gtc/type_ptr.hpp>` för `glm::value_ptr`, som OpenGL behöver för att ta emot en
matris. Vi kopierar i stället matrisen till en struct, så vi behöver den inte.)

Låt oss se om vi kan använda våra kunskaper om transformationer genom att translatera vektorn (1, 0, 0) med (1, 1, 0)
(observera att vi definierar den som en `glm::vec4` med den homogena koordinaten satt till 1.0). Det här är bara ett
exempel, inte en del av projektet:

```cpp
glm::vec4 vec(1.0f, 0.0f, 0.0f, 1.0f);
glm::mat4 trans = glm::mat4(1.0f);
trans = glm::translate(trans, glm::vec3(1.0f, 1.0f, 0.0f));
vec = trans * vec;
std::cout << vec.x << vec.y << vec.z << std::endl;
```

Först definierar vi en vektor `vec` med GLM:s inbyggda vektorklass. Sedan definierar vi en `mat4` och initierar den
uttryckligen till identitetsmatrisen genom att sätta diagonalen till 1.0; om vi inte initierar den till
identitetsmatrisen blir den en nollmatris (alla element 0), och alla efterföljande matrisoperationer blir också en
nollmatris (sedan GLM 0.9.9 är matriser inte längre identitetsmatrisen som standard).

Nästa steg är att skapa en transformationsmatris genom att skicka identitetsmatrisen till funktionen
`glm::translate` tillsammans med en translationsvektor (den givna matrisen multipliceras då med en
translationsmatris och resultatet returneras). Sedan multiplicerar vi vektorn med transformationsmatrisen och skriver
ut resultatet: (1 + 1, 0 + 1, 0 + 0), alltså (2, 1, 0). Kodsnutten skriver ut `210`, så translationsmatrisen gjorde
sitt jobb.

Lägg märke till hur GLM-anropen bygger produkten: `glm::translate(trans, …)` returnerar `trans · T` – den nya
matrisen multipliceras från **höger**. GLM skriver vektorer som kolumner, precis som matematiken ovan, och
`trans * vec` multiplicerar matrisen med kolumnvektorn.
:::
:::d3d12
Direct3D 12 har ingen inbyggd kunskap om matriser eller vektorer, så vi använder ett matematikbibliotek. Microsoft
levererar ett med Windows SDK, och alla D3D12-exempel använder det: **DirectXMath**. Det är header-only; ditt projekt
har inkluderat `<DirectXMath.h>` (med `using namespace DirectX;`) sedan *Hello Triangle* för `XMFLOAT3` och
`XMFLOAT2` i `struct Vertex`.

### DirectXMath

DirectXMath har två sorters typer:

- **Beräkningstyper**: `XMVECTOR` (fyra floats) och `XMMATRIX` (en 4×4-matris av floats). De motsvarar
  SIMD-register, måste vara 16-bytesjusterade och är tänkta för lokala variabler, parametrar och returvärden – det
  är här matematiken sker.
- **Lagringstyper**: `XMFLOAT2`, `XMFLOAT3`, `XMFLOAT4`, `XMFLOAT4X4` med flera – vanliga structar av floats utan
  krav på justering, tänkta för dina datastrukturer. `XMLoadFloat4x4` gör om en `XMFLOAT4X4` till en `XMMATRIX`,
  `XMStoreFloat4x4` gör tvärtom.

Funktionerna som bygger transformationsmatriser är `XMMatrixScaling(sx, sy, sz)`, `XMMatrixTranslation(tx, ty,
tz)`, `XMMatrixRotationX/Y/Z(angle)` och `XMMatrixRotationAxis(axis, angle)`, alla med vinklar i radianer;
`XMConvertToRadians(degrees)` räknar om. `XMMatrixIdentity()` returnerar identitetsmatrisen.

#### Radvektorer

Det finns en stor skillnad mot matematiken ovan. Läroboken (och GLM, och learnopengl) skriver en vektor som en
**kolumn** och sätter matrisen till vänster om den: v' = M · v. DirectXMath skriver en vektor som en **rad** och
sätter matrisen till höger om den: v' = v · M. För att det ska ge samma resultat är varje DirectXMath-matris
*transponatet* av lärobokens matris – rader och kolumner har bytt plats. Translationsmatrisen har till exempel sin
translation i den nedersta **raden** i stället för i den högra kolumnen:

```text
                     | 1   0   0   0 |
| x  y  z  1 |   ·   | 0   1   0   0 |   =   | x + Tx  y + Ty  z + Tz  1 |
                     | 0   0   1   0 |
                     | Tx  Ty  Tz  1 |
```

Att transponera en produkt vänder på ordningen: (A · B)ᵀ = Bᵀ · Aᵀ. Lärobokens Trans · Scale ("skala först, sedan
translatera", läst från höger till vänster) blir alltså `XMMatrixScaling(…) * XMMatrixTranslation(…)` i
DirectXMath – och det läses från **vänster till höger**: v · S · T skalar först v och translaterar den sedan. Den
ordning du skriver en DirectXMath-produkt i är den ordning stegen sker i.

Låt oss prova genom att translatera vektorn (1, 0, 0) med (1, 1, 0) (observera att den homogena koordinaten är 1.0).
Det här är bara ett exempel, inte en del av projektet:

```cpp
XMVECTOR vec = XMVectorSet(1.0f, 0.0f, 0.0f, 1.0f);
XMMATRIX trans = XMMatrixTranslation(1.0f, 1.0f, 0.0f);
vec = XMVector4Transform(vec, trans);
// XMVectorGetX(vec), XMVectorGetY(vec), XMVectorGetZ(vec) are 2, 1 and 0
```

`XMVector4Transform(v, M)` räknar ut v · M. Resultatet är (1 + 1, 0 + 1, 0 + 0) = (2, 1, 0): translationsmatrisen
gjorde sitt jobb. Till skillnad från GLM:s `glm::mat4`, som du själv måste initiera till identitetsmatrisen,
returnerar varje `XMMatrix…`-funktion en fullständig matris, så det finns inget att initiera.
:::

### Projektet

:::opengl
Det här kapitlets projekt fortsätter där kapitlet *Texturer* slutade efter uppgiften **texture-units** – lådan med
den svaga smileyn, `mix(…, 0.2)` – städat på samma sätt som learnopengls `transformations.cpp`: vertexfärgerna, som
fragment shadern inte längre använde, är borta. Varje vertex består nu av en position och texturkoordinater (5
floats, stride `5 * sizeof(float)`), och texturkoordinaterna är attribut 1:

```cpp
    float vertices[] = {
        // positions          // texture coords
         0.5f,  0.5f, 0.0f,   1.0f, 1.0f, // top right
         0.5f, -0.5f, 0.0f,   1.0f, 0.0f, // bottom right
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, // bottom left
        -0.5f,  0.5f, 0.0f,   0.0f, 1.0f  // top left
    };
```

I renderingsloopen aktiveras shadern under `// activate shader`, och en `// TODO:` visar var transformationen ska in,
precis innan lådan ritas.
:::
:::vulkan
Det här kapitlets projekt fortsätter där kapitlet *Texturer* slutade efter uppgiften **texture-units** – lådan med
den svaga smileyn, `mix(…, 0.2)` – förberett för learnopengls vertexdata. Vertexfärgerna, som fragment shadern inte
längre använde, är borta: `struct Vertex { glm::vec3 pos; glm::vec2 texCoord; }` med location 0 = `pos` och
location 1 = `texCoord`. Och rektangeln är nu learnopengls, i dess ordning och **med +y uppåt**:

```cpp
// learnopengl's rectangle: +y points up (the vertex shader flips y for Vulkan).
// v = 0 is the top row of the image in Vulkan, so the texture coordinates are upright without flipping the image.
const std::vector<Vertex> vertices = {
    {{0.5f, 0.5f, 0.0f}, {1.0f, 0.0f}},   // top right
    {{0.5f, -0.5f, 0.0f}, {1.0f, 1.0f}},  // bottom right
    {{-0.5f, -0.5f, 0.0f}, {0.0f, 1.0f}}, // bottom left
    {{-0.5f, 0.5f, 0.0f}, {0.0f, 0.0f}}   // top left
};

const std::vector<uint16_t> indices = {
    0, 1, 3, // first triangle
    1, 2, 3  // second triangle
};
```

#### Varför vertex shadern vänder på y

Kom ihåg från *Hello Triangle* att y-axeln i Vulkans clip space pekar **nedåt**. Matematiken i det här kapitlet –
och GLM:s funktioner – utgår från de vanliga matematiska axlarna, x åt höger och y **uppåt**: en positiv rotation
kring z vrider moturs, och en translation med (0.5, −0.5) flyttar nedåt till höger. I Vulkans rum med y nedåt skulle
samma matriser ge en spegelvänd bild: rotationen skulle vrida medurs på skärmen och translationen skulle flytta lådan
*uppåt* till höger.

Därför räknar vi i ett rum med y uppåt, som learnopengl, och vänder på y allra sist, **efter** transformationen:

```glsl
void main() {
    gl_Position = vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
```

Det är därför vertices ovan har +y uppåt (uppe till höger är (0.5, 0.5)), och därför är texturkoordinaterna
learnopengls med v vänt: learnopengl vänder bilderna när de läses in, det gör inte vi, eftersom v = 0 i Vulkan är
bildens översta rad. Med vändningen på plats ger varje GLM-matris nedan exakt learnopengls bild. I nästa kapitel
flyttar vändningen in i projektionsmatrisen (`proj[1][1] *= -1`), som i vulkan-tutorial.

Vändningen håller också culling nöjd. På skärmen går båda trianglarna (uppe till höger → nere till höger → uppe till
vänster, och nere till höger → nere till vänster → uppe till vänster) medurs, så pipelinens
`cullMode = VK_CULL_MODE_BACK_BIT` med `frontFace = VK_FRONT_FACE_CLOCKWISE` behåller dem. Utan vändningen skulle
rektangeln vara spegelvänd, dess trianglar skulle gå moturs på skärmen, och båda skulle cullas bort. Rotationer,
translationer och likformiga skalningar (även med en negativ faktor, som du ser i övningarna) speglar aldrig
rektangeln, så inget cullas bort i det här kapitlet.

Kommentarerna `// TODO:` visar fyra ställen: `struct PushConstants` före klassen, push constant-intervallet i
`createGraphicsPipeline()`, matrisen och `vkCmdPushConstants` i `recordCommandBuffer()` (mellan
`vkCmdBindDescriptorSets` och `vkCmdDrawIndexed`), och push constant-blocket i `shader.vert`.
:::
:::d3d12
Det här kapitlets projekt fortsätter där kapitlet *Texturer* slutade efter uppgiften **texture-units** – lådan med
den svaga smileyn, `lerp(…, …, 0.2f)` – utan färgen per vertex, som pixel shadern inte längre använde:
`struct Vertex { XMFLOAT3 position; XMFLOAT2 texCoord; };` med inputelementen `POSITION` på offset 0 och `TEXCOORD`
på offset 12. Rektangeln är learnopengls, i dess ordning:

```cpp
        Vertex vertices[] =
        {
            // position               texture coords
            { { 0.5f, 0.5f, 0.0f },   { 1.0f, 0.0f } },    // top right
            { { 0.5f, -0.5f, 0.0f },  { 1.0f, 1.0f } },    // bottom right
            { { -0.5f, -0.5f, 0.0f }, { 0.0f, 1.0f } },    // bottom left
            { { -0.5f, 0.5f, 0.0f },  { 0.0f, 0.0f } }     // top left
        };
```

Direct3D:s clip space har y uppåt, precis som OpenGL:s, så kapitlets matematik fungerar på skärmen precis som den
ritats: en positiv rotation kring z vrider moturs och en translation med (0.5, −0.5) flyttar nedåt till höger.
Texturkoordinaterna börjar i bildens övre vänstra hörn, som i förra kapitlet.

Root signaturen har hittills en parameter: parameter 0, descriptor-tabellen med de två texturerna. Kommentarerna
`// TODO:` visar root signature-blocket i `LoadAssets()` och stället före `DrawIndexedInstanced` i
`PopulateCommandList()`.
:::

Kommentarerna `// TODO:` visar var din kod ska in. Efter varje uppgift trycker du på **Build & run** (Ctrl+Enter) för
att kompilera programmet och köra det i den inbyggda simulatorn.

### Att få matrisen till shadern

Nu gör vi något mer intressant och skalar och roterar lådan från förra kapitlet. Vi skalar den till halva storleken
och roterar den 90 grader moturs kring z-axeln.

:::opengl
Först skapar vi transformationsmatrisen i renderingsloopen, efter `ourShader.use();`:

```cpp
        // create transformations
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));
```

Först skalar vi lådan med 0.5 längs varje axel och sedan roterar vi den 90 grader kring z-axeln. GLM vill ha vinklar
i radianer, så vi räknar om graderna till radianer med `glm::radians`. Observera att den texturerade rektangeln ligger
i XY-planet, så vi vill rotera kring z-axeln. Tänk på att axeln vi roterar kring ska vara en enhetsvektor, så
normalisera vektorn först om du inte roterar kring X-, Y- eller Z-axeln. Eftersom varje GLM-anrop multiplicerar från
höger är `transform` R · S, som skalar först och roterar sedan – läs anropen nerifrån och upp. Och eftersom vi bygger
matrisen varje bildruta räknas den om före varje ritning.

Nästa stora fråga är: hur får vi transformationsmatrisen till shadrarna? Vi nämnde kort tidigare att GLSL också har
en `mat4`-typ. Så vi ändrar vertex shadern så att den tar emot en `mat4`-uniform och multiplicerar positionsvektorn
med matrisen:

```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoord;

uniform mat4 transform;

void main()
{
    gl_Position = transform * vec4(aPos, 1.0);
    TexCoord = vec2(aTexCoord.x, aTexCoord.y);
}
```

> GLSL har också typerna `mat2` och `mat3`, som tillåter swizzling-liknande operationer precis som vektorer. Alla
> matematiska operationer som nämnts ovan (som multiplikation av skalär och matris, matris och vektor samt matris och
> matris) är tillåtna på matristyperna. Där speciella matrisoperationer används förklarar vi vad som händer.

Vi lade till uniformen och multiplicerade positionsvektorn med transformationsmatrisen innan den skickas till
`gl_Position`. Lådan ska nu vara hälften så stor och roterad 90 grader (lutad åt vänster). Vi måste dock fortfarande
skicka transformationsmatrisen till shadern:

```cpp
        // get matrix's uniform location and set matrix
        unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
        glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));
```

Först frågar vi efter uniformvariabelns location och sedan skickar vi matrisdatan till shadrarna med `glUniform` med
suffixet `Matrix4fv`. Det första argumentet känner du igen vid det här laget: uniformens location. Det andra talar om
för OpenGL hur många matriser vi vill skicka, alltså 1. Det tredje frågar om vi vill transponera matrisen, det vill
säga byta plats på kolumner och rader. OpenGL-utvecklare använder ofta en intern matrislayout som kallas
*column-major-ordning* (kolumnvis), och det är GLM:s standardlayout: de 16 floats lagras kolumn för kolumn, så
translationen i en translationsmatris hamnar i element 12, 13 och 14. Eftersom GLM redan lagrar matrisen så som OpenGL
förväntar sig behöver vi inte transponera den; vi kan låta den vara `GL_FALSE`. Den sista parametern är själva
matrisdatan som en pekare till floats; GLM:s inbyggda funktion `value_ptr` returnerar en pekare till den första av
matrisens 16 floats.

Gör nu den första uppgiften, **transform-uniform**: inkludera de tre GLM-headrarna efter `stb_image.h`, ersätt
`// TODO:` med raderna ovan och lägg till uniformen i `shader.vs`.
:::
:::vulkan
I learnopengl är matrisen en *uniform*. Vulkan har också uniform buffers, men för ett litet värde per ritning som
ändras varje bildruta är *push constants* enklare – du använde dem i kapitlen *Shaders* och *Texturer*. En `mat4` är
16 floats, 64 bytes; alla Vulkan-implementationer erbjuder minst 128 bytes push constants (`maxPushConstantsSize`),
så den får plats.

Vertex shadern deklarerar blocket och multiplicerar positionen med matrisen, **före** y-vändningen:

```glsl
#version 450

layout(push_constant) uniform PushConstants {
    mat4 transform;
} pc;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec2 inTexCoord;

layout(location = 0) out vec2 fragTexCoord;

void main() {
    gl_Position = pc.transform * vec4(inPosition, 1.0);
    // learnopengl's +y points up, Vulkan's clip space +y points down: flip y
    gl_Position.y = -gl_Position.y;
    fragTexCoord = inTexCoord;
}
```

> GLSL har också typerna `mat2` och `mat3`. Alla matematiska operationer som nämnts ovan (som multiplikation av
> skalär och matris, matris och vektor samt matris och matris) är tillåtna på matristyperna. `pc.transform *
> vec4(inPosition, 1.0)` multiplicerar matrisen med en kolumnvektor, precis som matematiken ovan.

På C++-sidan behöver vi en struct med samma layout, ovanför klassen:

```cpp
// The same layout as the push constant block in the vertex shader (a mat4 is 64 bytes).
struct PushConstants {
    glm::mat4 transform;
};
```

Byten stämmer utan någon konvertering: GLM lagrar sina matriser *column-major* (de 16 floats kolumn för kolumn, så en
translation hamnar i element 12, 13 och 14), och GLSL läser också en `mat4` i ett push constant-block column-major
som standard.

Pipeline layouten måste tala om att det finns push constants. Den här gången läser vertex shadern dem, så intervallet
anger vertex-steget:

```cpp
        VkPushConstantRange pushConstantRange{};
        pushConstantRange.stageFlags = VK_SHADER_STAGE_VERTEX_BIT;
        pushConstantRange.offset = 0;
        pushConstantRange.size = sizeof(PushConstants);
```

och `pipelineLayoutInfo` använder det:

```cpp
        pipelineLayoutInfo.pushConstantRangeCount = 1;
        pipelineLayoutInfo.pPushConstantRanges = &pushConstantRange;
```

Till sist bygger `recordCommandBuffer()` matrisen och pushar den, efter `vkCmdBindDescriptorSets` och före
ritningen:

```cpp
        // create transformations
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::rotate(transform, glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::scale(transform, glm::vec3(0.5f, 0.5f, 0.5f));

        // push the matrix to the vertex shader: it is used by the draws recorded after this
        PushConstants constants{};
        constants.transform = transform;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);
```

Först skalar vi lådan med 0.5 längs varje axel och sedan roterar vi den 90 grader kring z-axeln. GLM vill ha vinklar
i radianer, så vi räknar om graderna till radianer med `glm::radians`. Rektangeln ligger i XY-planet, så vi roterar
kring z-axeln; tänk på att axeln ska vara en enhetsvektor. Eftersom varje GLM-anrop multiplicerar från höger är
`transform` R · S, som skalar först och roterar sedan – läs anropen nerifrån och upp.

`vkCmdPushConstants` kopierar de 64 byten in i command buffern, och varje ritning som spelas in efter den ser dem.
Eftersom `drawFrame()` spelar in command buffern på nytt varje bildruta byggs matrisen också om varje bildruta.

Gör nu den första uppgiften, **transform-uniform**: inkludera `<glm/gtc/matrix_transform.hpp>` och ersätt de fyra
`// TODO:`-kommentarerna med koden ovan.
:::
:::d3d12
I learnopengl är matrisen en *uniform*. Direct3D 12:s motsvarighet för ett litet värde per ritning är *root
constants* – du använde dem i kapitlen *Shaders* och *Texturer*. En 4×4-matris av floats är 16 floats, så den tar 16
root constants på 32 bitar. En root signature rymmer högst 64 DWORDs (32-bitarsvärden); descriptor-tabellen kostar 1
och matrisen 16, så vi har gott om plats.

På C++-sidan beskriver en struct konstanterna, bredvid `Vertex`:

```cpp
    // The root constants: what the vertex shader sees as cbuffer TransformConstants.
    // A 4x4 matrix is 16 floats: 16 32-bit root constants.
    struct TransformConstants
    {
        XMFLOAT4X4 transform;
    };
```

Den innehåller en `XMFLOAT4X4`, lagringstypen, inte en `XMMATRIX`. Root signaturen får en andra parameter, root
constants för register `b0`, som bara vertex shadern läser:

```cpp
        // Root parameter 1: root constants for register b0 (the transformation
        // matrix). Only the vertex shader reads them.
        CD3DX12_ROOT_PARAMETER rootParameters[2];
        rootParameters[0].InitAsDescriptorTable(1, &ranges[0], D3D12_SHADER_VISIBILITY_PIXEL);
        rootParameters[1].InitAsConstants(sizeof(TransformConstants) / 4, 0, 0, D3D12_SHADER_VISIBILITY_VERTEX);
```

`sizeof(TransformConstants) / 4` är 64 / 4 = 16 konstanter, i shaderregister 0 (`b0`) i registerrymd 0.

I `PopulateCommandList()`, före ritningen, bygger vi matrisen och sätter den:

```cpp
    // Create the transformation: scale to half the size, then rotate by 90 degrees
    // about the z axis. DirectXMath multiplies a row vector by the matrices (v * M),
    // so they apply from left to right: first the scaling, then the rotation.
    XMMATRIX transform = XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixRotationZ(XMConvertToRadians(90.0f));

    // Root parameter 1: the matrix for the vertex shader. It is stored transposed,
    // because HLSL reads a matrix from memory column by column (column_major).
    TransformConstants transformConstants = {};
    XMStoreFloat4x4(&transformConstants.transform, XMMatrixTranspose(transform));
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(TransformConstants) / 4, &transformConstants, 0);
```

Produkten läses från vänster till höger: skala till halva storleken, rotera sedan 90° (`XMConvertToRadians` gör om
grader till de radianer DirectXMath vill ha). Rektangeln ligger i XY-planet, så vi roterar kring z-axeln. På vår
skärm, med x åt höger och y uppåt, vrider en positiv vinkel lådan moturs, precis som Z-rotationsmatrisen ovan.
`SetGraphicsRoot32BitConstants(1, 16, &transformConstants, 0)` kopierar de 16 värdena till root-parameter 1, med
början i konstant 0.

Shadern deklarerar root constants som en constant buffer i `b0` och multiplicerar positionen:

```hlsl
// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer TransformConstants : register(b0)
{
    float4x4 transform;
};
```

```hlsl
    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    // The position is a row vector: mul(position, transform) applies the matrix
    // the same way as DirectXMath's v * M.
    result.position = mul(position, transform);
```

#### Varför XMMatrixTranspose, och varför mul(position, transform)

Två konventioner möts här, och transponeringen får dem att passa ihop:

- `XMFLOAT4X4` lagrar sina 16 floats **rad för rad** (`_11 _12 _13 _14`, sedan `_21` …). Det kallas *row-major*
  (radvis) lagring.
- HLSL läser som standard en matris i en constant buffer **kolumn för kolumn** (*column_major*-packning): de fyra
  första floats blir första kolumnen i `transform`, de fyra nästa andra kolumnen och så vidare.

Om vi lagrade M som den är skulle dess rader komma fram som shadermatrisens kolumner: shadern skulle se Mᵀ. Att lagra
`XMMatrixTranspose(M)` lägger M:s kolumner efter varandra i minnet, så shaderns `transform` blir lika med M.

HLSL:s `mul(x, y)` behandlar en vektor som en radvektor när den är första argumentet. `mul(position, transform)`
räknar alltså ut position · M – exakt DirectXMaths v · M – och vertexen skalas och roteras sedan, precis som på
CPU:n. Det är den kombination Microsofts exempel använder (till exempel D3D12Bundles: `XMMatrixTranspose(…)` på CPU:n
och `mul(float4(position, 1.0f), g_mWorldViewProj)` i shadern).

> Du kan se kod som hoppar över transponeringen och skriver `mul(transform, position)`, eller som deklarerar matrisen
> `row_major`. Det fungerar också – det är samma multiplikation skriven på ett annat sätt. Det viktiga är att
> lagringen, packningen och ordningen i `mul` passar ihop; vi följer exemplen.

Gör nu den första uppgiften, **transform-uniform**: lägg till structen, ersätt de två `// TODO:`-kommentarerna i
`main.cpp` med koden ovan och lägg till `cbuffer` och `mul` i `shaders.hlsl`.
:::

Resultatet: lådan är hälften så stor och vriden ett kvarts varv moturs, med sin översida åt vänster – hjärtat, som
låg till höger om ansiktets mitt, ligger nu ovanför den. Du märker att bilden ser lite förvrängd ut: vi arbetar
fortfarande i normaliserade enhetskoordinater, som är utsträckta över det 4:3-formade fönstret. Före vridningen var
lådan i halv storlek 200 pixlar bred och 150 hög; efter den sträcker sig bildens bredd över 150 pixlar och dess höjd
över 200. Nästa kapitel löser det med en projektionsmatris.

:::opengl
```quiz
Varför är det tredje argumentet till `glUniformMatrix4fv` `GL_FALSE` här?
- [x] GLM lagrar redan sina matriser kolumn för kolumn, den layout OpenGL förväntar sig, så inget behöver transponeras
- [ ] `GL_FALSE` betyder att matrisvärdena inte normaliseras till 0..1
- [ ] GLM lagrar sina matriser rad för rad, och `GL_FALSE` säger åt OpenGL att byta plats på rader och kolumner
---
Det tredje argumentet frågar om OpenGL ska transponera matrisen. GLM:s column-major-lagring är redan det OpenGL förväntar sig, så `glm::value_ptr` kan lämna över de 16 floats som de är.
```
:::
:::vulkan
```quiz
Varför negerar `shader.vert` `gl_Position.y` efter multiplikationen med `pc.transform`?
- [x] GLM-matriserna byggs i learnopengls koordinater med +y uppåt, medan +y pekar nedåt i Vulkans clip space; att vända på slutet ger samma bild som i learnopengl
- [ ] Push constants kommer fram upp och ner i shadern och måste rättas till
- [ ] Vändningen rättar bara till texturkoordinaterna, som Vulkan läser nerifrån och upp
---
All matematik – rotationer moturs, en translation nedåt till höger – förutsätter y uppåt. Att vända efter transformationen gör om den färdiga positionen med y uppåt till Vulkans clip space med y nedåt. Utan vändningen skulle bilden vara spegelvänd (och dess trianglar, nu moturs på skärmen, skulle cullas bort).
```
:::
:::d3d12
```quiz
Varför skickas matrisen genom `XMMatrixTranspose` innan den lagras i root constants?
- [x] `XMFLOAT4X4` lagrar matrisen rad för rad, men HLSL läser en matris i en cbuffer kolumn för kolumn; efter transponeringen är shaderns `transform` lika med M, och `mul(position, transform)` räknar ut v · M
- [ ] Root constants måste alltid transponeras, oavsett typ
- [ ] Den gör om rotationen moturs till den rotation medurs som Direct3D förväntar sig
---
Transponeringen tar ut skillnaden mellan DirectXMaths radvisa lagring och HLSL:s kolumnvisa standardpackning (column_major). Med positionen som första argument till `mul` multiplicerar shadern en radvektor med M, precis som DirectXMath på CPU:n.
```
:::

### Transformationernas ordning

Låt oss se om vi kan rotera lådan över tid, och för skojs skull flyttar vi den också till fönstrets nedre högra del.
För att rotera lådan över tid måste vi uppdatera transformationsmatrisen i renderingsloopen, eftersom den måste
ändras varje bildruta. Vi använder tiden för att få en vinkel som ändras över tid.

:::opengl
```cpp
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
```

`glfwGetTime()` returnerar antalet sekunder sedan GLFW initierades, och vi använder det direkt som vinkel i
radianer: ett helt varv var 2π ≈ 6.3 sekund.

Tänk på att vi i förra fallet kunde deklarera transformationsmatrisen var som helst, men nu måste vi skapa den i
varje iteration för att hela tiden uppdatera rotationen. Det betyder att vi måste skapa transformationsmatrisen på
nytt i varje varv i renderingsloopen. När man renderar scener har man oftast flera transformationsmatriser som skapas
på nytt med nya värden varje bildruta.

Här roterar vi först lådan kring origo (0, 0, 0), och när den har roterats translaterar vi den roterade versionen
till skärmens nedre högra hörn. Kom ihåg att den faktiska ordningen ska läsas baklänges: även om vi i koden först
translaterar och sedan roterar, tillämpas först en rotation och sedan en translation: `transform` är T · R, och R
ligger närmast vertexen.

Gör nu uppgiften **translate-rotate**: ersätt rotations- och skalningsraderna med de två raderna ovan.
:::
:::vulkan
```cpp
        glm::mat4 transform = glm::mat4(1.0f); // make sure to initialize matrix to identity matrix first
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
```

`glfwGetTime()` returnerar antalet sekunder sedan GLFW initierades (learnopengl använder den också), och vi använder
det direkt som vinkel i radianer: ett helt varv var 2π ≈ 6.3 sekund. `recordCommandBuffer()` körs varje bildruta, så
tiden läses på nytt varje bildruta och matrisen som pushas ändras med den.

Här roterar vi först lådan kring origo (0, 0, 0), och när den har roterats translaterar vi den roterade versionen
till skärmens nedre högra hörn. Kom ihåg att den faktiska ordningen ska läsas baklänges: även om vi i koden först
translaterar och sedan roterar, tillämpas först en rotation och sedan en translation: `transform` är T · R, och R
ligger närmast vertexen. (Vändningen av y kommer efter allt detta, så "nere till höger" är verkligen nere till
höger.)

Gör nu uppgiften **translate-rotate**: ersätt rotations- och skalningsraderna med de två raderna ovan.
:::
:::d3d12
Vårt D3D12-program har ingen GLFW, så det mäter tiden själv med `std::chrono`, på samma sätt som vulkan-tutorial
(`#include <chrono>`):

```cpp
    // The time in seconds since the first frame.
    static auto startTime = std::chrono::high_resolution_clock::now();
    auto currentTime = std::chrono::high_resolution_clock::now();
    float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

    // Create the transformation: rotate about the z axis by the time (in radians),
    // then move to the bottom right. DirectXMath multiplies a row vector by the
    // matrices (v * M), so they apply from left to right.
    XMMATRIX transform = XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f);
```

`startTime` är `static`, så den sätts en gång, i den första bildrutan; `time` är antalet sekunder sedan dess, och vi
använder det direkt som vinkel i radianer: ett helt varv var 2π ≈ 6.3 sekund. `PopulateCommandList()` körs varje
bildruta, så matrisen byggs om varje bildruta.

Här roterar vi först lådan kring origo (0, 0, 0), och när den har roterats translaterar vi den roterade versionen
till skärmens nedre högra hörn. learnopengl skriver detta i GLM som `translate` följt av `rotate` och säger att man
ska läsa det baklänges. Med DirectXMath behöver du inte det: produkten `R * T` skrivs i den ordning stegen sker –
rotera, sedan translatera.

Gör nu uppgiften **translate-rotate**: lägg till `#include <chrono>` och ersätt raden som bygger `transform` med koden
ovan.
:::

Om du har gjort rätt ser du en låda i full storlek som snurrar moturs kring sin egen mitt i fönstrets nedre högra
hörn – delvis utanför fönstret.

:::opengl vulkan
```quiz
Koden gör `transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));` och sedan `transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));`. Vad händer med lådans vertices?
- [x] De roteras först kring origo (lådans egen mitt) och flyttas sedan nedåt till höger: lådan snurrar på stället nere till höger
- [ ] De flyttas först nedåt till höger och roteras sedan kring fönstrets mitt: lådan cirklar runt mitten
- [ ] Ordningen mellan de två anropen spelar ingen roll; båda ordningarna ger samma bild
---
Varje GLM-anrop multiplicerar den nya matrisen från höger, så `transform` är T · R. Matrisen närmast vertexen, R, tillämpas först: läs anropen nerifrån och upp.
```
:::
:::d3d12
```quiz
Koden bygger `XMMatrixRotationZ(time) * XMMatrixTranslation(0.5f, -0.5f, 0.0f)`. Vad händer med lådans vertices?
- [x] De roteras först kring origo (lådans egen mitt) och flyttas sedan nedåt till höger: lådan snurrar på stället nere till höger
- [ ] De flyttas först nedåt till höger och roteras sedan kring fönstrets mitt: lådan cirklar runt mitten
- [ ] Ordningen mellan de två matriserna spelar ingen roll; båda ordningarna ger samma bild
---
DirectXMath använder radvektorer: v · R · T tillämpar först R, sedan T – en DirectXMath-produkt läses från vänster till höger.
```
:::

Och där har du det: en translaterad låda som roteras över tid, allt med en enda transformationsmatris! Nu förstår du
varför matriser är en så kraftfull konstruktion i grafikvärlden. Vi kan definiera hur många transformationer som
helst och kombinera dem alla i en enda matris som vi kan återanvända så ofta vi vill. Att använda transformationer på
det här sättet i vertex shadern besparar oss besväret att definiera om vertexdatan och sparar dessutom
beräkningstid, eftersom vi inte behöver skicka om datan hela tiden (vilket är ganska långsamt); allt vi behöver göra
är att uppdatera transformationens
:::opengl
uniform.
:::
:::vulkan
push constant.
:::
:::d3d12
root constants.
:::

I nästa kapitel går vi igenom hur vi kan använda matriser för att definiera olika koordinatsystem för våra vertices.
Det blir vårt första steg in i 3D-grafik!

## Övningar

1. Ta den sista transformationen av lådan och försök byta ordning, så att du först roterar och sedan translaterar.
   Se vad som händer och försök resonera kring varför det händer.
2. Försök rita en andra låda med ytterligare ett ritanrop, men placera den på en annan position enbart med hjälp av
   transformationer. Se till att den andra lådan hamnar uppe till vänster i fönstret, och skala den över tid i
   stället för att rotera den (sin-funktionen är användbar här; observera att sin gör att objektet vänds så fort en
   negativ skalning tillämpas).

Båda övningarna är kapitlets två sista uppgifter, och de bygger på varandra: programmet du slutar med har den bytta
ordningen från övning 1 och den andra lådan från övning 2.

### Rotera först, translatera sedan

:::opengl
```cpp
        // switched the order: the container is now translated first and then rotated around the origin (it orbits the centre)
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
```

Nu är `transform` R · T: vertices flyttas först nedåt till höger, och sedan roteras hela den flyttade rektangeln
kring origo – fönstrets mitt.

Gör nu uppgiften **rotate-first**.
:::
:::vulkan
```cpp
        // switched the order: the container is now translated first and then rotated around the origin (it orbits the centre)
        transform = glm::rotate(transform, (float)glfwGetTime(), glm::vec3(0.0f, 0.0f, 1.0f));
        transform = glm::translate(transform, glm::vec3(0.5f, -0.5f, 0.0f));
```

Nu är `transform` R · T: vertices flyttas först nedåt till höger, och sedan roteras hela den flyttade rektangeln
kring origo – fönstrets mitt.

Gör nu uppgiften **rotate-first**.
:::
:::d3d12
```cpp
    // Create the transformation, with the order switched: first move to the bottom
    // right, then rotate about the origin by the time - the container now circles
    // the centre of the window. (DirectXMath applies the matrices from left to right.)
    XMMATRIX transform = XMMatrixTranslation(0.5f, -0.5f, 0.0f) * XMMatrixRotationZ(time);
```

Nu flyttas vertices först nedåt till höger, och sedan roteras hela den flyttade rektangeln kring origo – fönstrets
mitt. (I learnopengls GLM-kod är detta `rotate` före `translate`.)

Gör nu uppgiften **rotate-first**.
:::

Lådan cirklar nu runt fönstrets mitt, moturs, och vrider sig med under färden, så att samma hörn hela tiden rör vid
fönstrets mitt. En rotation sker alltid kring origo; bara om objektets mitt ligger i origo snurrar objektet på
stället. Därför är "skala, rotera, translatera" den vanliga ordningen.

### En andra låda

:::opengl
För den andra lådan återställer vi `transform` till identitetsmatrisen, bygger en ny matris, laddar upp den och ritar
igen, efter det första `glDrawElements`:

```cpp
        // second transformation
        // ---------------------
        transform = glm::mat4(1.0f); // reset it to identity matrix
        transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));
        float scaleAmount = static_cast<float>(sin(glfwGetTime()));
        transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));
        glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(transform));

        // now with the uniform matrix being replaced with new transformations, draw it again.
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
```

En uniform behåller sitt värde tills du sätter den igen, och varje ritanrop använder värdet den har när anropet görs.
Det första `glDrawElements` använde den cirklande matrisen; att sätta uniformen igen ger den andra ritningen en egen.

Gör nu uppgiften **second-container**.
:::
:::vulkan
För den andra lådan återställer vi `transform` till identitetsmatrisen, bygger en ny matris, pushar den och ritar
igen, efter det första `vkCmdDrawIndexed` (`std::sin` behöver `#include <cmath>`):

```cpp
        // second transformation
        transform = glm::mat4(1.0f); // reset it to identity matrix
        transform = glm::translate(transform, glm::vec3(-0.5f, 0.5f, 0.0f));
        float scaleAmount = static_cast<float>(std::sin(glfwGetTime()));
        transform = glm::scale(transform, glm::vec3(scaleAmount, scaleAmount, scaleAmount));
        constants.transform = transform;
        vkCmdPushConstants(commandBuffer, pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT, 0, sizeof(PushConstants), &constants);

        // now with the push constants replaced with the new transformation, draw it again
        vkCmdDrawIndexed(commandBuffer, static_cast<uint32_t>(indices.size()), 1, 0, 0, 0);
```

Båda ritningarna spelas in i samma command buffer, och var och en använder de push constant-värden som spelades in
före den: den första ritningen behåller den cirklande matrisen, den andra får den nya.

Gör nu uppgiften **second-container**.
:::
:::d3d12
För den andra lådan bygger vi en ny matris, sätter root constants igen och ritar igen, efter det första
`DrawIndexedInstanced` (`std::sin` behöver `#include <cmath>`):

```cpp
    // Second transformation: scale by sin(time) (between -1 and 1), then move to
    // the top left.
    float scaleAmount = std::sin(time);
    transform = XMMatrixScaling(scaleAmount, scaleAmount, scaleAmount) * XMMatrixTranslation(-0.5f, 0.5f, 0.0f);
    XMStoreFloat4x4(&transformConstants.transform, XMMatrixTranspose(transform));
    m_commandList->SetGraphicsRoot32BitConstants(1, sizeof(TransformConstants) / 4, &transformConstants, 0);

    // Draw the container again, now with the new root constants. Root constants are
    // recorded with each draw, so the first draw keeps its own matrix.
    m_commandList->DrawIndexedInstanced(6, 1, 0, 0, 0);
```

Root-argument spelas in i command listen: varje ritning använder de root constants som sattes före den, så att ändra
dem mellan två ritningar ger varje ritning en egen matris.

Gör nu uppgiften **second-container**.
:::

Nu har du två lådor: den som cirklar runt fönstrets mitt, och en upprätt låda centrerad i fönstrets övre vänstra
fjärdedel som växer och krymper med sin(time). När sin(time) passerar 0 försvinner den, och medan värdet är negativt
kommer lådan tillbaka upp och ner.

```quiz
Den andra lådan skalas med `sin(time)`, som är negativt halva tiden. Vad ser du medan det är negativt?
- [x] Lådan upp och ner – vriden 180° – eftersom en skalning av både x och y med en negativ faktor är ett halvt varv
- [ ] Lådan spegelvänd från vänster till höger
- [ ] Ingenting: negativa skalfaktorer begränsas till noll
---
(−s·x, −s·y) är punkten (x, y) skalad med s och vriden 180°. En spegelbild skulle kräva ett udda antal negerade axlar, till exempel bara x. Eftersom bilden inte speglas behåller trianglarna sin varvordning – så även med back-face culling försvinner ingenting.
```

Grattis – din låda rör sig! Hittills sker allt i normaliserade enhetskoordinater. I nästa kapitel, *Koordinatsystem*,
använder du matriser för att bygga en 3D-värld med en kamera och en perspektivprojektion.
