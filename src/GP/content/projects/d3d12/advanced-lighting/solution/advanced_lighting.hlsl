// The shaders of the floor. main.cpp compiles them at run time with D3DCompileFromFile.

// The floor's texture: register t0, in the descriptor table of root parameter 2.
Texture2D floorTexture : register(t0);
// The sampler: register s0, the static sampler of the root signature (WRAP: the texture
// coordinates go up to 10, so the wood repeats).
SamplerState wrapSampler : register(s0);

// A root constant set from main.cpp with SetGraphicsRoot32BitConstant (root parameter 0):
// Phong (false) or Blinn-Phong (true). A bool in a constant buffer takes 32 bits.
cbuffer BlinnConstant : register(b0)
{
    bool blinn;
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
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The floor has no model matrix: its positions are already world positions.
    result.fragPos = position.xyz;
    result.normal = normal;
    result.texCoord = texCoord;
    result.position = mul(mul(position, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = floorTexture.Sample(wrapSampler, input.texCoord).rgb;
    // ambient
    float3 ambient = 0.05f * color;
    // diffuse
    float3 lightDir = normalize(lightPos - input.fragPos);
    float3 normal = normalize(input.normal);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * color;
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float spec = 0.0f;
    if (blinn)
    {
        float3 halfwayDir = normalize(lightDir + viewDir);
        spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);    // 2-4 times Phong's exponent: about the same highlight size
    }
    else
    {
        float3 reflectDir = reflect(-lightDir, normal);
        spec = pow(max(dot(viewDir, reflectDir), 0.0f), 8.0f);
    }
    float3 specular = float3(0.3f, 0.3f, 0.3f) * spec;    // assuming bright white light color
    return float4(ambient + diffuse + specular, 1.0f);
}
