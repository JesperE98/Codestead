# Sammanfattning: Till 3D

Du har nått slutet av *Till 3D*. Du började med matematiken – vektorer, matriser, vinklar – och använde den för att
flytta, skala och rotera dina objekt, för att ge scenen djup och perspektiv och för att flyga genom den med en kamera.
Den här sidan är en ordlista över delens viktigaste begrepp, kapitel för kapitel. Använd den för att slå upp saker,
och som en kontroll: om en definition överraskar dig, gå tillbaka till kapitlet den kommer från.

Begreppen utanför rutorna är desamma i alla API:er. Rutorna visar vad {{api}} kallar saker och hur det gör dem, där
de tre API:erna skiljer sig åt. När du är klar kontrollerar provet i slutet av delen vad du har lärt dig.

## Matematiken bakom 3D

- **Koordinataxlar**: x åt höger, y uppåt och z mot dig – ett **högerhänt** system, det som kursen använder för sin
  värld.
- **Grader och radianer**: ett helt varv är 360° eller 2π radianer; matematikbibliotekens funktioner tar radianer, så
  grader räknas om (`radians(45°)` ≈ 0,785).
- **Sinus och cosinus**: på enhetscirkeln ligger punkten vid vinkeln θ på (cos θ, sin θ). De gör om en vinkel till x
  och y – i rotationsmatriser, i kamerans riktning från yaw och pitch och i allt som rör sig fram och tillbaka med
  `sin(time)`.
- **Vektor**: en riktning och en storlek. Dess **längd** får man med Pythagoras sats; att **normalisera** en vektor
  gör den till en **enhetsvektor** med längden 1.
- **Skalärprodukt**: produkten av längderna gånger cosinus för vinkeln mellan två vektorer – för enhetsvektorer
  cosinus självt, som avslöjar vinkeln.
- **Kryssprodukt**: en vektor som är vinkelrät mot två andra (bara i 3D).
- **Matris**: ett rutnät av tal. Matrismultiplikation är inte kommutativ: A · B är oftast inte B · A.
- **Enhetsmatris**: matrisen som lämnar en vektor oförändrad.
- **Matris gånger vektor**: varje komponent i resultatet är skalärprodukten av en rad i matrisen och vektorn; det är
  så en matris transformerar en vektor.

## Transformationer

- **Skalnings-**, **translations-** och **rotationsmatriser**: ändrar en vektors storlek, position och riktning.
  Rotationsvinklar anges i radianer.
- **Homogen koordinat**: vektorns w-komponent. Med w = 1 är en vektor en punkt och flyttas; med w = 0 är den en
  riktning och flyttas inte.
- **Att kombinera matriser**: en matris kan göra flera transformationer. Med kolumnvektorer (läroboken, GLM) tillämpas
  matrisen längst till höger först: i `Trans * Scale` skalas vektorn först och flyttas sedan.

:::opengl
- **GLM**: matematikbiblioteket OpenGL Mathematics: `glm::mat4`, `glm::translate`, `glm::rotate`, `glm::scale`,
  `glm::radians`.
- **glUniformMatrix4fv** och **glm::value_ptr**: skickar en matris till en `mat4`-uniform; GLM lagrar matriser kolumn
  för kolumn, i den ordning OpenGL förväntar sig, så *transpose*-argumentet är `GL_FALSE`.
:::
:::vulkan
- **GLM**: samma matematikbibliotek som i learnopengl och vulkan-tutorial: `glm::mat4`, `glm::translate`,
  `glm::rotate`, `glm::scale`. En `glm::mat4` motsvarar GLSL:s `mat4` byte för byte.
- **Matrisen som push constant**: `struct PushConstants { glm::mat4 … }` och ett `push_constant`-block i vertex
  shadern.
- **Y-vändningen**: matematiken görs med y uppåt, som i learnopengl, och vertex shadern vänder y för Vulkans
  klipprum med y nedåt (från och med *Koordinatsystem* gör projektionsmatrisen det).
:::
:::d3d12
- **DirectXMath**: Microsofts matematikbibliotek. **Beräkningstyper** (`XMVECTOR`, `XMMATRIX`) är till för
  matematiken, **lagringstyper** (`XMFLOAT3`, `XMFLOAT4X4`) för dina structar.
- **Radvektorer**: DirectXMath skriver v · M, så dess matriser är lärobokens transponerade och en produkt läses från
  **vänster till höger**: `XMMatrixScaling(…) * XMMatrixTranslation(…)` skalar först och flyttar sedan.
- **XMMatrixTranspose** och **mul(position, transform)**: `XMFLOAT4X4` lagrar rad för rad medan HLSL läser en matris i
  en cbuffer kolumn för kolumn, så matrisen transponeras när den lagras; `mul` med vektorn först beräknar v · M, som
  DirectXMath.
- **Matrisen som root constants**: en 4×4-matris är 16 root constants på 32 bitar (av högst 64 DWORD i en root
  signature).
:::

## Koordinatsystem

- **Lokalt rum** (local space): ett objekts koordinater i förhållande till dess egen origo.
- **Världsrum** (world space): koordinaterna i den större världen. **Model-matrisen** flyttar, skalar och roterar ett
  objekt från det lokala rummet till världsrummet.
- **Vyrum** (view space, kamera- eller ögonrum): världen sedd från kameran; **vymatrisen** tar dig dit.
- **Klipprum** (clip space): det som vertex shadern ger ut; **projektionsmatrisen** tar dig dit och avgör vad som syns.
- **Frustum**: den volym som projektionsmatrisen behåller; allt utanför klipps.
- **Ortografisk projektion**: ett lådformat frustum, utan perspektiv: saker långt bort är lika stora som saker nära.
- **Perspektivprojektion**: ett pyramidformat frustum som bestäms av synfältet, bildförhållandet och när- och
  fjärrplanen; den lägger avståndet i w, så att saker längre bort blir mindre.
- **Perspektivdivision**: att dela x, y och z med w i slutet av vertexsteget, vilket gör om klipprummet till NDC.
- **Skärmrum** (screen space): NDC avbildade på viewporten, i pixlar.
- **Högerhänt system**: +x åt höger, +y uppåt, +z mot dig; kameran tittar längs -z i vyrummet.
- **Kedjan**: `projection · view · model · position` (med kolumnvektorer, läses från höger till vänster).
- **Djupbuffert** (z-buffert) och **djuptestning**: per pixel djupet för det hittills närmaste fragmentet, rensat till
  1,0 (fjärrplanet) varje bildruta; ett fragment som ligger längre bort än det lagrade värdet kastas.

:::opengl
- **OpenGL:s NDC**: x, y och z går alla från -1 till 1; y pekar uppåt. `glm::perspective` och `glm::ortho` ger det
  intervallet.
- **Uniforms för alla tre matriserna**: `model`, `view` och `projection` sätts med `setMat4` (`shader_m.h`); varje
  draw-anrop använder de värden som satts före det.
- **glEnable(GL_DEPTH_TEST)** och **GL_DEPTH_BUFFER_BIT**: slår på djuptestningen (GLFW skapar djupbufferten) och
  rensar djupbufferten tillsammans med färgen.
:::
:::vulkan
- **Vulkans NDC**: djupet går från 0 till 1 och y pekar nedåt. `#define GLM_FORCE_DEPTH_ZERO_TO_ONE` anpassar GLM:s
  projektion till djupintervallet, och `proj[1][1] *= -1` vänder y.
- **Uniform buffer för view och projection**: en `VkBuffer` som läses via en descriptor (binding 2 i descriptor
  setet); dess *innehåll* läses när GPU:n kör kommandona, så varje draw-anrop i en bildruta ser samma värden.
- **Push constant för model-matrisen**: spelas in i command buffern, så varje draw-anrop får sin egen.
- **Djupbild**: du skapar djupbufferten själv: en bild i ett djupformat, dess view, ett djup-attachment i render
  passen och framebuffers, pipelinens depth-stencil-tillstånd, och ett rensningsvärde på 1,0.
:::
:::d3d12
- **Direct3Ds NDC**: djupet går från 0 till 1; y pekar uppåt, som i OpenGL. Kursen använder DirectXMaths högerhänta
  funktioner (`XMMatrixPerspectiveFovRH`), som har samma vyrum som GLM.
- **Constant buffer för view och projection**: en buffertresurs som läses via en **constant buffer view** (CBV,
  register `b1`) i descriptor heapen; dess storlek är en multipel av 256 byte. Dess *innehåll* läses när GPU:n kör
  kommandona, så varje draw-anrop i en bildruta ser samma värden.
- **Root constants för model-matrisen**: spelas in i command listen, så varje draw-anrop får sin egen.
- **Djupbuffert**: du skapar den själv: en **DSV-heap**, en `DXGI_FORMAT_D32_FLOAT`-textur med sin depth stencil view,
  PSO:ns depth-stencil-tillstånd, `ClearDepthStencilView` varje bildruta och DSV:n i `OMSetRenderTargets`.
:::

## Kamera

- **Kamerans position**, **riktning**, **höger-** och **uppåtvektor**: vyrummets axlar, byggda med kryssprodukter av
  riktningen och världens uppåtvektor.
- **LookAt-matris**: vymatrisen byggd av de axlarna och kamerans position: en rotation in i kamerans axlar gånger en
  translation med den negerade positionen.
- **Fri kamera**: `cameraPos`, `cameraFront` och `cameraUp`; vyn tittar från `cameraPos` mot
  `cameraPos + cameraFront`, och WASD-tangenterna flyttar `cameraPos`.
- **Deltatid**: tiden som den förra bildrutan tog. Att multiplicera hastigheter med den gör att rörelsen blir
  densamma på snabba och långsamma datorer.
- **Eulervinklar**: **yaw** (vänster/höger), **pitch** (upp/ned) och **roll**. Riktningsvektorn beräknas från yaw och
  pitch med sinus och cosinus; pitch hålls mellan -89° och 89° så att vyn inte slår runt.
- **Mustitt** (mouse look): musens rörelse sedan förra bildrutan, gånger en känslighet, läggs till yaw och pitch.
- **Zoom**: ett mindre **synfält** (field of view) i projektionsmatrisen får scenen att se större ut; kursen håller det
  mellan 1° och 45°.

:::opengl
- **glm::lookAt(position, target, up)**: bygger LookAt-matrisen.
- **glfwGetKey**: om en tangent hålls nere just nu (`processInput`).
- **glfwSetInputMode(…, GLFW_CURSOR, GLFW_CURSOR_DISABLED)**: döljer och fångar markören.
- **glfwSetCursorPosCallback** och **glfwSetScrollCallback**: `mouse_callback` och `scroll_callback`, som anropas när
  musen rör sig och när hjulet snurrar.
:::
:::vulkan
- **glm::lookAt(position, target, up)**: bygger LookAt-matrisen; den hamnar i uniform buffern i
  `updateUniformBuffer()`, tillsammans med projektionen, som använder `fov`.
- **GLFW-inmatning**: samma som i OpenGL: `glfwGetKey`, `GLFW_CURSOR_DISABLED`, och callbackarna
  `glfwSetCursorPosCallback` och `glfwSetScrollCallback`.
:::
:::d3d12
- **XMMatrixLookAtRH(eye, focus, up)**: bygger den högerhänta LookAt-matrisen (LH-versionen skulle inte passa
  RH-projektionen).
- **Tangentbord**: `WM_KEYDOWN` och `WM_KEYUP` håller en array med nedtryckta tangenter uppdaterad, och `OnUpdate`
  flyttar kameran en gång per bildruta.
- **Mus**: `ShowCursor(FALSE)` döljer markören, `WM_MOUSEMOVE` rapporterar dess position (`GET_X_LPARAM`,
  `GET_Y_LPARAM`), och `SetCursorPos` flyttar tillbaka den till mitten av fönstret.
- **Mushjul**: `WM_MOUSEWHEEL`, med `GET_WHEEL_DELTA_WPARAM` delat med `WHEEL_DELTA` per hack.
:::

## Samma idé i tre API:er

| Idé | OpenGL | Vulkan | Direct3D 12 |
| --- | --- | --- | --- |
| Matematikbibliotek | GLM | GLM | DirectXMath |
| Vektorer i matematiken | kolumnvektorer (M · v) | kolumnvektorer (M · v) | radvektorer (v · M) |
| Model-matrisen per draw-anrop | uniform | push constant | root constants |
| View och projection för hela bildrutan | uniforms | uniform buffer (descriptor) | constant buffer (CBV) |
| LookAt-matrisen | `glm::lookAt` | `glm::lookAt` | `XMMatrixLookAtRH` |
| Djupintervall i NDC | -1..1 | 0..1 | 0..1 |
| y i NDC | uppåt | nedåt | uppåt |

Det var allt för *Till 3D*. I *Ljussättning* använder du allt det här – shaders, värden från CPU:n, texturer,
matriser och kameran – för att ljussätta en scen.
