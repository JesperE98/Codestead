// The shaders of the lit objects (the containers). main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
};

// The material's diffuse colour and specular strength are textures: registers t0 and t1,
// in the descriptor table of root parameter 2. (Textures cannot be members of a cbuffer
// or its structs.)
Texture2D diffuseMap : register(t0);
Texture2D specularMap : register(t1);
// The sampler: register s0, the static sampler of the root signature.
SamplerState wrapSampler : register(s0);

// The rest of the material.
struct Material
{
    float shininess;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float3 viewPos;
    Material material;
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

    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    result.texCoord = texCoord;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // properties
    float3 norm = normalize(input.normal);
    float3 viewDir = normalize(viewPos - input.fragPos);

    // our lighting is set up in 3 phases: directional, point lights and an optional flashlight.
    // for each phase, a calculate function returns the colour that light gives this fragment;
    // PSMain sums them up for this fragment's final colour.
    float3 result = float3(0.0f, 0.0f, 0.0f);
    // TODO: phase 1: directional lighting
    // TODO: phase 2: point lights
    // TODO: phase 3: spot light

    return float4(result, 1.0f);
}
