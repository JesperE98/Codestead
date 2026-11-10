// The shaders of the brick wall. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture, in the descriptor table of root parameter 2: the diffuse map (t0).
Texture2D diffuseMap : register(t0);
// The sampler, a static sampler of the root signature (s0: linear, WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    float3 lightPos;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoords : TEXCOORD;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    PSInput result;

    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoords = texCoords;

    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel the quad covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // the quad's own normal: the same everywhere (flat bricks)
    float3 normal = normalize(input.normal);

    // get diffuse color
    float3 color = diffuseMap.Sample(wrapSampler, input.texCoords).rgb;
    // ambient
    float3 ambient = 0.1f * color;
    // diffuse
    float3 lightDir = normalize(lightPos - input.fragPos);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * color;
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);

    float3 specular = float3(0.2f, 0.2f, 0.2f) * spec;
    return float4(ambient + diffuse + specular, 1.0f);
}
