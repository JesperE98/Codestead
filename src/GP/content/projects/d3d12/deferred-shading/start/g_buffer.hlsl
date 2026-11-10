// The shaders of the geometry pass (learnopengl's 8.1.g_buffer.vs / 8.1.g_buffer.fs): they
// write what the lighting needs into the G-buffer, no lighting yet. main.cpp compiles them
// at run time with D3DCompileFromFile.

// The box's maps: registers t0 and t1, in the descriptor table of root parameter 2 (learnopengl:
// texture_diffuse1 and texture_specular1).
Texture2D texture_diffuse1 : register(t0);
Texture2D texture_specular1 : register(t1);
// The sampler: register s0, the static sampler of the root signature (linear, WRAP).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    float3 lightColor;        // only the light cubes use it (deferred_light_box.hlsl)
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame. The geometry pass only needs view and
// projection, so the declaration can stop after them (the lights that follow are not read).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD;
};

// What the pixel shader writes: one value per render target of the G-buffer (learnopengl:
// layout (location = 0) out vec3 gPosition; ... layout (location = 2) out vec4 gAlbedoSpec;).
struct PSOutput
{
    float4 gPosition : SV_TARGET0;
    float4 gNormal : SV_TARGET1;
    float4 gAlbedoSpec : SV_TARGET2;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    PSInput result;

    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.texCoord = texCoord;

    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The pixel shader: runs once per pixel a box covers and fills the G-buffer.
PSOutput PSMain(PSInput input)
{
    PSOutput output;
    // TODO: fill the G-buffer: the position (input.fragPos), the normalized normal, the diffuse map's colour and - in alpha - the specular map's red channel
    output.gPosition = float4(0.0f, 0.0f, 0.0f, 1.0f);
    output.gNormal = float4(0.0f, 0.0f, 0.0f, 1.0f);
    output.gAlbedoSpec = float4(0.0f, 0.0f, 0.0f, 1.0f);
    return output;
}
