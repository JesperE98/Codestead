# Projekt: Glaspaviljongen

En arkitekt har byggt en glaspaviljong på en fjällsluttning, för en utställning med två marmorskulpturer. Invigningen
är nästa vecka, broschyren går till tryck på måndag, och hon vill ha en rundvandring i realtid till den. Hennes
praktikant hann så långt som till ditt program från *Framebuffers* innan semestern: de två skulpturerna på ett golv av
metall, ritade till en framebuffer utanför skärmen och visade genom en skärmquad – fortfarande med kantdetekteringen
som effekt, så att hela paviljongen ser ut som en ritning. – Fint för bygglovet, säger arkitekten. Mindre fint för
besökarna.

Gör den till en plats som folk vill besöka. Allt du behöver har du lärt dig i *Avancerad OpenGL*: utmaningen är att
kombinera kapitlen i ett och samma program – djup- och stenciltestet, blending, framebuffers, cubemaps och instancing
på en gång.

Du fortsätter i ditt program från *Framebuffers*, med kantdetekteringens kärna som effekt. Texturerna du behöver är
kursens: himlens sex bilder (`skybox/` i *Cubemaps*) och glaset `window.png` från *Blending*.

## Uppdraget

1. **Broschyrkänslan.** Byt ut kantdetekteringen mot en mjukare effekt: en vinjett. I mitten är bilden som den är;
   mot hörnen tonar den ut till svart.
2. **Öppna himlen.** Ta in himlen från *Cubemaps* i paviljongen: cubemapen, ritad till framebuffern utanför skärmen
   som det sista i scenen, så att den bara fyller de pixlar som inget annat har täckt.
3. **Pelargången.** Bakom skulpturerna står en rad med fem marmorpelare: kuben utsträckt till 0,5 × 3 × 0,5, stående
   på golvet (från y = −0,5 upp till 2,5), vid x = −4, −2, 0, 2 och 4 och z = −4. Alla fem kommer från **ett enda**
   instansierat ritanrop: vertex-shadern placerar varje instans.
4. **Utställningens stjärna.** Den vänstra skulpturen, vid (−1, 0, −1), är mästerverket: ge den en gyllene kontur,
   till exempel (1,0, 0,8, 0,2), med stencilbufferten – skulpturen ritad en gång till, ungefär 1,1 gånger större, bara
   runt omkring sig själv.
5. **Glasväggen.** Mellan de två skulpturerna står en ruta av tonat glas: fönstertexturen på den 1 × 1 stora quaden
   från *Blending* (x från 0 till 1, y från −0,5 till 0,5), flyttad till (0,3, 0, −0,2) och blendad över det som finns
   bakom.

Delmålen i listan bredvid texten kontrolleras automatiskt när du trycker på **Kontrollera min kod**. Kontrollerna
tittar på bilden som ditt program ritar, och – där bilden inte kan avslöja det – på vad dina ritanrop gör: att himlen
kommer sist, att pelarna är ett enda instansierat ritanrop, att konturen använder stenciltestet och glaset blending.

## Tips på vägen

- Varje delmål har ett kapitel det kommer från: vinjetten från *Framebuffers* (bara skärm-shadern ändras), himlen från
  *Cubemaps*, pelarna från *Instancing*, konturen från *Stenciltestning* och glaset från *Blending*.
- En vinjett behöver veta hur långt en pixel ligger från bildens mitt: där är dess texturkoordinater 0,5, 0,5.
  `smoothstep` gör om ett avstånd till ett mjukt steg från 0 till 1.
- Himlen sist: dess djup måste vara exakt 1,0 (z = w i vertex-shadern), och djuptestet måste släppa igenom 1,0 där
  djupbufferten fortfarande har kvar den 1,0 som den rensades till.
- Nya shaderfiler: himlens (som i *Cubemaps*), pelarnas vertex-shader och konturens enda färg.
:::opengl
  I kursens filer heter de `skybox.vs` och `skybox.fs`, `columns.vs` (med scenens `framebuffers.fs`) och `outline.fs`
  (med scenens `framebuffers.vs`). I `columns.vs` är `gl_InstanceID` instansens nummer.
:::
:::vulkan
  I kursens filer heter de `shaders/skybox.vert` och `shaders/skybox.frag`, `shaders/columns.vert` (med scenens
  `framebuffers.frag`) och `shaders/outline.frag` (med scenens `framebuffers.vert`). I `columns.vert` är
  `gl_InstanceIndex` instansens nummer. Kompilera dem till SPIR-V som de andra.
:::
:::d3d12
  I kursens filer heter de `skybox.hlsl`, `columns.hlsl` (bara en vertex-shader: scenens pixel-shader färgar pelarna)
  och `outline.hlsl`. I `columns.hlsl` är en parameter med semantiken `SV_InstanceID` instansens nummer.
:::
- Ordningen mellan ritanropen i passet utanför skärmen spelar roll: först allt ogenomskinligt (skulpturerna, golvet,
  pelarna), sedan himlen, sedan konturen, som inget får dölja, och det genomskinliga glaset allra sist.
:::opengl
- Framebuffern från *Framebuffers* har redan en stencilbuffert: dess renderbuffer är `GL_DEPTH24_STENCIL8`. Rensa den
  varje bildruta, och kom ihåg att `glStencilMask` även bestämmer vad `glClear` får rensa.
:::
:::vulkan
- Varje pipeline bär sina egna fasta funktioner, så himlen, konturen och glaset behöver egna pipelines – och din
  pipeline-hjälpfunktion en parameter eller två till (djupjämförelsen, stenciltestet, blending). Stencilbufferten
  behöver ett djupformat med stencil, som rensas när renderpasset utanför skärmen börjar. Himlens pipeline läser bara
  positionen: ge den ett vertexattribut, inte två.
:::
:::d3d12
- Varje pipeline state bär sina egna fasta funktioner, så himlen, konturen och glaset behöver egna pipeline states.
  Stencilbufferten behöver ett djupformat med stencil (`DXGI_FORMAT_D24_UNORM_S8_UINT`), som rensas tillsammans med
  djupet, och referensvärdet kommer från `OMSetStencilRef`.
:::
- Glastexturen har genomskinliga och halvgenomskinliga pixlar: varje pixels alfa avgör hur mycket av det som finns
  bakom som syns igenom.

## Vill du göra mer?

Paviljongen är öppen – men det finns alltid mer att bygga. Lägg till en andra och en tredje glasruta och sortera dem
bakifrån och framåt, som i *Blending*. Låt kameran långsamt gå runt skulpturerna. Låt den konturerade skulpturen bytas
när besökaren trycker på en tangent. Jämna ut pelarnas taggiga kanter med kantutjämning. Eller ge broschyren ett helt
annat utseende: sepia, en mjuk oskärpa eller trots allt kantdetekteringen – men bara på bildens vänstra halva.
