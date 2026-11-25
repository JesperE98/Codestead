# Projekt: Världarnas sal

Stadsmuseet öppnar en ny sal på fredag: *Bortom världarna*. Affischerna är tryckta, champagnen står på kylning, och
intendenten har just fått veta att budgeten räckte till exakt **en** planetmodell – `planet.obj`, som du läste in i
den här delen. – En planet till en hel sal? Det är ett skåp, inte en utställning, suckar hon. Sedan får hon en idé:
– På ett museum räknar ingen filerna. Man räknar föremålen. Kan du få det att se ut som en samling?

Det kan du. En modell läses in en gång, och sedan kan du rita den hur många gånger du vill, varje gång med en egen
modellmatris. Allt du behöver har du lärt dig i *Modellinläsning* och delarna före den – utmaningen är att sätta ihop
det själv. Du fortsätter i ditt program från kapitlet *Modell*: den belysta planeten med sin ring.

## Uppdraget

1. **Gör plats.** Kameran står så nära att planeten fyller hela bilden. Ta ett steg bakåt så att planeten i mitten ser
   ungefär hälften så stor ut – sex enheter framför den är lagom.
2. **Fyll salen.** Ställ två föremål till på var sin sida om det första, på samma höjd, ungefär 2,2 enheter till
   vänster och till höger. Båda är mindre (runt 0,4 av modellens storlek) och står på var sitt sätt: det vänstra med
   ringen vänd mer mot besökarna, det högra lutat åt sidan.
3. **Den roterande sockeln.** Föremålet i mitten står på en roterande sockel: låt det snurra långsamt kring den
   lodräta axeln, till exempel en halv radian per sekund, så att besökarna ser det från alla håll. De andra två står still.
4. **Hyllan med småvärldar.** Högre upp längst bak i salen finns en lång hylla: en rad med fem små planeter (runt 0,2
   av modellens storlek), två enheter från varandra, 1,5 enheter högre än föremålen och 3 enheter längre bak. Rita
   dem i en loop och luta varje planet lite mer än den före.
5. **Bronsavgjutningen.** Det vänstra föremålet är inte alls en planet utan en avgjutning av en, i brons. Rita den i
   brons: dess belysta färg multiplicerad med en varm bronston, till exempel (1,0, 0,6, 0,25). De andra planeterna
   behåller sina egna färger.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på **Kontrollera min kod**: kontrollerna
tittar på bilden som ditt program ritar, så andra storlekar, platser och vinklar nära dem ovan godkänns också.

## Tips på vägen

- En modell, många föremål: du läser aldrig in `planet.obj` en gång till. Varje föremål är ytterligare ett anrop som
  ritar samma modell, med en egen modellmatris som sätts före.
:::opengl
- Sätt en ny `model`-matris i renderingsloopen med `ourShader.setMat4("model", ...)` före varje `ourModel.Draw(ourShader)`.
:::
:::vulkan
- Skicka den nya matrisen med `vkCmdPushConstants` i `recordCommandBuffer` före varje `vkCmdDrawIndexed` – alla
  ritanrop använder samma vertex- och indexbuffert.
:::
:::d3d12
- Lagra den nya matrisen (och dess normalmatris) i `modelConstants` i `PopulateCommandList`, sätt rotkonstanterna igen
  med `SetGraphicsRoot32BitConstants` och anropa `m_model.Draw` en gång till.
:::
- Ordningen mellan transformationerna spelar roll. En roterande sockel vrider hela föremålet kring salens lodräta
  axel, inte kring planetens egen lutande axel.
:::opengl vulkan
  I kedjan translate, rotate, scale kommer rotationen med tiden direkt efter förflyttningen – före lutningen.
:::
:::d3d12
  DirectXMath tillämpar matriserna från vänster till höger: rotationen med tiden kommer efter lutningen, precis före
  förflyttningen.
:::
- Tiden är densamma som fick lådan att snurra i *Transformationer*:
:::opengl vulkan
  `glfwGetTime()`.
:::
:::d3d12
  sekunderna sedan första bildrutan, mätta med `std::chrono`.
:::
- Tonen är ett värde per ritanrop, precis som modellmatrisen: vitt (1, 1, 1) för planeterna, brons för avgjutningen.
  Shadern multiplicerar färgen den har räknat fram med den.
:::opengl
  En uniform behåller sitt värde tills du sätter den igen – och en som du aldrig sätter är 0, vilket gör allt svart.
:::
:::vulkan
  Den får plats i push-konstanterna bredvid modellmatrisen. Nu läser även fragment-shadern dem: push-konstantområdet
  och `vkCmdPushConstants` behöver också fragmentsteget. Kompilera om shaderna när du har ändrat dem.
:::
:::d3d12
  Den får plats i rotkonstanterna bredvid matriserna. Nu läser även pixel-shadern dem: ge rotparameter 0 synlighet för
  alla steg.
:::

## Vill du göra mer?

När delmålen är klara är salen din. Ge besökarna en rundtur utan mus: låt kameran glida långsamt från det ena föremålet
till nästa. Sätt en liten måne i bana runt planeten på den roterande sockeln. Belys salen som ett museum – ett varmt
ljus uppifrån – eller gjut ett föremål till i silver. Och har du en annan modellfil kan du ge den en hedersplats:
intendenten kommer aldrig att märka att den inte fanns i budgeten.
