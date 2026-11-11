# Efterbehandling

Vore det inte roligt om vi kunde krydda spelets grafik ordentligt med bara några efterbehandlingseffekter? Vi skulle
kunna göra en suddig skakeffekt, invertera alla färger i scenen, flytta hörnen på galna sätt och/eller använda andra
intressanta effekter förhållandevis enkelt – tack vare att vi först renderar till en textur. Det här kapitlet använder
mycket av det som kapitlen Framebuffers och Anti-aliasing tog upp.

I kapitlet Framebuffers visade vi hur efterbehandling kan ge intressanta effekter med bara en enda textur. I Hedgerow
gör vi något liknande: vi renderar hela spelet till en **multisamplad** färgbuffert, löser upp (resolve) den till en
vanlig textur – varje pixel medelvärdet av sina samples, så kanterna blir kantutjämnade – och ritar sedan den texturen
på en rektangel som täcker hela fönstret, med noll eller fler efterbehandlingseffekter som rektangelns shader lägger på.
Stegen, med learnopengls ord, är:

:::opengl
1. Bind den multisamplade framebuffern.
2. Rendera spelet som vanligt.
3. Blitta den multisamplade framebuffern till en vanlig framebuffer med en textur som attachment.
4. Avbind framebuffern (använd standard-framebuffern).
5. Använd färgbufferttexturen från den vanliga framebuffern i efterbehandlingsshadern.
6. Rendera en rektangel i skärmens storlek som utdata från efterbehandlingsshadern.
:::
:::vulkan
1. Börja ett render pass utanför skärmen vars färg-attachment har 4 samples per pixel.
2. Rendera spelet som vanligt – dess pipelines är gjorda för det render passet.
3. Avsluta render passet: dess **resolve-attachment**, en bild med ett sample, får medelvärdet av varje pixels samples
   (learnopengls blit).
4. Börja fönstrets render pass (learnopengls standard-framebuffer).
5. Använd den upplösta bilden i efterbehandlingsshadern.
6. Rendera en rektangel i skärmens storlek som utdata från efterbehandlingsshadern.
:::
:::d3d12
1. Sätt ett render target med 4 samples per pixel.
2. Rendera spelet som vanligt – dess pipeline states är gjorda för 4 samples.
3. Lös upp det multisamplade målet till en textur med ett sample med `ResolveSubresource` (learnopengls blit), mellan två
   par barriärer.
4. Sätt back buffern som render target igen (learnopengls standard-framebuffer).
5. Använd den upplösta texturen i efterbehandlingsshadern.
6. Rendera en rektangel i skärmens storlek som utdata från efterbehandlingsshadern.
:::

Effekterna är learnopengls tre:

- **Shake** (skaka): skakar scenen lätt, med en liten oskärpa.
- **Confuse** (förvirra): inverterar scenens färger, men också x- och y-axeln.
- **Chaos** (kaos): använder en kärna för kantdetektering för att ge intressant grafik, och flyttar dessutom den
  texturerade bilden i en cirkel för en intressant kaotisk effekt.

Projektet är lösningen från `particles` med nya `// TODO:`-avsnitt och en ny shader.
:::opengl
Den nya shadern är `post_processing.vs` / `post_processing.fs`; deras startkroppar skickar bara vidare rektangeln och
texturen.
:::
:::vulkan
Den nya shadern är `shaders/post_processing.vert` / `shaders/post_processing.frag` (byggs till `.spv` som de andra);
deras startkroppar skickar bara vidare rektangeln och texturen.
:::
:::d3d12
Den nya shadern är `post_processing.hlsl` med `VSMain` och `PSMain`; deras startkroppar skickar bara vidare rektangeln
och texturen.
:::
Kapitlets bilder tas vid **1,45 sekunder** (bildruta 87). Det ögonblicket är valt med flit: bollen träffar den solida
stenen i bildruta 86 (se `collision-resolution`), och i slutet av kapitlet kommer den träffen att skaka skärmen.

## Efterbehandlingsshadern

Här är vertexshadern:

:::opengl
```glsl
#version 330 core
layout (location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

out vec2 TexCoords;

uniform bool chaos;
uniform bool confuse;
uniform bool shake;
uniform float time;

void main()
{
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    vec2 texture = vertex.zw;
    if (chaos)
    {
        float strength = 0.3;
        vec2 pos = vec2(texture.x + sin(time) * strength, texture.y + cos(time) * strength);
        TexCoords = pos;
    }
    else if (confuse)
    {
        TexCoords = vec2(1.0 - texture.x, 1.0 - texture.y);
    }
    else
    {
        TexCoords = texture;
    }
    if (shake)
    {
        float strength = 0.01;
        gl_Position.x += cos(time * 10.0) * strength;
        gl_Position.y += cos(time * 15.0) * strength;
    }
}
```
:::
:::vulkan
```glsl
#version 450

layout(push_constant) uniform PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
} pc;

layout(location = 0) in vec4 vertex; // <vec2 position, vec2 texCoords>

layout(location = 0) out vec2 TexCoords;

void main() {
    gl_Position = vec4(vertex.xy, 0.0, 1.0);
    vec2 texture = vertex.zw;
    if (pc.chaos != 0) {
        float strength = 0.3;
        // Vulkan's texture v points down (OpenGL's up): minus here, so the picture moves as in OpenGL
        vec2 pos = vec2(texture.x + sin(pc.time) * strength, texture.y - cos(pc.time) * strength);
        TexCoords = pos;
    } else if (pc.confuse != 0) {
        TexCoords = vec2(1.0 - texture.x, 1.0 - texture.y);
    } else {
        TexCoords = texture;
    }
    if (pc.shake != 0) {
        float strength = 0.01;
        gl_Position.x += cos(pc.time * 10.0) * strength;
        gl_Position.y -= cos(pc.time * 15.0) * strength; // Vulkan's clip space y points down: minus moves up, as OpenGL's +
    }
}
```
:::
:::d3d12
```hlsl
PSInput VSMain(float2 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    result.position = float4(position, 0.0f, 1.0f);
    if (chaos)
    {
        float strength = 0.3f;
        // v points down in Direct3D: minus moves the picture the way learnopengl's plus does
        float2 pos = float2(texCoord.x + sin(time) * strength, texCoord.y - cos(time) * strength);
        result.texCoord = pos;
    }
    else if (confuse)
    {
        result.texCoord = float2(1.0f - texCoord.x, 1.0f - texCoord.y);
    }
    else
    {
        result.texCoord = texCoord;
    }
    if (shake)
    {
        float strength = 0.01f;
        result.position.x += cos(time * 10.0f) * strength;
        result.position.y += cos(time * 15.0f) * strength;
    }

    return result;
}
```
:::

Beroende på vilken inställning som är på tar vertexshadern olika vägar. Om chaos eller confuse är sant ändrar
vertexshadern texturkoordinaterna för att flytta runt scenen: antingen förskjuter den texturkoordinaterna i något som
liknar en cirkel – (sin(time), cos(time)) gånger 0,3 –, eller så inverterar den dem (`1.0 - texture`: bilden upp och ned
och spegelvänd). Eftersom texturens wrap-läge upprepar bilden får chaos-effekten scenen att upprepa sig på olika delar av
rektangeln. Om shake dessutom är sant flyttar den hörnens positioner en liten bit – högst 0,01 i normaliserade
enhetskoordinater, 4 pixlar i sidled och 3 i höjdled –, som om skärmen skakade. Observera att chaos och confuse inte bör
vara sanna samtidigt, medan shake fungerar tillsammans med vilken av de andra effekterna som helst.

:::vulkan
Två rader skiljer sig från learnopengls, och båda av samma skäl: i Vulkan pekar clip spaces y och texturens v *nedåt*,
i OpenGL uppåt. Rektangeln behåller learnopengls hörn – (−1, −1) med texturkoordinaten (0, 0) – och i Vulkan är det det
övre vänstra hörnet av fönstret *och* av texturen, så bilden står rätt, som i OpenGL. Men en effekt som flyttar bilden
med "+y" skulle flytta den åt andra hållet. Därför drar chaos-effekten ifrån `cos(time) * strength` från v, och shake
drar ifrån från `gl_Position.y`: bilden rör sig precis som OpenGL:s.
:::
:::d3d12
En rad skiljer sig från learnopengls: i Direct3D pekar texturens v *nedåt* (v = 0 är översta raden), så rektangelns
texturkoordinater har v = 0 upptill – (−1, −1), det nedre vänstra hörnet, får (0, 1) – och bilden står rätt. En effekt
som lägger till på v skulle därför flytta bilden åt andra hållet än i OpenGL; chaos-effekten drar i stället ifrån
`cos(time) * strength`, och bilden rör sig som OpenGL:s. Normaliserade enhetskoordinater pekar uppåt i båda API:erna, så
shake behåller learnopengls `+=`. HLSL:s namn: learnopengls variabel `texture` är indata `texCoord`.
:::

Förutom att förskjuta hörnens positioner eller texturkoordinaterna vill vi också ge en synlig förändring så snart någon
av effekterna är på. Det gör vi i fragmentshadern:

:::opengl
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 color;

uniform sampler2D scene;
uniform vec2  offsets[9];
uniform int   edge_kernel[9];
uniform float blur_kernel[9];

uniform bool chaos;
uniform bool confuse;
uniform bool shake;

void main()
{
    // zero out memory since an out variable is initialized with undefined values by default
    color = vec4(0.0);

    vec3 sample[9];
    // sample from texture offsets if using convolution matrix
    if (chaos || shake)
        for (int i = 0; i < 9; i++)
            sample[i] = vec3(texture(scene, TexCoords.st + offsets[i]));

    // process effects
    if (chaos)
    {
        for (int i = 0; i < 9; i++)
            color += vec4(sample[i] * edge_kernel[i], 0.0);
        color.a = 1.0;
    }
    else if (confuse)
    {
        color = vec4(1.0 - texture(scene, TexCoords).rgb, 1.0);
    }
    else if (shake)
    {
        for (int i = 0; i < 9; i++)
            color += vec4(sample[i] * blur_kernel[i], 0.0);
        color.a = 1.0;
    }
    else
    {
        color = texture(scene, TexCoords);
    }
}
```
:::
:::vulkan
```glsl
layout(binding = 0) uniform PostProcessingUniforms {
    vec4  offsets[9];     // .xy (std140: every array element takes 16 bytes)
    ivec4 edge_kernel[9]; // .x
    vec4  blur_kernel[9]; // .x
} kernels;

layout(binding = 1) uniform sampler2D scene;

void main() {
    // zero out memory since an out variable is initialized with undefined values by default
    color = vec4(0.0);

    vec3 samples[9]; // learnopengl's "sample" is a keyword in GLSL 4.50
    // sample from texture offsets if using convolution matrix
    if (pc.chaos != 0 || pc.shake != 0)
        for (int i = 0; i < 9; i++)
            samples[i] = vec3(texture(scene, TexCoords.st + kernels.offsets[i].xy));

    // process effects
    if (pc.chaos != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.edge_kernel[i].x, 0.0);
        color.a = 1.0;
    } else if (pc.confuse != 0) {
        color = vec4(1.0 - texture(scene, TexCoords).rgb, 1.0);
    } else if (pc.shake != 0) {
        for (int i = 0; i < 9; i++)
            color += vec4(samples[i] * kernels.blur_kernel[i].x, 0.0);
        color.a = 1.0;
    } else {
        // alpha 1: the texture has an alpha channel (where the sprites' transparent parts were drawn it is below 1);
        // OpenGL's GL_RGB texture has none and reads 1
        color = vec4(texture(scene, TexCoords).rgb, 1.0);
    }
}
```
:::
:::d3d12
```hlsl
float4 PSMain(PSInput input) : SV_TARGET
{
    float4 color = float4(0.0f, 0.0f, 0.0f, 0.0f);

    float3 samples[9];    // learnopengl's "sample" is a keyword in HLSL
    // sample from texture offsets if using convolution matrix
    if (chaos || shake)
        for (int i = 0; i < 9; i++)
            samples[i] = scene.Sample(wrapSampler, input.texCoord + offsets[i]).rgb;

    // process effects
    if (chaos)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * edge_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else if (confuse)
    {
        color = float4(1.0f - scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    else if (shake)
    {
        for (int i = 0; i < 9; i++)
            color += float4(samples[i] * blur_kernel[i], 0.0f);
        color.a = 1.0f;
    }
    else
    {
        // alpha 1: learnopengl's texture is GL_RGB (alpha 1); this one has alpha, which the
        // sprites' blending lowers at their soft edges - the quad would blend them with black
        color = float4(scene.Sample(wrapSampler, input.texCoord).rgb, 1.0f);
    }
    return color;
}
```
:::

Den här långa shadern följer nästan direkt fragmentshadern från kapitlet Framebuffers och gör flera
efterbehandlingseffekter beroende på vilken effekt som är på. Chaos och shake behöver båda de 9 texlarna runt pixeln –
`offsets` ligger 1/300 av texturen isär –, så de samplas först. Chaos väger sedan ihop dem med kärnan för
**kantdetektering** (8 i mitten, −1 runt omkring: jämna ytor summeras till svart, kanter lyser upp), confuse inverterar
färgen, och shake väger ihop dem med kärnan för **oskärpa** (1 2 1 / 2 4 2 / 1 2 1, delat med 16). Eftersom `if`-satsen
frågar efter chaos först vinner chaos om både chaos och confuse är på.

:::opengl
Den här gången är dock offset-matrisen och faltningskärnorna uniforms som vi sätter från OpenGL-koden. Fördelen är att vi
bara behöver sätta dem en gång, i stället för att räkna ut matriserna på nytt i varje körning av fragmentshadern.
Arrayen behåller learnopengls namn `sample`; i GLSL 3.30 är det ett vanligt namn (det blir ett nyckelord först i GLSL
4.00). Lägg till `SetFloat` bland shaderfunktionerna – shaderns `time` är en float – och ladda shadern i `Init`:

```cpp
void SetFloat(Shader& shader, const char* name, float value, bool useShader = false)
{
    if (useShader)
        Use(shader);
    glUniform1f(glGetUniformLocation(shader.ID, name), value);
}
```

```cpp
LoadShader("post_processing.vs", "post_processing.fs", nullptr, "postprocessing");
```
:::
:::vulkan
learnopengls uniforms är av två slag, och Vulkan får två platser för dem. Det som ändras varje bildruta – `time` och de
tre brytarna – är ett block med **push constants**, `PostProcessingConstants`; en `bool` i ett shaderblock tar 4 byte,
så brytarna är `int` (learnopengl sätter dem också med `SetInteger`). Det learnopengl bara sätter en gång – offseten och
de två kärnorna – är en **uniform buffer** som skrivs en gång när efterbehandlaren skapas. I ett uniformblock (std140)
börjar varje element i en array på en multipel av 16 byte, så arrayerna är `vec4`- / `ivec4`-arrayer där bara `.xy`
eller `.x` används – på båda sidor:

```cpp
struct PostProcessingConstants {
    float time;
    int   chaos;
    int   confuse;
    int   shake;
};

struct PostProcessingUniforms {
    glm::vec4  offsets[9];
    glm::ivec4 edge_kernel[9];
    glm::vec4  blur_kernel[9];
};
```

GLSL 4.50 reserverar `sample`, så arrayen heter `samples`. Och den vanliga grenen skriver alfa 1: kursens textur är RGBA,
och där spritarnas genomskinliga delar ritades är dess alfa under 1 – OpenGL:s GL_RGB-textur har ingen alfa och läser 1
där.

Descriptor set layoutens binding 0 (uniform buffern) var bara synlig för vertexsteget; kärnorna läses i
fragmentshadern, så `uboLayoutBinding.stageFlags = VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT`.

En pipeline hör till ett render pass och till ett antal samples: dess `rasterizationSamples` måste stämma med de
attachments den ritar i. Rektangeln ritar i fönstret (1 sample), men spritarna och partiklarna ska snart rita i en bild
med 4 samples. Därför får `createPipeline` och `LoadShader` två parametrar till, render passet och antalet samples, och
`Init` laddar efterbehandlingsshadern för fönstrets render pass:

```cpp
LoadShader("shaders/post_processing.vert.spv", "shaders/post_processing.frag.spv", "postprocessing", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, renderPass, VK_SAMPLE_COUNT_1_BIT); // the window's pass
```
:::
:::d3d12
learnopengls uniforms per bildruta – `time` och de tre brytarna – är **root constants**, `cbuffer
PostProcessingConstants` vid `b0` (bools som `int`, 4 byte var). Det learnopengl bara sätter en gång från programmet –
offseten och de två kärnorna, med `glUniform2fv`, `glUniform1iv` och `glUniform1fv` – ändras aldrig, så i HLSL är det
helt enkelt `static const`-data i shadern: ingen buffert, ingen uppladdning.

```hlsl
static const float offset = 1.0f / 300.0f;
static const float2 offsets[9] = {
    float2(-offset, -offset),  // top-left
    float2( 0.0f,   -offset),  // top-center
    float2( offset, -offset),  // top-right
    float2(-offset,  0.0f),    // center-left
    float2( 0.0f,    0.0f),    // center-center
    float2( offset,  0.0f),    // center - right
    float2(-offset,  offset),  // bottom-left
    float2( 0.0f,    offset),  // bottom-center
    float2( offset,  offset)   // bottom-right
};
static const int edge_kernel[9] = {
    -1, -1, -1,
    -1,  8, -1,
    -1, -1, -1
};
static const float blur_kernel[9] = {
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
    2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
    1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
};
```

Offsetens rader skrivs med v nedåt (raden ovanför har `-offset`); båda kärnorna är symmetriska, så resultatet blir
detsamma. `sample` är ett nyckelord i HLSL, så arrayen heter `samples`. Och den vanliga grenen skriver alfa 1: kursens
textur är RGBA, och spritarnas blending sänker dess alfa vid deras mjuka kanter – OpenGL:s GL_RGB-textur har ingen alfa
och läser 1 där. Ladda shadern efter partikelshadern:

```cpp
LoadShader(L"post_processing.hlsl", "postprocessing");
```
:::

Gör nu uppgiften **post-shader**. Inget använder shadern än: **ingen synlig förändring**.

```quiz
I chaos-effekten syns bilden flera gånger över fönstret, förskjuten med upp till 0,3 av sin storlek. Varför upprepas den i stället för att sluta i ett band av kantfärg?
- [ ] Därför att vertexshadern ritar rektangeln fyra gånger
- [ ] Därför att kärnan för kantdetektering kopierar bilden till grannarna
- [x] Därför att texturen samplas med ett upprepande wrap-läge: texturkoordinater utanför 0..1 går runt till bildens andra sida
- [ ] Därför att den multisamplade bufferten lagrar fyra kopior av bilden
---
learnopengls Texture2D har `GL_REPEAT` som standard; kursens Vulkan-sampler och Direct3D:s statiska sampler upprepar också. Med clamp skulle den förskjutna delen visa bildens kanttexlar utdragna.
```

## PostProcessor

learnopengl lägger framebufferarna, rektangeln och effekterna i en klass `PostProcessor`; kursen skriver den som en
struct med fria funktioner, som överallt i spelet:

:::opengl
```cpp
struct PostProcessor
{
    // state
    Shader       PostProcessingShader;
    Texture2D    Texture;
    unsigned int Width = 0, Height = 0;
    // options
    bool         Confuse = false, Chaos = false, Shake = false;
    // render state
    unsigned int MSFBO = 0, FBO = 0; // MSFBO = Multisampled FBO. FBO is regular, used for blitting MS color-buffer to texture
    unsigned int RBO = 0;            // RBO is used for multisampled color buffer
    unsigned int VAO = 0;
};
```

`MSFBO` är den multisamplade framebuffern som spelet ritas i, `RBO` dess renderbuffer med 4 samples per pixel, `FBO` den
vanliga framebuffern med `Texture` som färg-attachment. learnopengls konstruktor blir `InitPostProcessor`, dess privata
`initRenderData` överlagringen `InitRenderData(PostProcessor&)` (sprite-renderarens är `InitRenderData(SpriteRenderer&)`);
den gör rektangeln, learnopengls sex hörn från (−1, −1) till (1, 1):

```cpp
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize renderbuffer/framebuffer object
    glGenFramebuffers(1, &effects.MSFBO);
    glGenFramebuffers(1, &effects.FBO);
    glGenRenderbuffers(1, &effects.RBO);
    // initialize renderbuffer storage with a multisampled color buffer (don't need a depth/stencil buffer)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glBindRenderbuffer(GL_RENDERBUFFER, effects.RBO);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGB, width, height); // allocate storage for render buffer object
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, effects.RBO); // attach MS render buffer object to framebuffer
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize MSFBO" << std::endl;
    // also initialize the FBO/texture to blit multisampled color-buffer to; used for shader operations (for postprocessing effects)
    glBindFramebuffer(GL_FRAMEBUFFER, effects.FBO);
    glGenTextures(1, &effects.Texture.ID);
    Generate(effects.Texture, width, height, NULL);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, effects.Texture.ID, 0); // attach texture to framebuffer as its color attachment
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::POSTPROCESSOR: Failed to initialize FBO" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    // initialize render data and uniforms
    InitRenderData(effects);
    SetInteger(effects.PostProcessingShader, "scene", 0, true);
    float offset = 1.0f / 300.0f;
    float offsets[9][2] = {
        { -offset,  offset  },  // top-left
        {  0.0f,    offset  },  // top-center
        {  offset,  offset  },  // top-right
        { -offset,  0.0f    },  // center-left
        {  0.0f,    0.0f    },  // center-center
        {  offset,  0.0f    },  // center - right
        { -offset, -offset  },  // bottom-left
        {  0.0f,   -offset  },  // bottom-center
        {  offset, -offset  }   // bottom-right
    };
    glUniform2fv(glGetUniformLocation(effects.PostProcessingShader.ID, "offsets"), 9, (float*)offsets);
    int edge_kernel[9] = {
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
    };
    glUniform1iv(glGetUniformLocation(effects.PostProcessingShader.ID, "edge_kernel"), 9, edge_kernel);
    float blur_kernel[9] = {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
    glUniform1fv(glGetUniformLocation(effects.PostProcessingShader.ID, "blur_kernel"), 9, blur_kernel);
}
```

Eftersom allt om att hantera (multisamplade) framebuffers redan har gåtts igenom grundligt i tidigare kapitel behöver det
inte mycket förklaring här. Renderbuffern får minne för **4 samples** av `GL_RGB` per pixel och ingen djupbuffert – ett
2D-spel behöver ingen. Texturen är en `Texture2D` med sina standardvärden (`GL_RGB`, `GL_REPEAT`, `GL_LINEAR`);
learnopengls Texture2D-konstruktor skapar dess ID, vilket kursens struct inte gör, därav `glGenTextures` före
`Generate(…, NULL)` – data `NULL` reserverar bilden utan att fylla den. Båda framebufferarna kontrolleras för
fullständighet. Sedan sätts de uniforms som aldrig ändras, en gång – lägg märke till `(float*)offsets`: en `float[9][2]`
är 18 floats i rad, det `glUniform2fv` med antalet 9 väntar sig.
:::
:::vulkan
```cpp
struct PostProcessor {
    // state
    VkPipeline       PostProcessingShader = VK_NULL_HANDLE; // the postprocessing pipeline
    Texture2D        Texture;   // the picture of the game the quad shows: the multisampled image resolved into it
    unsigned int     Width = 0, Height = 0;
    // options
    bool             Confuse = false, Chaos = false, Shake = false;
    // render state (learnopengl: the multisampled framebuffer MSFBO with its renderbuffer RBO, blitted into the
    // framebuffer FBO with the texture; Vulkan: one render pass whose multisampled colour attachment is resolved into
    // Texture at the end of the pass, and one framebuffer with both images)
    VkRenderPass     RenderPass = VK_NULL_HANDLE;
    VkFramebuffer    Framebuffer = VK_NULL_HANDLE;
    VkImage          MSImage = VK_NULL_HANDLE;       // the multisampled colour image (learnopengl's RBO)
    VkDeviceMemory   MSImageMemory = VK_NULL_HANDLE;
    VkImageView      MSImageView = VK_NULL_HANDLE;
    VkBuffer         UniformBuffer = VK_NULL_HANDLE; // the offsets and kernels (PostProcessingUniforms)
    VkDeviceMemory   UniformBufferMemory = VK_NULL_HANDLE;
    VkBuffer         quadBuffer = VK_NULL_HANDLE;    // learnopengl's VAO: the quad over the whole window
    VkDeviceMemory   quadBufferMemory = VK_NULL_HANDLE;
    VkPipelineLayout pipelineLayout = VK_NULL_HANDLE;
    VkCommandBuffer  commandBuffer = VK_NULL_HANDLE;     // the command buffer being recorded this frame
    VkRenderPass     WindowRenderPass = VK_NULL_HANDLE;  // learnopengl's default framebuffer: the window's render
    VkFramebuffer    WindowFramebuffer = VK_NULL_HANDLE; // pass and this frame's swap chain framebuffer
};
```

Vulkan har ingen `glBlitFramebuffer`. vulkan-tutorials kapitel Multisampling visar Vulkans sätt i stället: render
passet löser upp själv. Efterbehandlaren äger ett **render pass utanför skärmen** med två attachments – en färgbild
`MSImage` med 4 samples (learnopengls renderbuffer) och `Texture` med ett sample som subpassets **resolve-attachment**:

```cpp
void createPostProcessingRenderPass(PostProcessor& effects) {
    // the multisampled colour image: only its resolved pixels are kept
    VkAttachmentDescription colorAttachment{};
    colorAttachment.format = VK_FORMAT_R8G8B8A8_UNORM;
    colorAttachment.samples = VK_SAMPLE_COUNT_4_BIT;
    colorAttachment.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
    colorAttachment.storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachment.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachment.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachment.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    colorAttachment.finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    // the texture: each pixel's 4 samples are averaged ("resolved") into it, then it is ready to be sampled
    VkAttachmentDescription colorAttachmentResolve{};
    colorAttachmentResolve.format = VK_FORMAT_R8G8B8A8_UNORM;
    colorAttachmentResolve.samples = VK_SAMPLE_COUNT_1_BIT;
    colorAttachmentResolve.loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachmentResolve.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
    colorAttachmentResolve.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    colorAttachmentResolve.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    colorAttachmentResolve.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    colorAttachmentResolve.finalLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;

    VkAttachmentReference colorAttachmentRef{};
    colorAttachmentRef.attachment = 0;
    colorAttachmentRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    VkAttachmentReference colorAttachmentResolveRef{};
    colorAttachmentResolveRef.attachment = 1;
    colorAttachmentResolveRef.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

    VkSubpassDescription subpass{};
    subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
    subpass.colorAttachmentCount = 1;
    subpass.pColorAttachments = &colorAttachmentRef;
    subpass.pResolveAttachments = &colorAttachmentResolveRef;

    std::array<VkSubpassDependency, 2> dependencies{};
    // before the pass: wait until the last frame's postprocessing quad has read the texture
    dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
    dependencies[0].dstSubpass = 0;
    dependencies[0].srcStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT | VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[0].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    // after the pass: the postprocessing shaders that sample the texture wait until the resolve has written it
    dependencies[1].srcSubpass = 0;
    dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
    dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    dependencies[1].dstStageMask = VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT;
    dependencies[1].dstAccessMask = VK_ACCESS_SHADER_READ_BIT;

    std::array<VkAttachmentDescription, 2> attachments = {colorAttachment, colorAttachmentResolve};
    VkRenderPassCreateInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
    renderPassInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
    renderPassInfo.pAttachments = attachments.data();
    renderPassInfo.subpassCount = 1;
    renderPassInfo.pSubpasses = &subpass;
    renderPassInfo.dependencyCount = static_cast<uint32_t>(dependencies.size());
    renderPassInfo.pDependencies = dependencies.data();

    if (vkCreateRenderPass(device, &renderPassInfo, nullptr, &effects.RenderPass) != VK_SUCCESS) {
        throw std::runtime_error("failed to create postprocessing render pass!");
    }
}
```

I slutet av subpasset tas medelvärdet av varje pixels 4 samples och skrivs i `Texture`, som sedan slutar i
`SHADER_READ_ONLY_OPTIMAL`, redo för rektangeln. Den multisamplade bildens samples behövs inte efter det: dess storeOp är
`DONT_CARE`, och dess användning omfattar `TRANSIENT_ATTACHMENT`: innehållet lämnar aldrig render passet. De två subpass
dependencies ordnar passet mot rektangeln som samplar texturen: före passet väntar man tills förra bildrutans rektangel
har läst den; efter det väntar rektangelns fragmentshader på resolvens skrivningar.

`InitPostProcessor`, learnopengls konstruktor, gör båda bilderna (`createImage` får vulkan-tutorials parameter
`numSamples`), render passet, en framebuffer med båda vyerna (learnopengls MSFBO och FBO i en), rektangeln, kärnornas
uniform buffer och rektangelns descriptor set (bufferten vid binding 0, texturen vid binding 1 – learnopengls `scene`):

```cpp
void InitPostProcessor(PostProcessor& effects, VkPipeline shader, unsigned int width, unsigned int height) {
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    effects.pipelineLayout = pipelineLayout;
    effects.WindowRenderPass = renderPass;
    // the multisampled colour image (learnopengl's renderbuffer with 4 samples; no depth/stencil buffer needed).
    // Every Vulkan device supports 4 samples for colour attachments.
    createImage(width, height, VK_SAMPLE_COUNT_4_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.MSImage, effects.MSImageMemory);
    effects.MSImageView = createImageView(effects.MSImage, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    // the texture the samples are resolved into and the quad samples (learnopengl's FBO texture)
    createImage(width, height, VK_SAMPLE_COUNT_1_BIT, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_TILING_OPTIMAL, VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT, effects.Texture.Image, effects.Texture.Memory);
    effects.Texture.View = createImageView(effects.Texture.Image, VK_FORMAT_R8G8B8A8_UNORM, VK_IMAGE_ASPECT_COLOR_BIT);
    effects.Texture.Width = width;
    effects.Texture.Height = height;
    // the off-screen render pass and its framebuffer with both images
    createPostProcessingRenderPass(effects);
    std::array<VkImageView, 2> attachments = {effects.MSImageView, effects.Texture.View};
    VkFramebufferCreateInfo framebufferInfo{};
    framebufferInfo.sType = VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;
    framebufferInfo.renderPass = effects.RenderPass;
    framebufferInfo.attachmentCount = static_cast<uint32_t>(attachments.size());
    framebufferInfo.pAttachments = attachments.data();
    framebufferInfo.width = width;
    framebufferInfo.height = height;
    framebufferInfo.layers = 1;
    if (vkCreateFramebuffer(device, &framebufferInfo, nullptr, &effects.Framebuffer) != VK_SUCCESS) {
        throw std::runtime_error("failed to create postprocessing framebuffer!");
    }
    // initialize render data and uniforms
    InitRenderData(effects);
    float offset = 1.0f / 300.0f;
    float offsets[9][2] = {
        { -offset,  offset  },  // top-left
        {  0.0f,    offset  },  // top-center
        {  offset,  offset  },  // top-right
        { -offset,  0.0f    },  // center-left
        {  0.0f,    0.0f    },  // center-center
        {  offset,  0.0f    },  // center - right
        { -offset, -offset  },  // bottom-left
        {  0.0f,   -offset  },  // bottom-center
        {  offset, -offset  }   // bottom-right
    };
    int edge_kernel[9] = {
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
    };
    float blur_kernel[9] = {
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f,
        2.0f / 16.0f, 4.0f / 16.0f, 2.0f / 16.0f,
        1.0f / 16.0f, 2.0f / 16.0f, 1.0f / 16.0f
    };
    // (Vulkan's texture v points down, so "top" and "bottom" swap their names; both kernels are symmetric, so the
    // result is the same)
    PostProcessingUniforms kernels{};
    for (int i = 0; i < 9; i++) {
        kernels.offsets[i] = glm::vec4(offsets[i][0], offsets[i][1], 0.0f, 0.0f);
        kernels.edge_kernel[i] = glm::ivec4(edge_kernel[i], 0, 0, 0);
        kernels.blur_kernel[i] = glm::vec4(blur_kernel[i], 0.0f, 0.0f, 0.0f);
    }
    // learnopengl sets these uniforms once: a uniform buffer written once
    createBuffer(sizeof(PostProcessingUniforms), VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, effects.UniformBuffer, effects.UniformBufferMemory);
    void* data;
    vkMapMemory(device, effects.UniformBufferMemory, 0, sizeof(PostProcessingUniforms), 0, &data);
        memcpy(data, &kernels, sizeof(PostProcessingUniforms));
    vkUnmapMemory(device, effects.UniformBufferMemory);
    // the descriptor set of the quad: the kernels (binding 0) and the texture (binding 1, learnopengl's "scene")
    createDescriptorSet(effects.UniformBuffer, sizeof(PostProcessingUniforms), effects.Texture.View, textureSampler, effects.Texture.DescriptorSet);
}
```

Båda bilderna är `VK_FORMAT_R8G8B8A8_UNORM`. Varje Vulkan-enhet stöder 4 samples för färg-attachments, så learnopengls
fasta 4 är säkert (vulkan-tutorial frågar `getMaxUsableSampleCount` efter det mesta en enhet klarar). Eftersom sprite-
och partikelpipelines ska göras för det här render passet skapar `Init` efterbehandlaren **först** – direkt efter
efterbehandlingsshadern, före de andra shadrarna; learnopengl skapar den sist, vilket OpenGL tillåter eftersom ett
shaderprogram inte beror på någon framebuffer. `createDescriptorSet` tar nu bufferten och dess storlek, så texturerna
skickar `uniformBuffer, sizeof(UniformBufferObject)`, och `cleanup()` förstör de nya objekten.
:::
:::d3d12
```cpp
struct PostProcessor
{
    // state
    Shader                       PostProcessingShader;
    Texture2D                    Texture;
    unsigned int                 Width = 0, Height = 0;
    // options
    bool                         Confuse = false, Chaos = false, Shake = false;
    // render state
    ComPtr<ID3D12Resource>       MSRenderTarget;  // the multisampled colour buffer the game is drawn into (learnopengl's MSFBO with its RBO)
    ComPtr<ID3D12DescriptorHeap> RtvHeap;         // its render target view
    ComPtr<ID3D12Resource>       quadVertexBuffer;
    D3D12_VERTEX_BUFFER_VIEW     quadVertexBufferView = {};
};
```

learnopengls multisamplade framebuffer med dess renderbuffer med 4 samples är `MSRenderTarget`, en textur med
`SampleDesc.Count = 4` som kan vara render target, med sin vy i en liten egen RTV-heap. FBO:n med sin textur är
`Texture`, en vanlig `Texture2D` med ett sample per pixel och sin shader resource view i nästa plats i heapen.
(Swapkedjans buffertar kan inte alls vara multisamplade – en swapkedja med flip-modellen kräver `SampleDesc.Count = 1`,
som i kapitlet Anti-aliasing – så att rendera i ett separat mål och lösa upp det är ändå så Direct3D 12-program gör
kantutjämning.) learnopengls konstruktor blir `InitPostProcessor`, dess privata `initRenderData` överlagringen
`InitRenderData(PostProcessor&)`, som gör rektangeln i en upload heap, med v = 0 upptill:

```cpp
void InitPostProcessor(PostProcessor& effects, Shader shader, unsigned int width, unsigned int height)
{
    effects.PostProcessingShader = shader;
    effects.Width = width;
    effects.Height = height;
    // initialize the multisampled colour buffer: a texture with 4 samples per pixel that can
    // be a render target (don't need a depth/stencil buffer). Every Direct3D 11-class GPU can
    // draw 4 samples per pixel in this format; check it anyway.
    D3D12_FEATURE_DATA_MULTISAMPLE_QUALITY_LEVELS qualityLevels = {};
    qualityLevels.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
    qualityLevels.SampleCount = 4;
    qualityLevels.Flags = D3D12_MULTISAMPLE_QUALITY_LEVELS_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CheckFeatureSupport(D3D12_FEATURE_MULTISAMPLE_QUALITY_LEVELS, &qualityLevels, sizeof(qualityLevels)));
    if (qualityLevels.NumQualityLevels == 0)
        throw std::runtime_error("ERROR::POSTPROCESSOR: Failed to initialize the multisampled render target");
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };    // the colour BeginRender clears it to (fastest)
    CD3DX12_CLEAR_VALUE clearValue(DXGI_FORMAT_R8G8B8A8_UNORM, clearColor);
    CD3DX12_HEAP_PROPERTIES heapProperties(D3D12_HEAP_TYPE_DEFAULT);
    CD3DX12_RESOURCE_DESC msDesc = CD3DX12_RESOURCE_DESC::Tex2D(DXGI_FORMAT_R8G8B8A8_UNORM, width, height, 1, 1, 4, 0, D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &msDesc,
        D3D12_RESOURCE_STATE_RENDER_TARGET,
        &clearValue,
        IID_PPV_ARGS(&effects.MSRenderTarget)));
    // its render target view, in a small RTV heap of its own
    D3D12_DESCRIPTOR_HEAP_DESC rtvHeapDesc = {};
    rtvHeapDesc.NumDescriptors = 1;
    rtvHeapDesc.Type = D3D12_DESCRIPTOR_HEAP_TYPE_RTV;
    rtvHeapDesc.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    ThrowIfFailed(Graphics.Device->CreateDescriptorHeap(&rtvHeapDesc, IID_PPV_ARGS(&effects.RtvHeap)));
    Graphics.Device->CreateRenderTargetView(effects.MSRenderTarget.Get(), nullptr, effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    // also initialize the texture to resolve the multisampled colour buffer into; used for
    // shader operations (for postprocessing effects): one sample per pixel, its view in the
    // next free slot of the CBV/SRV heap
    effects.Texture.ID = Graphics.SrvCount++;
    effects.Texture.Width = width;
    effects.Texture.Height = height;
    CD3DX12_RESOURCE_DESC textureDesc = CD3DX12_RESOURCE_DESC::Tex2D(effects.Texture.Internal_Format, width, height, 1, 1);
    ThrowIfFailed(Graphics.Device->CreateCommittedResource(
        &heapProperties,
        D3D12_HEAP_FLAG_NONE,
        &textureDesc,
        D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE,
        nullptr,
        IID_PPV_ARGS(&effects.Texture.Resource)));
    D3D12_SHADER_RESOURCE_VIEW_DESC srvDesc = {};
    srvDesc.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    srvDesc.Format = effects.Texture.Internal_Format;
    srvDesc.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
    srvDesc.Texture2D.MipLevels = 1;
    CD3DX12_CPU_DESCRIPTOR_HANDLE srvHandle(Graphics.SrvHeap->GetCPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.Device->CreateShaderResourceView(effects.Texture.Resource.Get(), &srvDesc, srvHandle);
    // initialize render data (the kernels are constants in post_processing.hlsl)
    InitRenderData(effects);
}
```

`CheckFeatureSupport` frågar om formatet kan ha 4 samples – varje GPU från feature level 11_0 och uppåt måste stödja det,
men det kostar inget att fråga. Det multisamplade målet skapas i tillståndet `RENDER_TARGET` med ett optimerat
rensningsvärde svart (färgen `BeginRender` rensar det till), texturen i tillståndet `PIXEL_SHADER_RESOURCE`. Det finns
ingen djupbuffert: ett 2D-spel behöver ingen, som hos learnopengl. I `OnDestroy` släpper `Effects = PostProcessor();`
alltihop.
:::

Gör den globala `Effects` bredvid de andra spelobjekten och sätt upp den i `Init`, efter partiklarna:

```cpp
InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
```

Gör nu uppgiften **post-processor**. Spelet ritar fortfarande i fönstret: **ingen synlig förändring**.

## Rendera till texturen

De intressanta delarna är `BeginRender` och `EndRender`. Eftersom hela spelets scen ska renderas i det multisamplade
målet anropar vi `BeginRender` före och `EndRender` efter scenens renderingskod; efterbehandlaren sköter sedan
operationerna bakom kulisserna. `Render` – en överlagring av spelets `Render(Game&)` – ritar rektangeln med effekterna.

:::opengl
```cpp
void BeginRender(PostProcessor& effects)
{
    glBindFramebuffer(GL_FRAMEBUFFER, effects.MSFBO);
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
}

void EndRender(PostProcessor& effects)
{
    // now resolve multisampled color-buffer into intermediate FBO to store to texture
    glBindFramebuffer(GL_READ_FRAMEBUFFER, effects.MSFBO);
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, effects.FBO);
    glBlitFramebuffer(0, 0, effects.Width, effects.Height, 0, 0, effects.Width, effects.Height, GL_COLOR_BUFFER_BIT, GL_NEAREST);
    glBindFramebuffer(GL_FRAMEBUFFER, 0); // binds both READ and WRITE framebuffer to default framebuffer
}

void Render(PostProcessor& effects, float time)
{
    // set uniforms/options
    Use(effects.PostProcessingShader);
    SetFloat(effects.PostProcessingShader, "time", time);
    SetInteger(effects.PostProcessingShader, "confuse", effects.Confuse);
    SetInteger(effects.PostProcessingShader, "chaos", effects.Chaos);
    SetInteger(effects.PostProcessingShader, "shake", effects.Shake);
    // render textured quad
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, effects.Texture.ID);
    glBindVertexArray(effects.VAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}
```

`glBlitFramebuffer` kopierar en rektangel från läs-framebuffern till rit-framebuffern; när läs-framebuffern är
multisamplad och rit-framebuffern inte är det **löser kopian upp** – varje pixel får medelvärdet av sina samples. De två
rektanglarna måste då vara lika stora, och `GL_NEAREST` räcker (det finns ingen skalning att filtrera). Efter det binder
`glBindFramebuffer(GL_FRAMEBUFFER, 0)` fönstrets standard-framebuffer för läsning och ritning igen. Spriteshadern behöver
ingen ändring: i OpenGL hör antalet samples till framebuffern, inte till programmet.
:::
:::vulkan
```cpp
void BeginRender(PostProcessor& effects) {
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.RenderPass;
    renderPassInfo.framebuffer = effects.Framebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

void EndRender(PostProcessor& effects) {
    // the end of the off-screen pass resolves the multisampled image into Texture (learnopengl's glBlitFramebuffer)
    vkCmdEndRenderPass(effects.commandBuffer);
    // then the window's render pass begins (learnopengl binds the default framebuffer again)
    VkRenderPassBeginInfo renderPassInfo{};
    renderPassInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;
    renderPassInfo.renderPass = effects.WindowRenderPass;
    renderPassInfo.framebuffer = effects.WindowFramebuffer;
    renderPassInfo.renderArea.offset = {0, 0};
    renderPassInfo.renderArea.extent = {effects.Width, effects.Height};

    VkClearValue clearColor = {{{0.0f, 0.0f, 0.0f, 1.0f}}};
    renderPassInfo.clearValueCount = 1;
    renderPassInfo.pClearValues = &clearColor;

    vkCmdBeginRenderPass(effects.commandBuffer, &renderPassInfo, VK_SUBPASS_CONTENTS_INLINE);
}

void Render(PostProcessor& effects, float time) {
    vkCmdBindPipeline(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.PostProcessingShader);
    // set uniforms/options
    PostProcessingConstants constants{};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    vkCmdPushConstants(effects.commandBuffer, effects.pipelineLayout, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, 0, sizeof(PostProcessingConstants), &constants);
    // render textured quad
    vkCmdBindDescriptorSets(effects.commandBuffer, VK_PIPELINE_BIND_POINT_GRAPHICS, effects.pipelineLayout, 0, 1, &effects.Texture.DescriptorSet, 0, nullptr);
    VkBuffer vertexBuffers[] = {effects.quadBuffer};
    VkDeviceSize offsets[] = {0};
    vkCmdBindVertexBuffers(effects.commandBuffer, 0, 1, vertexBuffers, offsets);
    vkCmdDraw(effects.commandBuffer, 6, 1, 0, 0);
}
```

`BeginRender` börjar passet utanför skärmen, rensat till svart. `EndRender` avslutar det – resolven – och börjar sedan
**fönstrets** render pass, med `Effects.WindowFramebuffer`, den här bildrutans framebuffer i swapkedjan. Därför börjar
`recordCommandBuffer` inte längre fönstrets pass själv: den sätter viewport och scissor (dynamiskt tillstånd, giltigt i
båda passen), lämnar command buffern till renderaren, partiklarna och efterbehandlaren, anropar `Render(Hedgerow)` och
avslutar fönstrets pass:

```cpp
Effects.commandBuffer = commandBuffer;
Effects.WindowFramebuffer = swapChainFramebuffers[imageIndex];
// the game's picture: the off-screen pass (BeginRender ... EndRender), then the window's render pass with the
// postprocessing quad (EndRender begins it)
Render(Hedgerow);

vkCmdEndRenderPass(commandBuffer); // the window's render pass
```

Och sprite- och partikelpipelines görs nu för `Effects.RenderPass` med 4 samples:

```cpp
LoadShader("shaders/sprite.vert.spv", "shaders/sprite.frag.spv", "sprite", VK_BLEND_FACTOR_ONE_MINUS_SRC_ALPHA, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT);
LoadShader("shaders/particle.vert.spv", "shaders/particle.frag.spv", "particle", VK_BLEND_FACTOR_ONE, Effects.RenderPass, VK_SAMPLE_COUNT_4_BIT); // additive blending
```
:::
:::d3d12
```cpp
void BeginRender(PostProcessor& effects)
{
    CD3DX12_CPU_DESCRIPTOR_HANDLE rtvHandle(effects.RtvHeap->GetCPUDescriptorHandleForHeapStart());
    Graphics.CommandList->OMSetRenderTargets(1, &rtvHandle, FALSE, nullptr);
    const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
    Graphics.CommandList->ClearRenderTargetView(rtvHandle, clearColor, 0, nullptr);
}

void EndRender(PostProcessor& effects)
{
    // now resolve the multisampled colour buffer into the texture: each pixel gets the average
    // of its samples. The render target becomes the resolve's source, the texture its destination.
    CD3DX12_RESOURCE_BARRIER barriers[2] =
    {
        CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RENDER_TARGET, D3D12_RESOURCE_STATE_RESOLVE_SOURCE),
        CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE, D3D12_RESOURCE_STATE_RESOLVE_DEST)
    };
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    Graphics.CommandList->ResolveSubresource(effects.Texture.Resource.Get(), 0, effects.MSRenderTarget.Get(), 0, effects.Texture.Internal_Format);
    // and back: the render target for the next frame, the texture for the pixel shader
    barriers[0] = CD3DX12_RESOURCE_BARRIER::Transition(effects.MSRenderTarget.Get(), D3D12_RESOURCE_STATE_RESOLVE_SOURCE, D3D12_RESOURCE_STATE_RENDER_TARGET);
    barriers[1] = CD3DX12_RESOURCE_BARRIER::Transition(effects.Texture.Resource.Get(), D3D12_RESOURCE_STATE_RESOLVE_DEST, D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE);
    Graphics.CommandList->ResourceBarrier(_countof(barriers), barriers);
    // draw into the back buffer again (learnopengl: the default framebuffer)
    Graphics.CommandList->OMSetRenderTargets(1, &Graphics.BackBufferRtv, FALSE, nullptr);
}

void Render(PostProcessor& effects, float time)
{
    // set the shader and its options (root constants)
    Use(effects.PostProcessingShader);
    PostProcessingConstants constants = {};
    constants.time = time;
    constants.confuse = effects.Confuse;
    constants.chaos = effects.Chaos;
    constants.shake = effects.Shake;
    Graphics.CommandList->SetGraphicsRoot32BitConstants(0, sizeof(PostProcessingConstants) / 4, &constants, 0);
    // render textured quad
    CD3DX12_GPU_DESCRIPTOR_HANDLE textureHandle(Graphics.SrvHeap->GetGPUDescriptorHandleForHeapStart(), effects.Texture.ID, Graphics.SrvDescriptorSize);
    Graphics.CommandList->SetGraphicsRootDescriptorTable(2, textureHandle);
    Graphics.CommandList->IASetVertexBuffers(0, 1, &effects.quadVertexBufferView);
    Graphics.CommandList->DrawInstanced(6, 1, 0, 0);
}
```

`ResolveSubresource` är learnopengls blit: den skriver medelvärdet av varje pixels samples i texturen. Den kräver det
multisamplade målet i tillståndet `RESOLVE_SOURCE` och texturen i `RESOLVE_DEST`, så två barriärer kommer före och två
efter – tillbaka till `RENDER_TARGET` för nästa bildruta och till `PIXEL_SHADER_RESOURCE` för rektangeln. Sedan är
`OMSetRenderTargets` med back bufferns vy learnopengls `glBindFramebuffer(GL_FRAMEBUFFER, 0)`. Spelets funktioner känner
inte back buffern, så `GraphicsContext` får `BackBufferRtv`, som sätts i `PopulateCommandList` precis före
`Render(Hedgerow);`.

En pipeline state kan bara rita i render targets med dess `SampleDesc.Count`. Därför får `Compile`,
`loadShaderFromFile` och `LoadShader` en parameter `UINT sampleCount = 1`, och sprite- och partikelshadrarna laddas med
4:

```cpp
LoadShader(L"sprite.hlsl", "sprite", D3D12_BLEND_INV_SRC_ALPHA, 4);
LoadShader(L"particle.hlsl", "particle", D3D12_BLEND_ONE, 4);
```

Rektangelns shader behåller 1: den ritar i fönstret. learnopengl skickar `glfwGetTime()` till `Render`; kursen lägger
till `GetTime()`, sekunderna sedan första anropet – OnUpdates klocka, så bildruta n läser n / 60:

```cpp
float GetTime()
{
    static auto startTime = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<float, std::chrono::seconds::period>(std::chrono::high_resolution_clock::now() - startTime).count();
}
```
:::

Att använda den nya efterbehandlaren i spelet är förhållandevis enkelt: vi lägger scenen mellan `BeginRender` och
`EndRender` och ritar rektangeln efter den:

:::opengl
```cpp
void Render(Game& game)
{
    if (game.State == GAME_ACTIVE)
    {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, glfwGetTime());
    }
}
```
:::
:::vulkan
```cpp
void Render(Game& game) {
    if (game.State == GAME_ACTIVE) {
        // begin rendering to postprocessing framebuffer
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").DescriptorSet, glm::vec2(0.0f, 0.0f), glm::vec2(game.Width, game.Height), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing framebuffer
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, static_cast<float>(glfwGetTime()));
    }
}
```
:::
:::d3d12
```cpp
void Render(Game& game)
{
    if (game.State == GAME_ACTIVE)
    {
        // begin rendering to postprocessing render target
        BeginRender(Effects);
        // draw background
        DrawSprite(Renderer, GetTexture("background").ID, XMFLOAT2(0.0f, 0.0f), XMFLOAT2(static_cast<float>(game.Width), static_cast<float>(game.Height)), 0.0f);
        // draw level
        DrawLevel(game.Levels[game.Level], Renderer);
        // draw player
        DrawObject(Player, Renderer);
        // draw particles
        DrawParticles(Particles);
        // draw ball
        DrawObject(Ball, Renderer);
        // end rendering to postprocessing render target
        EndRender(Effects);
        // render postprocessing quad
        Render(Effects, GetTime());
    }
}
```
:::

Gör nu uppgiften **render-to-texture**. Tryck på **Build & run**: **nästan ingen synlig förändring** – och det är
poängen: spelet tar nu omvägen genom det multisamplade målet, resolven och rektangeln, och bara kanterna avslöjar det. De
är kantutjämnade: bollens och racketens kanter är mjukare, och pixelraderna 37, 112 och 187, som kanterna mellan två rader
block korsar precis i pixelcentrumen, är nu till hälften det ena blocket och till hälften det andra.
:::vulkan d3d12
(Förut hörde de raderna till det nedre blocket i {{api}} och till det övre i OpenGL – rastreringsreglerna skiljer sig
precis vid den gränsen, se `levels`. Med 4 samples per pixel tar båda API:erna medelvärdet av de två blocken och blir
lika.)
:::

```quiz
learnopengl anropar `BeginRender` innan bakgrunden ritas och `EndRender` efter bollen. Vad skulle hända om `EndRender` i stället anropades före bollen?
- [ ] Inget: bollen ritas ändå i den multisamplade bufferten
- [x] Bollen skulle ritas efter resolven, direkt i fönstret – och sedan täckas av rektangeln över hela skärmen, så den skulle försvinna
- [ ] Bollen skulle ritas två gånger, en gång i varje buffert
- [ ] Resolven skulle misslyckas eftersom scenen är ofullständig
---
Allt som ska synas i bilden, och påverkas av effekterna, måste ritas mellan de två anropen. Rektangeln täcker varje pixel i fönstret.
```

:::opengl
```quiz
Varför blittar `EndRender` den multisamplade framebuffern till en andra framebuffer, i stället för att låta efterbehandlingsshadern sampla renderbuffern direkt?
- [ ] Därför att en framebuffer bara kan läsas en gång per bildruta
- [ ] Därför att `glBlitFramebuffer` lägger på effekterna
- [ ] Därför att renderbuffern inte har någon färg, bara djup
- [x] Därför att en renderbuffer inte alls kan samplas av en shader, och en multisamplad bild har flera samples per pixel; blitten löser upp dem till en färg per pixel i en vanlig textur som shadern kan läsa
---
`glBlitFramebuffer` löser upp när läs-framebuffern är multisamplad och rit-framebuffern inte är det; de två rektanglarna måste då vara lika stora.
```
:::
:::vulkan
```quiz
Hur gör Vulkan-projektet om de 4 samplen per pixel till den enda färg som efterbehandlingsshadern samplar?
- [ ] Med `vkCmdBlitImage` från `MSImage` till `Texture` i `EndRender`
- [ ] Efterbehandlingsshadern läser de 4 samplen och tar medelvärdet
- [x] `Texture` är subpassets resolve-attachment (`pResolveAttachments`): när passet utanför skärmen slutar tas medelvärdet av varje pixels samples och skrivs i den, och den slutar i `SHADER_READ_ONLY_OPTIMAL`
- [ ] Swapkedjans bild är multisamplad och löser upp sig själv när den visas
---
`vkCmdBlitImage` kan inte ta en multisamplad källa (`vkCmdResolveImage` skulle kunna, utanför passet). Resolve-attachmenten är vulkan-tutorials sätt, och den multisamplade bildens storeOp kan vara DONT_CARE.
```
:::
:::d3d12
```quiz
Vad måste `EndRender` göra runt `ResolveSubresource`?
- [ ] Inget: `ResolveSubresource` ändrar resursernas tillstånd själv
- [ ] Stänga command listen och köra den, eftersom en resolve inte kan spelas in tillsammans med ritanrop
- [ ] Skapa en ny shader resource view av texturen varje bildruta
- [x] Föra det multisamplade målet till `RESOLVE_SOURCE` och texturen till `RESOLVE_DEST` före den, och båda tillbaka – till `RENDER_TARGET` och `PIXEL_SHADER_RESOURCE` – efter den
---
I Direct3D 12 håller programmet reda på tillstånden. Utan barriärerna rapporterar debug layer fel tillstånd, och GPU:n kan lösa upp innan ritanropen är klara eller sampla innan resolven är det.
```
:::

:::opengl
```quiz
Sprite- och partikelshadrarna ritar nu i en framebuffer med 4 samples per pixel. Vad behövde ändras i dem?
- [x] Inget: i OpenGL hör antalet samples till den bundna framebuffern, inte till shaderprogrammet
- [ ] De behöver `#extension GL_ARB_multisample`
- [ ] De måste skriva `gl_SampleMask`
- [ ] De måste laddas igen efter `InitPostProcessor`
---
I Vulkan och Direct3D 12 är antalet samples en del av pipelineobjektet, så deras sprite- och partikelpipelines måste göras på nytt för 4 samples.
```
:::
:::vulkan
```quiz
Varför laddar `Init` nu efterbehandlingsshadern och anropar `InitPostProcessor` innan den laddar sprite- och partikelshadrarna?
- [ ] Därför att efterbehandlingsshadern måste kompileras först
- [x] Därför att en pipeline görs för ett render pass och ett antal samples: sprite- och partikelpipelines ritar i efterbehandlarens pass utanför skärmen med `VK_SAMPLE_COUNT_4_BIT`, så `Effects.RenderPass` måste finnas först
- [ ] Därför att descriptor poolen fylls i den ordningen
- [ ] Därför att learnopengl gör det i den ordningen
---
learnopengl skapar efterbehandlaren sist; OpenGL tillåter det eftersom ett shaderprogram inte beror på någon framebuffer.
```
:::
:::d3d12
```quiz
Varför laddas sprite- och partikelshadrarna med `sampleCount` 4, men efterbehandlingsshadern med 1?
- [ ] Därför att efterbehandlingsshadern samplar texturen 9 gånger
- [ ] Därför att bara pipeline states med alfablending kan använda multisampling
- [ ] Därför att 4 samples får spritarnas shadrar att gå 4 gånger fortare
- [x] Därför att en pipeline state bara kan rita i render targets med dess `SampleDesc.Count`: spritarna och partiklarna ritar i målet med 4 samples, rektangeln i back buffern med 1 sample
---
I OpenGL hör antalet samples till framebuffern, så learnopengls shadrar behöver ingen ändring. Direct3D 12 bakar in det i pipeline staten.
```
:::

## Prova effekterna

Var vi vill kan vi nu sätta efterbehandlarens egenskap för en effekt till sann, och effekten syns direkt. Prova den
första: slå på confuse i `Init`, direkt efter att efterbehandlaren har satts upp – som en provrad, som den sista uppgiften
tar bort igen:

```cpp
InitPostProcessor(Effects, GetShader("postprocessing"), game.Width, game.Height);
Effects.Confuse = true; // try the effects: confuse (the picture upside down, its colours inverted)
```

Gör nu uppgiften **confuse**. Tryck på **Build & run**: **hela bilden är upp och ned och spegelvänd, med inverterade
färger** – den ljusa himlen nedtill, blocken nedtill, racketen upptill, skymningens mörkblå blekt och de orange blocken
blåaktiga.

Byt sedan raden mot `Effects.Chaos = true;` och gör uppgiften **chaos**: **kantdetektering på en bild förskjuten med
(sin(time), cos(time)) × 0,3**. Där bilden är jämn summeras kärnan till svart; tunna ljusa linjer löper längs blockens och
spritarnas kanter, och himlens stjärnor är prickar. Eftersom texturen upprepas fyller den förskjutna bilden hela fönstret,
och den rör sig vidare för varje bildruta.
:::vulkan d3d12
Den rör sig på samma sätt som OpenGL:s – tack vare minustecknet i vertexshadern.
:::

## Skakningen

Som en praktisk demonstration av effekterna efterliknar vi den visuella kraften när bollen träffar en solid sten. Genom
att slå på shake-effekten en kort stund varje gång en solid kollision sker ser det ut som om kollisionen hade en
kraftigare verkan.

Vi vill bara ha skakeffekten på under en kort tid. Det får vi att fungera med en variabel `ShakeTime` som håller reda på
hur länge skakeffekten ska vara på, bredvid `Effects`:

```cpp
float ShakeTime = 0.0f;
```

Varje gång en solid kollision sker sätter vi variabeln till en viss tid – i `DoCollisions`:

:::opengl d3d12
```cpp
if (!box.IsSolid)
    box.Destroyed = true;
else
{   // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::
:::vulkan
```cpp
if (!box.IsSolid)
    box.Destroyed = true;
else { // if block is solid, enable shake effect
    ShakeTime = 0.05f;
    Effects.Shake = true;
}
```
:::

Sedan, i spelets `Update`, efter partiklarna, minskar vi `ShakeTime` tills den är 0,0, varefter vi stänger av
skakeffekten:

:::opengl d3d12
```cpp
if (ShakeTime > 0.0f)
{
    ShakeTime -= dt;
    if (ShakeTime <= 0.0f)
        Effects.Shake = false;
}
```
:::
:::vulkan
```cpp
if (ShakeTime > 0.0f) {
    ShakeTime -= dt;
    if (ShakeTime <= 0.0f)
        Effects.Shake = false;
}
```
:::

Gör nu uppgiften **shake**: ta bort provraden och lägg till variabeln, else-grenen och nedräkningen. Tryck på **Build &
run**. Med kursens fasta indata träffar bollen stenen i bildruta 86, så i bilden vid 1,45 s – bildruta 87 – **är bilden
suddig och flyttad ungefär 1,4 pixlar åt vänster och 2,9 pixlar nedåt**: racketens kanter är mjuka, blockens kanter
utsmetade. Jämna ytor ändras knappt. Från bildruta 88 är bilden skarp igen. Varje gång bollen träffar ett solitt block
börjar skärmen kort att skaka och bli suddig, vilket ger spelaren synlig återkoppling på att bollen krockade med något
solitt. I nästa kapitel, om power-ups, får de två andra effekterna komma till nytta.

```quiz
Bollen träffar stenen i bildruta 86. `DoCollisions` sätter `ShakeTime = 0.05f`, och varje `Update` drar sedan av dt = 1/60 s. I vilka bildrutor skakas bilden?
- [ ] Bara i bildruta 86
- [x] I bildrutorna 86 och 87; i bildruta 88 faller `ShakeTime` till 0 eller lägre och skakningen stängs av innan bildrutan renderas
- [ ] I bildrutorna 86, 87 och 88, tre bildrutor på 1/60 s var
- [ ] Från bildruta 86 tills bollen träffar racketen
---
Bildruta 86: 0,05 − 1/60 ≈ 0,033 (skakar fortfarande); bildruta 87: ≈ 0,017; bildruta 88: ≈ 0,0 → `Effects.Shake = false`. `Update` körs före `Render`, så en bildrutas nedräkning gäller redan för dess bild.
```

```quiz
Vad visar skärmen om både `Effects.Chaos` och `Effects.Confuse` är sanna?
- [ ] Den förvirrade bilden, eftersom den slogs på först
- [ ] En blandning av båda: inverterade färger med kantdetektering
- [ ] En svart skärm: effekterna tar ut varandra
- [x] Chaos-effekten: båda shadrarna frågar efter chaos först (`if (chaos) … else if (confuse) …`), så confuse ignoreras
---
learnopengl säger att de två inte bör vara på samtidigt – nästa kapitels power-ups ser till det. Shake kan kombineras med vilken som helst: dess vickning av hörnen är en egen `if`.
```

## Mer att läsa

- [Postprocessing](https://learnopengl.com/In-Practice/2D-Game/Postprocessing): learnopengls kapitel som det här
  kapitlet följer.
- [Framebuffers](https://learnopengl.com/Advanced-OpenGL/Framebuffers) och
  [Anti Aliasing](https://learnopengl.com/Advanced-OpenGL/Anti-Aliasing): kärnorna, och den multisamplade framebuffern
  med sin blit.

:::opengl
- [glBlitFramebuffer](https://registry.khronos.org/OpenGL-Refpages/gl4/html/glBlitFramebuffer.xhtml): kopian och när
  den löser upp.
:::
:::vulkan
- [Multisampling (Vulkan Tutorial)](https://vulkan-tutorial.com/Multisampling): den multisamplade färg-attachmenten och
  dess resolve-attachment.
:::
:::d3d12
- [ResolveSubresource](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-resolvesubresource):
  resolven och dess tillstånd.
:::
