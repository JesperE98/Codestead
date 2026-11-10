# PBR-teori

Det här kapitlet inleder kursens sista del: *PBR*, fysikaliskt baserad rendering. I delarna *Belysning* och *Avancerad
belysning* belyste du scener med Phong- och Blinn-Phong-modellerna: en ambient, en diffus och en spekulär term vars
styrkor du valde tills bilden såg rätt ut. PBR ersätter de handjusterade termerna med en belysningsmodell som bygger på
hur ljus faktiskt beter sig – mer eller mindre – så att en och samma uppsättning materialparametrar ser rätt ut under
alla ljusförhållanden. Delen har fyra kapitel: det här, teorin; *PBR-belysning*, som gör teorin till en shader för
punktljus; och två kapitel om *bildbaserad belysning* (image based lighting, IBL), som belyser föremålen med hela deras
omgivning: *Diffus irradians* och *Spekulär IBL*. Precis som teknikerna i de tidigare delarna är inget av detta bundet
till ett visst API. Det är matematik i shadrarna plus några texturer som räknas ut i förväg, och det fungerar likadant i
OpenGL, Vulkan och DirectX 12; kapitlen visar var {{api}} lägger det.

PBR, eller *physically based rendering* som det oftast kallas, är en samling renderingstekniker som mer eller mindre
bygger på samma underliggande teori, en teori som stämmer bättre med den fysiska världen. Eftersom fysikaliskt baserad
rendering försöker efterlikna ljus på ett fysikaliskt rimligt sätt ser den i regel mer realistisk ut än våra
ursprungliga belysningsalgoritmer som Phong och Blinn-Phong. Den ser inte bara bättre ut: eftersom den ligger nära den
verkliga fysiken kan vi (och framför allt grafikerna) skapa ytmaterial utifrån fysikaliska parametrar utan att ta till
billiga trick och justeringar för att få belysningen att se rätt ut. En av de större fördelarna med att skapa material
utifrån fysikaliska parametrar är att materialen ser rätt ut oavsett ljusförhållanden – något som inte gäller i
pipelines utan PBR.

Fysikaliskt baserad rendering är ändå en approximation av verkligheten (byggd på fysikens principer), och därför heter
det inte fysikalisk shading utan fysikaliskt *baserad* shading. För att en PBR-belysningsmodell ska räknas som
fysikaliskt baserad måste den uppfylla följande tre villkor (oroa dig inte, vi kommer till dem snart):

1. Den bygger på mikrofasettmodellen för ytor.
2. Den bevarar energin.
3. Den använder en fysikaliskt baserad BRDF.

I de här PBR-kapitlen fokuserar vi på det PBR-angreppssätt som ursprungligen utforskades av Disney och anpassades för
realtidsrendering av Epic Games. Deras angreppssätt, som bygger på det *metalliska arbetsflödet* (metallic workflow), är
hyggligt dokumenterat, används i de flesta populära motorer och ser fantastiskt ut. I slutet av delen har vi ungefär
det här: sfärer av röd plast och röd metall från blanka till sträva, belysta av fyra punktljus och av en omgivning med
himmel, kullar och lampor, och sedan samma ljus på ett texturerat material av nitat stål med rostfläckar.

Tänk på att ämnena i den här delen är ganska avancerade, så det är bra att ha god förståelse för kursens tidigare delar –
särskilt HDR och gammakorrigering, normal mapping och cube maps. Det här kapitlet har inga uppgifter: det är teorin som
de tre följande kapitlen bygger på. Projektet är redan det du ska arbeta i härnäst; du kan bygga och köra det i slutet
av kapitlet.

## Mikrofasettmodellen

Alla PBR-tekniker bygger på teorin om mikrofasetter. Teorin säger att varje yta i mikroskopisk skala kan beskrivas med
små, perfekt reflekterande speglar som kallas *mikrofasetter*. Beroende på hur sträv en yta är kan de små speglarnas
riktning variera ganska mycket: på en sträv yta pekar de åt många håll, på en slät yta är nästan alla riktade längs ytans
normal.

Ju strävare en yta är, desto mer kaotiskt är varje mikrofasett riktad längs ytan. Effekten av de små speglarnas
riktningar är att inkommande ljusstrålar – när vi talar specifikt om spekulärt ljus/reflektion – med större sannolikhet
*sprids* åt helt olika håll på strävare ytor, vilket ger en mer utbredd spekulär reflektion. På en slät yta reflekteras
ljusstrålarna däremot med större sannolikhet åt ungefär samma håll, vilket ger mindre och skarpare reflektioner.

Ingen yta är helt slät på mikroskopisk nivå, men eftersom mikrofasetterna är så små att vi inte kan skilja dem åt per
pixel approximerar vi ytans mikrofasettsträvhet statistiskt med en parameter *roughness* (strävhet). Utifrån ytans
strävhet kan vi räkna ut andelen mikrofasetter som är ungefär riktade längs en vektor **h**. Vektorn **h** är
*halvvägsvektorn* som ligger mitt emellan ljusvektorn **l** och vyvektorn **v** – den du mötte i kapitlet *Avancerad
belysning*, där Blinn-Phong använder den:

```text
          l + v
  h  =  ---------
        ‖ l + v ‖
```

Ju mer mikrofasetterna är riktade längs halvvägsvektorn, desto skarpare och starkare blir den spekulära reflektionen.
Med en strävhetsparameter som varierar mellan 0 och 1 kan vi approximera mikrofasetternas riktningar statistiskt: högre
strävhet ger en mycket större spekulär reflektion, till skillnad från den mindre och skarpare spekulära reflektionen på
släta ytor.

```quiz
Vad beskriver strävhetsparametern (roughness) i mikrofasettmodellen?
- [ ] Höjden på ytans ojämnheter, som vertex shadern använder för att flytta vertexen
- [x] Statistiskt hur kaotiskt de små spegelliknande mikrofasetterna är riktade: ju strävare yta, desto färre av dem är riktade längs en given halvvägsvektor, och desto bredare och svagare blir den spekulära reflektionen
- [ ] Hur mycket av ljuset ytan absorberar: en sträv yta är mörkare
- [ ] Normal mappens upplösning: ju strävare yta, desto fler texlar per pixel
---
Mikrofasetterna är mycket mindre än en pixel, så de modelleras inte en och en; ett enda tal säger hur de är fördelade. Ljuset som kommer in är detsamma – en sträv yta sprider sin reflektion över en större yta, så varje del av den blir svagare.
```

## Energibevarande

Mikrofasettapproximationen använder en form av *energibevarande*: den utgående ljusenergin får aldrig överstiga den
inkommande (självlysande ytor undantagna). Går man från en slät till en sträv yta blir den spekulära reflektionens yta
större, men samtidigt blir den svagare. Om den spekulära intensiteten var densamma i varje pixel (oavsett hur stor den
spekulära formen är) skulle de strävare ytorna sända ut mycket mer energi, och då vore energiprincipen bruten. Därför
ser vi spekulära reflektioner starkare på släta ytor och svagare på sträva.

För att energin ska bevaras måste vi skilja tydligt mellan diffust och spekulärt ljus. I samma ögonblick som en
ljusstråle träffar en yta delas den upp i en *brytningsdel* (refraktion) och en *reflektionsdel*. Reflektionsdelen är
ljus som reflekteras direkt och inte tränger in i ytan; det är det vi känner som spekulärt ljus. Brytningsdelen är det
återstående ljuset som tränger in i ytan och absorberas; det är det vi känner som diffust ljus.

Det finns vissa nyanser här, eftersom brutet ljus inte absorberas i samma ögonblick som det når ytan. Från fysiken vet
vi att ljus kan modelleras som en energistråle som fortsätter framåt tills den har förlorat all sin energi; en
ljusstråle förlorar energi genom kollisioner. Varje material består av små partiklar som ljusstrålen kan kollidera med.
Vid varje kollision absorberar partiklarna en del av, eller hela, ljusets energi, och den omvandlas till värme.

I regel absorberas inte all energi, och ljuset fortsätter att *spridas* åt ett (mestadels) slumpmässigt håll, där det
kolliderar med andra partiklar tills energin är slut eller det lämnar ytan igen. Ljusstrålar som kommer ut ur ytan igen
bidrar till ytans synliga (diffusa) färg. I fysikaliskt baserad rendering gör vi dock det förenklade antagandet att allt
brutet ljus absorberas och sprids inom ett mycket litet område kring träffpunkten, och bortser från spridda ljusstrålar
som skulle ha lämnat ytan en bit bort. Shadertekniker som tar hänsyn till det kallas *subsurface scattering*; de höjer
den visuella kvaliteten markant på material som hud, marmor eller vax, men kostar prestanda.

En ytterligare finess när det gäller reflektion och brytning är ytor som är *metalliska*. Metalliska ytor reagerar
annorlunda på ljus än icke-metalliska ytor (som också kallas *dielektrika*). Metalliska ytor följer samma principer för
reflektion och brytning, men **allt** brutet ljus absorberas direkt utan att spridas. Det betyder att metalliska ytor
bara lämnar kvar reflekterat, spekulärt ljus; metalliska ytor har inga diffusa färger. På grund av den tydliga skillnaden
mellan metaller och dielektrika behandlas de olika i PBR-pipelinen, vilket vi går närmare in på längre fram i kapitlet.

Skillnaden mellan reflekterat och brutet ljus leder till en annan iakttagelse om energibevarande: de *utesluter
varandra*. Den ljusenergi som reflekteras absorberas inte längre av själva materialet. Den energi som är kvar att tränga
in i ytan som brutet ljus är alltså precis det som återstår när reflektionen är avräknad.

Vi bevarar det här energisambandet genom att först räkna ut den spekulära andelen, alltså hur stor del av det inkommande
ljusets energi som reflekteras. Andelen brutet ljus räknas sedan direkt ut ur den spekulära andelen:

```glsl
float kS = calculateSpecularComponent(...); // reflection/specular fraction
float kD = 1.0 - kS;                        // refraction/diffuse  fraction
```

På så sätt vet vi både hur mycket av det inkommande ljuset som reflekteras och hur mycket som bryts, och vi följer
energiprincipen. Med det här angreppssättet kan det brutna/diffusa och det reflekterade/spekulära bidraget aldrig
tillsammans överstiga 1.0, så deras sammanlagda energi blir aldrig större än den inkommande ljusenergin. Det tog vi inte
hänsyn till i de tidigare belysningskapitlen: där var ambient, diffus och spekulär styrka oberoende tal, och inget
hindrade deras summa från att bli större än det ljus som kom in.

```quiz
Varför räknar PBR-shadern ut den diffusa andelen som `kD = 1.0 - kS`?
- [ ] Eftersom diffust ljus alltid är exakt lika starkt som spekulärt ljus
- [ ] För att den diffusa termen ska kunna hoppas över på metaller, där `kS` är 0
- [x] Ljus som reflekteras vid ytan kan inte också tränga in i den: det som inte reflekteras (kS) är det som finns kvar för brytningen, så de två tillsammans blir aldrig större än det ljus som kommer in
- [ ] Eftersom skärmen visar `1.0 - x` när färgen är gammakorrigerad
---
Reflektion och brytning delar på den inkommande energin – de utesluter varandra. Metaller hanteras för sig: deras brutna del absorberas helt, vilket shadern uttrycker genom att multiplicera `kD` med `1.0 - metallic`.
```

## Reflektansekvationen

Det här leder oss till något som kallas renderingsekvationen, en invecklad ekvation som några mycket smarta personer
har tagit fram och som i dag är den bästa modell vi har för att simulera hur ljus ser ut. Fysikaliskt baserad rendering
följer nära en mer specialiserad version av renderingsekvationen som kallas *reflektansekvationen*. För att förstå PBR
ordentligt är det viktigt att först få en stabil förståelse för reflektansekvationen:

```text
  Lo(p, ωo) = ∫Ω  fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi)  dωi
```

Reflektansekvationen ser skrämmande ut till en början, men när vi plockar isär den kommer du att se att den sakta
börjar bli begriplig. För att förstå ekvationen måste vi ge oss in lite i *radiometri*. Radiometri är mätning av
elektromagnetisk strålning, synligt ljus inräknat. Det finns flera radiometriska storheter som vi kan använda för att
mäta ljus över ytor och riktningar, men vi tar bara upp en som är relevant för reflektansekvationen: *radians*
(radiance), här betecknad L. Radians används för att ange storleken eller styrkan hos ljus som kommer från en enda
riktning. Den är lite knepig att förstå först, eftersom radians är en kombination av flera fysikaliska storheter, så vi
börjar med dem:

- **Strålningsflöde** (radiant flux) Φ: den energi en ljuskälla sänder ut, mätt i watt. Ljus är en sammanlagd summa av
  energi över många olika våglängder, där varje våglängd hör ihop med en viss (synlig) färg. En ljuskällas utsända energi
  kan därför ses som en funktion av alla dess olika våglängder. Att ta in hela våglängdsfördelningen är lite opraktiskt,
  så vi förenklar och representerar strålningsflödet inte som en funktion av olika våglängders styrkor, utan som en
  färgtrippel kodad som RGB (eller, som vi brukar säga: ljusets färg). Den kodningen förlorar en hel del information,
  men det spelar i regel ingen roll för det visuella.
- **Rymdvinkel** (solid angle) ω: storleken eller arean hos en form projicerad på en enhetssfär. Arean av den
  projicerade formen på enhetssfären kallas rymdvinkel; du kan se rymdvinkeln som en riktning med volym – tänk dig att du
  står i enhetssfärens mittpunkt och tittar mot formen; storleken på den siluett du ser är rymdvinkeln. Den mäts i
  steradianer; hela sfären är 4π, en halvsfär 2π.
- **Strålningsintensitet** (radiant intensity) I: strålningsflödet per rymdvinkel, alltså styrkan hos en ljuskälla
  över en projicerad area på enhetssfären. För ett ljus som strålar lika mycket åt alla håll kan
  strålningsintensiteten till exempel ge oss dess energi över en viss area (rymdvinkel): `I = dΦ / dω`.

Med kunskap om strålningsflöde, strålningsintensitet och rymdvinkel kan vi till sist beskriva ekvationen för
**radians**. Radians beskrivs som den totala observerade energin i en area A över rymdvinkeln ω från ett ljus med
strålningsflödet Φ:

```text
            d²Φ
  L  =  ------------
        dA · dω · cos θ
```

Radians är ett radiometriskt mått på mängden ljus i en area, skalad med ljusets *infallsvinkel* θ mot ytans normal som
cos θ: ljuset är svagare ju mindre det strålar rakt mot ytan, och starkast när det faller vinkelrätt mot den. Det
liknar hur vi uppfattade diffus belysning i kapitlet *Grundläggande belysning*, eftersom cos θ motsvarar skalärprodukten
mellan ljusets riktningsvektor och ytans normal:

```glsl
float cosTheta = dot(lightDir, N);
```

Radiansekvationen är ganska användbar eftersom den innehåller de flesta fysikaliska storheter vi är intresserade av. Om
vi låter rymdvinkeln ω och arean A vara oändligt små kan vi använda radians för att mäta flödet från en enda ljusstråle
som träffar en enda punkt i rummet. Det sambandet låter oss räkna ut radiansen från en enda ljusstråle som påverkar en
enda (fragment-)punkt; i praktiken gör vi rymdvinkeln ω till en riktningsvektor ω och arean A till en punkt p. På så
sätt kan vi använda radians direkt i våra shadrar för att räkna ut en enda ljusstråles bidrag per fragment.

När det gäller radians bryr vi oss i själva verket i regel om allt inkommande ljus mot en punkt p, alltså summan av all
radians, som kallas **irradians** (irradiance). Med kunskap om både radians och irradians kan vi gå tillbaka till
reflektansekvationen:

```text
  Lo(p, ωo) = ∫Ω  fr(p, ωi, ωo) · Li(p, ωi) · (n · ωi)  dωi
```

Nu vet vi att L i renderingsekvationen står för radiansen i en punkt p från en inkommande, oändligt liten rymdvinkel ωi,
som kan ses som en inkommande riktningsvektor ωi. Kom ihåg att cos θ skalar energin efter ljusets infallsvinkel mot
ytan, vilket i reflektansekvationen är n · ωi. Reflektansekvationen räknar ut summan av reflekterad radians Lo(p, ωo)
från en punkt p i riktningen ωo, som är den utgående riktningen mot betraktaren. Eller med andra ord: Lo mäter den
reflekterade summan av ljusens irradians mot punkten p, sedd från ωo.

Reflektansekvationen bygger på irradians, som är summan av all inkommande radians, så vi mäter ljus inte bara från en
enda inkommande ljusriktning, utan från alla inkommande ljusriktningar inom en halvsfär Ω centrerad kring punkten p. En
*halvsfär* kan beskrivas som en halv sfär riktad kring ytans normal n.

För att räkna ut summan av värdena inom en area eller (som för en halvsfär) en volym använder vi en matematisk
konstruktion som kallas *integral*, som i reflektansekvationen skrivs ∫ över alla inkommande riktningar dωi inom
halvsfären Ω. En integral mäter arean under en funktion, och den kan räknas ut analytiskt eller numeriskt. Eftersom det
inte finns någon analytisk lösning till vare sig renderings- eller reflektansekvationen löser vi integralen numeriskt,
i diskreta steg. Det betyder att vi tar resultatet av reflektansekvationen i små diskreta steg över halvsfären Ω och
väger ihop resultaten med stegstorleken. Det kallas *Riemannsumma*, och i kod kan vi ungefär åskådliggöra den så här:

```cpp
int steps = 100;
float sum = 0.0f;
vec3 P    = ...;
vec3 Wo   = ...;
vec3 N    = ...;
float dW  = 1.0f / steps;
for(int i = 0; i < steps; ++i)
{
    vec3 Wi = getNextIncomingLightDir(i);
    sum += Fr(P, Wi, Wo) * L(P, Wi) * dot(N, Wi) * dW;
}
```

Genom att skala stegen med `dW` blir summan lika med integralfunktionens totala area eller volym. `dW`, som skalar varje
diskret steg, kan ses som dωi i reflektansekvationen. Matematiskt är dωi den kontinuerliga symbol som vi integrerar
över, och även om den inte direkt motsvarar `dW` i koden (som är ett diskret steg i Riemannsumman) hjälper det att tänka
så. Kom ihåg att diskreta steg alltid ger en approximation av funktionens totala area. En uppmärksam läsare märker att vi
kan öka Riemannsummans *noggrannhet* genom att öka antalet steg – kapitlet *Diffus irradians* gör just det, och måste
välja hur många steg det har råd med.

Reflektansekvationen summerar radiansen från alla inkommande ljusriktningar ωi över halvsfären Ω som träffar punkten p,
skalad med fr, och ger summan av reflekterat ljus Lo i betraktarens riktning. Den inkommande radiansen kan komma från
ljuskällor som vi känner dem, eller från en environment map som mäter radiansen från varje inkommande riktning, som vi
tar upp i IBL-kapitlen.

Nu är den enda okända kvar symbolen fr, som kallas BRDF eller *bidirectional reflective distribution function*, och som
skalar eller viktar den inkommande radiansen utifrån ytans materialegenskaper.

```quiz
Radiansen från ett punktljus når en yta i 60° vinkel mot ytans normal. Med vilken faktor skalar reflektansekvationen den innan BRDF:en tillämpas?
- [x] cos 60° = 0.5, termen `n · ωi`: ljus som kommer in snett sprids över en större yta
- [ ] 1.0: radiansen är densamma från alla håll
- [ ] sin 60° ≈ 0.87, eftersom vinkeln mäts från ytan
- [ ] 60 / 90 ≈ 0.67, ett linjärt avtagande mellan rakt infallande och strykande ljus
---
Skalärprodukten av normalen och (enhets)riktningen mot ljuset är cosinus för vinkeln mellan dem – samma faktor som den diffusa termen i kapitlet Grundläggande belysning. Vid 90° är den 0: strykande ljus bidrar inte alls.
```

## BRDF

BRDF:en, *bidirectional reflective distribution function*, är en funktion som tar in den inkommande (ljus-)riktningen
ωi, den utgående (vy-)riktningen ωo, ytans normal n och en ytparameter a som står för mikroytans strävhet. BRDF:en
approximerar hur mycket varje enskild ljusstråle ωi bidrar till det slutliga reflekterade ljuset från en ogenomskinlig
yta med givna materialegenskaper. Om ytan till exempel är helt slät (som en spegel) ger BRDF-funktionen 0.0 för alla
inkommande ljusstrålar ωi utom den enda stråle som har samma (reflekterade) vinkel som den utgående strålen ωo, för
vilken funktionen ger 1.0.

En BRDF approximerar materialets reflekterande och brytande egenskaper utifrån mikrofasetteorin ovan. För att en BRDF ska
vara fysikaliskt rimlig måste den följa lagen om energibevarande, alltså får summan av reflekterat ljus aldrig överstiga
mängden inkommande ljus. Tekniskt sett räknas Blinn-Phong som en BRDF, med samma ωi och ωo som indata. Blinn-Phong räknas
ändå inte som fysikaliskt baserad, eftersom den inte följer energiprincipen. Det finns flera fysikaliskt baserade
BRDF:er som approximerar hur ytan reagerar på ljus. Nästan alla PBR-pipelines för realtid använder dock en BRDF som
kallas *Cook-Torrance-BRDF:en*.

Cook-Torrance-BRDF:en har både en diffus och en spekulär del:

```text
  fr = kd · f_lambert + ks · f_cook-torrance
```

Här är kd den tidigare nämnda andelen inkommande ljusenergi som *bryts*, och ks andelen som *reflekteras*. Den vänstra
sidan av BRDF:en är ekvationens diffusa del, här betecknad f_lambert. Den kallas *Lambertsk diffus* och liknar det vi
använde för diffus shading; den är en konstant faktor:

```text
                 c
  f_lambert  =  ---
                 π
```

där c är albedot eller ytans färg (tänk på ytans diffusa textur). Divisionen med π normaliserar det diffusa ljuset,
eftersom integralen ovan, som innehåller BRDF:en, skalas med π (vi kommer till det i IBL-kapitlen).

Du kanske undrar hur den Lambertska diffusen hänger ihop med den diffusa belysning vi har använt tidigare: ytans färg
multiplicerad med skalärprodukten mellan ytans normal och ljusriktningen. Skalärprodukten finns kvar, men den har flyttats
ut ur BRDF:en, eftersom vi har n · ωi i slutet av integralen för Lo.

Det finns andra ekvationer för BRDF:ens diffusa del som ofta ser mer realistiska ut, men som också kostar mer att räkna
ut. Epic Games kom dock fram till att den Lambertska diffusen räcker för de flesta ändamål i realtidsrendering.

BRDF:ens spekulära del är lite mer avancerad och ser ut så här:

```text
                            D · F · G
  f_cook-torrance  =  ------------------------
                       4 · (ωo · n) · (ωi · n)
```

Cook-Torrances spekulära BRDF består av tre funktioner och en normaliseringsfaktor i nämnaren. Var och en av
symbolerna D, F och G står för en typ av funktion som approximerar en viss del av ytans reflekterande egenskaper. De
kallas normal**fördelnings**funktionen (normal **D**istribution function), **F**resnelekvationen och
**G**eometrifunktionen:

- **Normalfördelningsfunktionen** (NDF): approximerar hur stor del av ytans mikrofasetter som är riktade längs
  halvvägsvektorn, påverkad av ytans strävhet; det är den viktigaste funktionen för att approximera mikrofasetterna.
- **Geometrifunktionen**: beskriver hur mikrofasetterna skuggar sig själva. När en yta är relativt sträv kan ytans
  mikrofasetter skugga andra mikrofasetter, så att ytan reflekterar mindre ljus.
- **Fresnelekvationen**: Fresnelekvationen beskriver hur stor andel av ljuset ytan reflekterar vid olika vinklar.

Var och en av funktionerna approximerar sin fysikaliska motsvarighet, och du hittar mer än en version av varje, som
approximerar den underliggande fysiken på olika sätt; vissa mer realistiska, andra mer effektiva. Det går alldeles
utmärkt att välja den approximation du vill. Brian Karis på Epic Games har forskat mycket på de olika typerna av
approximationer. Vi väljer samma funktioner som Epic Games Unreal Engine 4: Trowbridge-Reitz GGX för D,
Fresnel-Schlick-approximationen för F och Smiths Schlick-GGX för G.

### Normalfördelningsfunktionen

Normalfördelningsfunktionen D approximerar statistiskt den relativa ytarean av mikrofasetter som är riktade exakt längs
(halvvägs-)vektorn h. Det finns en mängd NDF:er som statistiskt approximerar mikrofasetternas allmänna riktning givet en
strävhetsparameter, och den vi använder kallas Trowbridge-Reitz GGX:

```text
                               α²
  NDF_GGX-TR(n, h, α)  =  ------------------------------
                           π · ((n · h)² · (α² − 1) + 1)²
```

Här är h halvvägsvektorn som jämförs med ytans mikrofasetter, och α är ett mått på ytans strävhet. Om vi tar h som
halvvägsvektorn mellan ytans normal och ljusriktningen och varierar strävheten får vi följande: när strävheten är låg
(ytan är slät) är ett mycket koncentrerat antal mikrofasetter riktade längs halvvägsvektorer inom en liten radie. På
grund av den höga koncentrationen ger NDF:en en mycket ljus fläck. På en sträv yta däremot, där mikrofasetterna pekar åt
mycket mer slumpmässiga håll, hittar du ett mycket större antal halvvägsvektorer h som är någorlunda riktade längs
mikrofasetterna (men mindre koncentrerat), vilket ger mer gråaktiga resultat.

I GLSL blir Trowbridge-Reitz GGX-normalfördelningsfunktionen följande kod:

```glsl
float DistributionGGX(vec3 N, vec3 H, float a)
{
    float a2     = a*a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom    = a2;
    float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
    denom        = PI * denom * denom;

    return nom / denom;
}
```

Shadern i nästa kapitel gör ett steg till först: den kvadrerar strävhetsparametern och använder den som α (`float a =
roughness*roughness;`). Enligt iakttagelser av Disney, som Epic Games tog efter, ser belysningen mer korrekt ut om
strävheten kvadreras i både geometri- och normalfördelningsfunktionen – strävheten ändrar då utseendet jämnare från 0
till 1.

```quiz
NDF:en räknas ut för halvvägsvektorn till ett ljus. Vad händer med den spekulära högdagern när strävheten går mot 0?
- [ ] Den försvinner, eftersom ingen mikrofasett längre är perfekt riktad
- [ ] Den behåller sin storlek och blir svagare
- [ ] Den sprids över hela sfären, eftersom alla mikrofasetter vetter mot ljuset
- [x] Den blir en pytteliten, extremt ljus fläck: nästan alla mikrofasetter är riktade längs normalen, så NDF:en är enorm där h ligger nära n och nästan 0 överallt annars
---
NDF:en beskriver hur mikrofasetternas normaler är fördelade: koncentrerat för en slät yta, utspritt för en sträv. Integrerad över halvsfären förblir den normerad, och därför är en mindre högdager en ljusare. Uppgiften `ndf` i nästa kapitel visar precis det.
```

### Geometrifunktionen

Geometrifunktionen approximerar statistiskt den relativa ytarea där ytans mikrodetaljer skuggar varandra, så att
ljusstrålar skyms. Precis som NDF:en tar geometrifunktionen in materialets strävhetsparameter, och strävare ytor har
större sannolikhet att mikrofasetter skuggar varandra. Den geometrifunktion vi använder är en kombination av GGX och
Schlick-Beckmann-approximationen som kallas Schlick-GGX:

```text
                                 n · v
  G_SchlickGGX(n, v, k)  =  ------------------------
                             (n · v) · (1 − k) + k
```

Här är k en omräkning av α beroende på om vi använder geometrifunktionen för direkt belysning eller för IBL:

```text
               (α + 1)²                       α²
  k_direct  =  --------           k_IBL  =  ----
                  8                           2
```

Observera att värdet på α kan skilja sig beroende på hur motorn räknar om strävhet till α. I de följande kapitlen går vi
noga igenom hur och var omräkningen spelar roll: i koden är α här helt enkelt strävheten – kapitlet *PBR-belysning*
räknar ut `k = (roughness + 1)² / 8` för sina punktljus, kapitlet *Spekulär IBL* `k = roughness² / 2` för sin
uppslagstextur.

För att approximera geometrin på ett bra sätt måste vi ta hänsyn till både vyriktningen (geometriskymning) och
ljusriktningen (geometriskuggning). Båda kan vi ta med med *Smiths metod*:

```text
  G(n, v, l, k)  =  G_sub(n, v, k) · G_sub(n, l, k)
```

Smiths metod med Schlick-GGX som G_sub ger följande utseende för olika strävhet R: geometrifunktionen är en
multiplikator mellan 0.0 och 1.0, där 1.0 (vitt) betyder att mikrofasetterna inte skuggas alls och 0.0 (svart) att de
skuggas helt. Den gör ytan mörkast där ljuset eller ögat ser den i strykande vinkel, och desto mer ju strävare den är.

I GLSL blir geometrifunktionen följande kod:

```glsl
float GeometrySchlickGGX(float NdotV, float k)
{
    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float k)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = GeometrySchlickGGX(NdotV, k);
    float ggx2 = GeometrySchlickGGX(NdotL, k);

    return ggx1 * ggx2;
}
```

### Fresnelekvationen

Fresnelekvationen (uttalas ungefär *frenell*) beskriver förhållandet mellan ljus som reflekteras och ljus som bryts,
och det förhållandet varierar med vinkeln vi ser ytan från. I samma ögonblick som ljus träffar en yta berättar
Fresnelekvationen, utifrån vinkeln mellan yta och betraktare, hur många procent av ljuset som reflekteras. Ur den
reflekterade andelen och energiprincipen får vi direkt den brutna delen av ljuset.

Varje yta eller material har en viss *grundreflektivitet* när man tittar rakt på ytan, men när man ser ytan från en
vinkel blir alla reflektioner tydligare jämfört med grundreflektiviteten. Det kan du själv kontrollera genom att titta på
ditt (förmodligen) trä- eller metallskrivbord, som har en viss grundreflektivitet när du ser det rakt uppifrån; tittar du
på skrivbordet från nästan 90 graders vinkel ser du att reflektionerna blir mycket tydligare. Teoretiskt reflekterar alla
ytor ljuset fullständigt om de ses från exakt 90 grader. Det fenomenet kallas *Fresnel*.

Fresnelekvationen är ganska komplicerad, men lyckligtvis kan den approximeras med *Fresnel-Schlick*-approximationen:

```text
  F_Schlick(h, v, F0)  =  F0 + (1 − F0) · (1 − (h · v))⁵
```

F0 är ytans grundreflektivitet, som vi räknar ut med något som kallas *brytningsindex* (index of refraction, IOR). På en
sfär gäller att ju mer vi tittar mot ytans strykande vinklar (där vinkeln mellan halvvägsvektorn och vyvektorn når 90
grader), desto starkare blir Fresnel och därmed reflektionerna.

Det finns några finesser med Fresnelekvationen. En är att Fresnel-Schlick-approximationen egentligen bara är definierad
för dielektriska, icke-metalliska ytor. För ledande ytor (metaller) håller det inte att räkna ut grundreflektiviteten med
brytningsindex, och vi skulle behöva en helt annan Fresnelekvation för ledare. Eftersom det är opraktiskt approximerar vi
ytterligare genom att räkna ut ytans svar vid vinkelrätt infall (F0), i 0 graders vinkel, som om vi tittade rakt på
ytan, i förväg. Det värdet interpolerar vi utifrån vyvinkeln enligt Fresnel-Schlick-approximationen, så att vi kan
använda samma ekvation för både metaller och icke-metaller.

Ytans svar vid vinkelrätt infall, grundreflektiviteten, finns i stora databaser; några av de vanligare värdena står här:

| Material | F0 (linjärt) | F0 (sRGB) |
|---|---|---|
| Vatten | (0.02, 0.02, 0.02) | (0.15, 0.15, 0.15) |
| Plast / glas (lågt) | (0.03, 0.03, 0.03) | (0.21, 0.21, 0.21) |
| Plast (högt) | (0.05, 0.05, 0.05) | (0.24, 0.24, 0.24) |
| Glas (högt) / rubin | (0.08, 0.08, 0.08) | (0.31, 0.31, 0.31) |
| Diamant | (0.17, 0.17, 0.17) | (0.45, 0.45, 0.45) |
| Järn | (0.56, 0.57, 0.58) | (0.77, 0.78, 0.78) |
| Koppar | (0.95, 0.64, 0.54) | (0.98, 0.82, 0.76) |
| Guld | (1.00, 0.71, 0.29) | (1.00, 0.86, 0.57) |
| Aluminium | (0.91, 0.92, 0.92) | (0.96, 0.96, 0.97) |
| Silver | (0.95, 0.93, 0.88) | (0.98, 0.97, 0.95) |

Det intressanta här är att grundreflektiviteten för alla dielektriska ytor aldrig går över 0.17, och det är undantaget
snarare än regeln, medan den för ledare börjar mycket högre och (mestadels) ligger mellan 0.5 och 1.0. Dessutom är
grundreflektiviteten för ledare (metalliska ytor) färgad. Därför anges F0 som en RGB-trippel (reflektiviteten vid
vinkelrätt infall kan variera med våglängden). Det ser vi bara hos metalliska ytor.

De här särdragen hos metalliska ytor jämfört med dielektriska gav upphov till något som kallas det *metalliska
arbetsflödet*. I det metalliska arbetsflödet skapar vi ytmaterial med en extra parameter, *metalness*, som beskriver om
en yta är metallisk eller icke-metallisk.

Teoretiskt är ett materials metalness binär: det är en metall eller inte; det kan inte vara båda. De flesta
renderingspipelines låter ändå ytans metalness variera linjärt mellan 0.0 och 1.0. Det beror mest på att
materialtexturerna saknar precision. En metallyta med små (icke-metalliska) damm- eller sandliknande partiklar eller
repor är till exempel svår att rendera med binära metalness-värden.

Genom att räkna ut F0 i förväg för både dielektrika och ledare kan vi använda samma Fresnel-Schlick-approximation för
båda typerna av ytor, men vi måste färga grundreflektiviteten om ytan är metallisk. Det gör vi i regel så här:

```glsl
vec3 F0 = vec3(0.04);
F0      = mix(F0, surfaceColor.rgb, metalness);
```

Vi definierar en grundreflektivitet som approximerar de flesta dielektriska ytor. Det är ännu en approximation, eftersom
F0 är ett medelvärde för de vanligaste dielektrika. En grundreflektivitet på 0.04 gäller för de flesta dielektrika och
ger fysikaliskt rimliga resultat utan att vi behöver ytterligare en ytparameter. Sedan tar vi, beroende på hur metallisk
ytan är, antingen den dielektriska grundreflektiviteten eller F0 angiven som ytans färg. Eftersom metalliska ytor
absorberar allt brutet ljus har de inga diffusa reflektioner, och vi kan använda ytans färgtextur direkt som deras
grundreflektivitet.

I kod blir Fresnel-Schlick-approximationen:

```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
```

där `cosTheta` är skalärprodukten mellan ytans normal n och halvvägsriktningen h (eller vyriktningen v).

```quiz
Sfärerna i nästa kapitel har albedot (0.5, 0.0, 0.0). Vilken grundreflektivitet F0 ger `F0 = mix(vec3(0.04), albedo, metallic)` en sfär med `metallic = 0.0`, och vilken en med `metallic = 1.0`?
- [ ] (0.5, 0.0, 0.0) för båda: F0 är alltid ytans färg
- [x] (0.04, 0.04, 0.04) – en ofärgad, svag reflektion som plastens – och (0.5, 0.0, 0.0) – en röd reflektion, eftersom en metalls reflektion får dess färg
- [ ] (0.0, 0.0, 0.0) och (1.0, 1.0, 1.0): icke-metaller reflekterar inte, metaller reflekterar allt
- [ ] (0.54, 0.04, 0.04) och (0.04, 0.04, 0.04): albedot läggs till för icke-metaller
---
Dielektrika reflekterar några procent av ljuset vid vinkelrätt infall, lika mycket för alla färger; metaller reflekterar mycket mer och färgat. Det metalliska arbetsflödet använder därför albedot som F0 för metaller – och ger metaller inget diffust ljus alls.
```

## Cook-Torrances reflektansekvation

När varje del av Cook-Torrance-BRDF:en är beskriven kan vi sätta in den fysikaliskt baserade BRDF:en i den nu slutliga
reflektansekvationen:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  ks · (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Den här ekvationen är dock inte helt matematiskt korrekt. Du minns kanske att Fresnel-termen F står för andelen ljus som
reflekteras vid en yta. Det är i praktiken vår andel ks, vilket betyder att reflektansekvationens spekulära (BRDF-)del
redan innehåller reflektionsandelen ks. Därmed blir vår slutliga reflektansekvation:

```text
  Lo(p, ωo) = ∫Ω  ( kd · c / π  +  (D · F · G) / (4 · (ωo · n) · (ωi · n)) ) · Li(p, ωi) · (n · ωi)  dωi
```

Den här ekvationen beskriver nu fullständigt en fysikaliskt baserad renderingsmodell, den som allmänt räknas som det vi
brukar mena med fysikaliskt baserad rendering, PBR. Oroa dig inte om du ännu inte helt förstår hur all matematik ska
passa ihop i kod. I de följande kapitlen ser vi hur reflektansekvationen ger mycket mer fysikaliskt rimliga resultat i
vår renderade belysning, och alla bitar bör sakta börja falla på plats.

```quiz
Vilken funktion i Cook-Torrance-BRDF:en använder vilken omräkning av strävheten för nästa kapitels punktljus – och vilken del multipliceras inte med ks?
- [ ] NDF:en använder `k = (α + 1)² / 8`; den diffusa delen multipliceras inte med kd
- [ ] Fresnel-termen använder `k = α² / 2`; alla delar multipliceras med ks
- [x] Geometrifunktionen (Schlick-GGX med Smiths metod) använder `k = (α + 1)² / 8` för direkt ljus (`α² / 2` för IBL); den spekulära delen multipliceras inte med ks en gång till, eftersom F redan är den reflekterade andelen
- [ ] Geometrifunktionen använder `k = α² / 2` för direkt ljus; den spekulära delen multipliceras med ks två gånger för energibevarandets skull
---
k förekommer bara i geometrifunktionen. Fresnelfaktorn F är andelen reflekterat ljus – precis det ks står för – så att multiplicera den spekulära termen med ks igen skulle räkna den två gånger.
```

## Att skapa PBR-material

Med kunskap om PBR:s underliggande matematiska modell avslutar vi med att beskriva hur grafiker i regel anger en ytas
fysikaliska egenskaper så att vi kan mata in dem direkt i PBR-ekvationerna. Var och en av ytparametrarna som en
PBR-pipeline behöver kan anges eller modelleras med texturer. Med texturer styr vi per fragment hur varje enskild punkt
på ytan ska reagera på ljus: om punkten är metallisk, sträv eller slät, eller hur ytan svarar på ljus av olika
våglängder.

Kursens material, som de sista uppgifterna i kapitlen *PBR-belysning* och *Spekulär IBL* lägger på sfärer, är en plåt av
**nitat stål med rostfläckar** (learnopengl använder ett material av rostigt järn). Det består av fem texturer på 256 ×
256 pixlar:

- **Albedo** (`albedo.png`): albedotexturen anger för varje texel ytans färg, eller grundreflektiviteten om texeln är
  metallisk. Den liknar till stor del de diffusa texturer vi har använt tidigare, men all belysningsinformation är
  borttagen ur den. Diffusa texturer har ofta svaga skuggor eller mörka skrevor i bilden, och det vill man inte ha i en
  albedotextur; den ska bara innehålla ytans färg (eller brytningens absorptionskoefficienter). Här: grått stål och
  orangebrun rost. Som alla färgbilder är den lagrad i sRGB, så shadern omvandlar den till linjära värden först
  (kapitlet *Gammakorrigering*).
- **Normal** (`normal.png`): normal map-texturen är precis som den vi använde i kapitlet *Normal mapping*. Med normal
  mappen kan vi ange en egen normal per fragment och få en yta att se ojämnare ut än den platta ytan är – här spåren
  mellan plåtarna och de kupolformade nitarna.
- **Metallic** (`metallic.png`): metallic- (eller metalness-)mappen anger per texel om texeln är metallisk eller inte.
  Beroende på hur PBR-motorn är uppbyggd kan grafikerna ange metalness som gråskalevärden eller som binärt svart eller
  vitt. Här är stålet vitt (metall) och rosten mörk (icke-metall: rost är en oxid, ett dielektrikum).
- **Roughness** (`roughness.png`): strävhetsmappen anger hur sträv ytan är per texel. Det samplade strävhetsvärdet
  påverkar den statistiska riktningen hos ytans mikrofasetter. En strävare yta får bredare och suddigare reflektioner,
  en slät yta fokuserade och klara reflektioner. Vissa PBR-motorer vill ha en *smoothness*-map (släthet) i stället för
  en strävhetsmap, vilket en del grafiker tycker är mer intuitivt. De värdena räknas om (1.0 − smoothness) till strävhet
  när de samplas.
- **AO** (`ao.png`): *ambient occlusion*- eller AO-mappen anger en extra skuggningsfaktor för ytan och eventuellt
  omgivande geometri. Har vi till exempel en tegelyta ska albedotexturen inte innehålla någon skuggning i tegelstenarnas
  skrevor. AO-mappen anger däremot de mörkare kanterna, eftersom det är svårare för ljus att komma ut därifrån. Att ta
  med ambient occlusion i slutet av belysningssteget kan höja scenens visuella kvalitet markant. AO-mappen för ett
  mesh/en yta skapas antingen för hand eller räknas ut i förväg i 3D-modelleringsprogram. Till skillnad från SSAO i
  kapitlet *SSAO*, som räknas ut i skärmrummet, hör den till materialet.

Metallic, roughness och AO är ett enda värde per texel: filerna är gråskalebilder, och shadern läser deras röda kanal. De
är data, inte färger, så de förblir linjära. Grafikerna ställer in och justerar de här fysikaliskt baserade värdena per
texel och kan basera texturvärdena på verkliga materials fysikaliska ytegenskaper. Det är en av de största fördelarna med
en PBR-pipeline, eftersom ytans fysikaliska egenskaper förblir desamma oavsett omgivning eller belysning, och det gör det
lättare för grafikerna att få fysikaliskt rimliga resultat. Ytor som skapats i en PBR-pipeline kan lätt delas mellan
olika PBR-motorer, ser rätt ut oavsett omgivning och ser därför mycket mer naturliga ut.

## Projektet

Projektet i det här kapitlet är det som nästa kapitel börjar med, så du kan titta på det och köra det redan nu. Det är
learnopengls scen för PBR-belysning: ett rutnät med 7 × 7 sfärer, var och en en UV-sfär med radien 1, med 2.5 enheters
mellanrum. Raderna går från icke-metall (nederst, `metallic = 0`) till metall (överst, `metallic = 6/7`), kolumnerna från
slät (vänster, strävhet 0.05) till sträv (höger, strävhet 6/7); varje sfär har albedot (0.5, 0.0, 0.0) och ao 1.0. Fyra
punktljus med färgen (300, 300, 300) hänger på (±10, ±10, 10), framför rutnätet. Kameran står på **(0, 0, 22)** och
tittar längs -z, så att hela rutnätet syns (learnopengls kamera börjar på (0, 0, 3), mitt i rutnätet, och du skulle
behöva flyga bakåt med tangenterna för att se det).

:::opengl
`main.cpp` bygger sfären i learnopengls `renderSphere()`, sätter `albedo`, `ao`, `camPos` och de fyra
`lightPositions[i]` / `lightColors[i]`, och per sfär `metallic`, `roughness`, `model` och `normalMatrix`. `pbr.vs` skickar
vidare världspositionen, normalen och texturkoordinaterna; `pbr.fs` deklarerar materialet och ljusen och räknar redan ut
`N` och `V`, men dess ljusloop och BRDF:ens tre funktioner är fortfarande `// TODO:`-kommentarer. De fem `.png`-mapparna
ligger också i mappen; de används inte förrän i nästa kapitels sista uppgift.
:::
:::vulkan
`main.cpp` bygger sfären en gång i `createSphere()` och spelar in de 49 ritanropen i `recordCommandBuffer()`, vart och ett
med `vkCmdPushConstants` för sfärens modellmatris, `metallic` och `roughness`; uniform buffern innehåller kamerans
matriser, de fyra ljusen, albedot, ao och `camPos`. `shaders/pbr.vert` skickar vidare världspositionen, normalen och
texturkoordinaterna; `shaders/pbr.frag` räknar redan ut `N` och `V`, men dess ljusloop och BRDF:ens tre funktioner är
fortfarande `// TODO:`-kommentarer. De fem mapparna i `textures/` används inte förrän i nästa kapitels sista uppgift.
:::
:::d3d12
`main.cpp` bygger sfären i `LoadAssets` och ritar de 49 sfärerna i `RenderScene()`, var och en med sin modellmatris, sin
normalmatris och sitt material i root-konstanterna; constant buffern innehåller kamerans matriser, de fyra ljusen och
`camPos`. I `pbr.hlsl` är `VSMain` färdig; `PSMain` räknar redan ut `N` och `V`, men dess ljusloop och BRDF:ens tre
funktioner är fortfarande `// TODO:`-kommentarer. De fem `.png`-mapparna används inte förrän i nästa kapitels sista
uppgift.
:::

Tryck på **Build & run** (Ctrl+Enter): projektet kompileras och körs i den inbyggda simulatorn. Du ser 49 nästan svarta
skivor på den mörkgrå clear-färgen (0.1, 0.1, 0.1). Fragment shadern lägger hittills bara till den ambienta termen
`0.03 * albedo * ao` = (0.015, 0, 0) och inget annat: inget ljus når sfärerna ännu, det finns ingen skuggning, och varje
sfärpixel har samma mycket mörka röda färg (4, 0, 0 av 255). Nästa kapitel fyller i reflektansekvationen steg för steg.

## Mer att läsa

- *Background: Physics and Math of Shading* av Naty Hoffman (kursanteckningar från SIGGRAPH): fysiken bakom det här
  kapitlet på djupet; learnopengls kapitel länkar till den.
- *Real Shading in Unreal Engine 4* av Brian Karis (Epic Games), källan till valet av D, F och G och till
  split sum-approximationen i IBL-kapitlen, och *Physically Based Shading at Disney* av Brent Burley, ursprunget till den
  kvadrerade strävheten och det metalliska arbetsflödet. learnopengls kapitel länkar till båda.

:::opengl
- [PBR / Theory](https://learnopengl.com/PBR/Theory): learnopengls kapitel som det här kapitlet följer, med bilderna av
  mikrofasetterna, NDF:en, geometrifunktionen och Fresnel för olika strävhet.
- [LearnOpenGL-källkod: 6.pbr](https://github.com/JoeyDeVries/LearnOpenGL/tree/master/src/6.pbr): programmen för hela
  delen.
:::
:::vulkan
- [PBR / Theory](https://learnopengl.com/PBR/Theory): learnopengls kapitel som det här kapitlet följer, med bilderna av
  mikrofasetterna, NDF:en, geometrifunktionen och Fresnel för olika strävhet.
- [Push constants (Vulkan Guide)](https://docs.vulkan.org/guide/latest/push_constants.html): hur projektet ger varje sfär
  dess modellmatris och material.
:::
:::d3d12
- [PBR / Theory](https://learnopengl.com/PBR/Theory): learnopengls kapitel som det här kapitlet följer, med bilderna av
  mikrofasetterna, NDF:en, geometrifunktionen och Fresnel för olika strävhet.
- [Using constants directly in the root signature](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-constants-directly-in-the-root-signature):
  hur projektet ger varje sfär dess matriser och material.
:::
