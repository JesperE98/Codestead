// The shaders of the geometry pass (learnopengl's 9.ssao_geometry.vs / .fs): they write the
// position and the normal of every pixel's surface in view space, and its colour, into the
// G-buffer. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    bool invertedNormals;     // true for the room: we see the inside of its cube
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the geometry pass
// only needs view and projection, so the declaration can stop after them.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in view space
    float3 normal : NORMAL;       // the normal in view space
    float2 texCoord : TEXCOORD;
};

// What the pixel shader writes: one value per render target of the G-buffer (learnopengl:
// layout (location = 0) out vec3 gPosition; ... layout (location = 2) out vec3 gAlbedo;).
struct PSOutput
{
    float4 gPosition : SV_TARGET0;
    float4 gNormal : SV_TARGET1;
    float4 gAlbedo : SV_TARGET2;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The position in view space: model, then view.
    float4 viewPos = mul(mul(position, model), view);
    result.fragPos = viewPos.xyz;
    result.texCoord = texCoord;

    // The normal in view space (learnopengl: transpose(inverse(mat3(view * model)))): first
    // the model's normal matrix, then the view matrix itself - it only rotates and moves,
    // so it is its own normal matrix. The normal is a direction: w = 0 for both steps (the
    // normal matrix's w column is not (0, 0, 0, 1), so its result's w is not 0: only its
    // xyz is the normal).
    float3 n = invertedNormals ? -normal : normal;
    float3 worldNormal = mul(float4(n, 0.0f), normalMatrix).xyz;
    result.normal = mul(float4(worldNormal, 0.0f), view).xyz;

    result.position = mul(viewPos, projection);

    return result;
}

// The pixel shader: runs once per pixel the room or the planet covers and fills the G-buffer.
PSOutput PSMain(PSInput input)
{
    PSOutput output;
    // store the fragment position vector in the first gbuffer texture
    output.gPosition = float4(input.fragPos, 1.0f);
    // also store the per-fragment normals into the gbuffer
    output.gNormal = float4(normalize(input.normal), 1.0f);
    // and the diffuse per-fragment color: the same light grey everywhere
    output.gAlbedo = float4(0.95f, 0.95f, 0.95f, 1.0f);
    return output;
}
