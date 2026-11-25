# Projekt: Lyktnatt på strandpromenaden

Varje höst firar den lilla hamnstaden *Lyktnatten*: affärerna stänger tidigt, strandpromenaden kantas av lyktor och
hela staden flanerar längs vattnet. I år vill turistbyrån ha en rörlig bild av den till sin webbplats – och jobbet har
hamnat på ditt bord, eftersom "det är ju du som kan det där med ljus".

Hamnkaptenen har redan skickat en scen: strandpromenadens träplank med några lastlådor på. Tyvärr lyses den fortfarande
upp av ljuslabbets fyra testlampor – vit, röd, blå och grön – och ser mer ut som ett disco än som en stilla höstnatt.
Din uppgift är att göra om den till Lyktnatten med det du lärt dig i *Advanced Lighting*: ljus som är mycket starkare
än 1,0, ett flyttalsmål med tone mapping, bloom, gammakorrigering och Blinn-Phong. Inget här är nytt; utmaningen är att
sätta ihop bitarna själv.

![Den färdiga strandpromenaden](images/results/advanced-lighting-project.webp "Ett sätt som den färdiga strandpromenaden kan se ut på (ritat av kursens egen simulator).")

## Scenen du börjar med

Ditt projekt är programmet från *Bloom* med lådorna flyttade ner på planken: golvet (kuben 2 × 2 × 2 skalad till en
tunn platta på 25 × 1 × 25, med ovansidan på y = -0,5) och sex lådor som står på det, kameran i (0, 0, 5) och riktad
längs -z. De fyra ljusen ritas som små ljusa kuber i sina egna färger; scenen hamnar i ett flyttalsmål tillsammans med
sina ljusa delar, de ljusa delarna blurras, och det sista passet adderar bluren, tone mappar med exponeringskurvan och
gammakorrigerar.

:::opengl
Ljusen är vektorerna `lightPositions` och `lightColors` i `main.cpp`; scenens belysning finns i `bloom.fs`, det sista
passet i `bloom_final.fs`, och exponeringen är den globala `exposure`.
:::
:::vulkan
Ljusen är vektorerna `lightPositions` och `lightColors` överst i `main.cpp`; de når shaderna via uniform-buffern
(`updateUniformBuffer()`) och – för ljuskuberna – push constants. Scenens belysning finns i `shaders/bloom.frag`, det
sista passet i `shaders/bloom_final.frag`, och exponeringen är den globala `exposure`.
:::
:::d3d12
Ljusen är arrayerna `lightPositions` och `lightColors` överst i `main.cpp`; `OnUpdate()` kopierar dem till
konstantbufferten, och `RenderScene()` ritar ljuskuberna i deras färger. Scenens belysning finns i `bloom.hlsl`, det
sista passet i `bloom_final.hlsl`, och exponeringen är den globala `exposure`.
:::

## Uppdraget

1. **Lyktor i stället för testlampor.** Byt ut de fyra färgade ljusen mot fyra lyktor med ett varmt, gulorange ljus
   (mer rött än grönt, mer grönt än blått) – var och en mycket starkare än 1,0, så att de glöder. Häng upp dem i två
   rader längs promenaden, 1,5 ovanför planken: i (-2.5, 1, -1), (2.5, 1, -1), (-2.5, 1, -5) och (2.5, 1, -5).
2. **Månsken.** Där ingen lykta når är natten kolsvart. Ge scenen ett svagt, kallt ljus från månen, så att de sidor av
   lådorna som vänder sig bort från lyktorna blir mörkblå i stället för svarta.
3. **Våta plank.** Det har just regnat: låt planken och lådorna spegla lyktorna med ett spekulärt högdager –
   Blinn-Phong, med halfway-vektorn.
4. **Dimma över vattnet.** Gör lyktornas glöd starkare, som om ljuset fastnade i dimma.
5. **Nattexponering.** Med så mycket ljus ser promenaden mer ut som en kvällsmatch på arenan. Skruva ner exponeringen
   tills det är natt igen – planken mellan lyktorna mörka, lyktorna fortfarande starkt lysande.
6. **En lykta som fladdrar.** En av lyktorna – den längst bak till vänster – har en glapp kabel: låt dess ljus dala och
   komma tillbaka med tiden.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på **Kontrollera min kod**.

## Tips på vägen

- En lykta är bara en ljusposition och en färg: kuberna som visar ljusen följer med av sig själva.
- Belysningsshadern har redan en ambient-term – den är bara noll. En färg med mer blått än rött, gånger texturens
  färg, räcker som månsken; håll den svag, några hundradelar.
- Blinn-Phong behöver riktningen mot kameran; scenens konstanter har redan kamerans position. Tänk på att den spekulära
  termen ska dämpas med avståndet precis som den diffusa.
- Glöden är den blurrade ljusa bilden, adderad till scenen i det sista passet. Det finns två sätt att göra den starkare:
  addera den med en faktor, eller blurra fler gånger.
- Prova några exponeringar mellan 0,1 och 0,8 och titta på resultatet: tone mapping är en smaksak.
- För fladdret behöver du tiden sedan programmet startade.
:::opengl
  `glfwGetTime()` ger den; ändra lyktans färg i renderloopen, innan ljusens uniforms sätts.
:::
:::vulkan
  `glfwGetTime()` ger den; `updateUniformBuffer()` körs varje bildruta, innan bildrutans kommandon spelas in. En
  `const`-vektor kan dock inte ändras.
:::
:::d3d12
  `OnUpdate()` mäter redan tiden med `std::chrono` för kameran; en `static` starttid ger tiden sedan första bildrutan.
  Ändra lyktans färg innan den kopieras till konstantbufferten.
:::

## Vill du göra mer?

När Lyktnatten lyser finns det mycket kvar att prova på egen hand:

- **Skuggor.** Lådorna borde kasta skuggor från lyktorna – en rundstrålande skuggkarta för en av lyktorna, som i
  *Point Shadows*.
- **En tegelvägg.** Bygg en magasinsvägg bakom promenaden med teglet från *Normal Mapping*, så att lyktornas ljus fångar
  varje fog.
- **Lyktstolpar.** Ge varje lykta en mörk stolpe ner till planken.
- **Fler lyktor.** En hel rad lyktor ropar efter deferred shading – prova tjugo stycken.
- **Vatten.** Låt promenaden sluta vid mörkt vatten som speglar lyktorna.
