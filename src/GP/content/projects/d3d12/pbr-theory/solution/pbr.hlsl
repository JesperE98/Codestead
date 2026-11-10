// The shaders of the spheres (learnopengl's 1.1.pbr.vs / 1.1.pbr.fs): physically based
// rendering with point lights. main.cpp compiles them at run time with D3DCompileFromFile.

// TODO: the material's textures (albedoMap, normalMap, metallicMap, roughnessMap, aoMap) and their sampler

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0 - the values of one draw.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
    float4x4 normalMatrix;    // transpose(inverse(model)), computed in main.cpp
    // material parameters
    float3 albedo;
    float metallic;
    float roughness;
    float ao;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the values
// that are the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    // lights (float4: every array element takes a 16-byte row; .xyz / .rgb are used)
    float4 lightPositions[4];
    float4 lightColors[4];
    float3 camPos;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
    float3 worldPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
};

static const float PI = 3.14159265359f;

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    PSInput result;

    result.texCoords = texCoords;
    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.worldPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// ----------------------------------------------------------------------------
// TODO: DistributionGGX(N, H, roughness): the normal distribution function (Trowbridge-Reitz GGX)
// ----------------------------------------------------------------------------
// TODO: GeometrySchlickGGX(NdotV, roughness) and GeometrySmith(N, V, L, roughness): the geometry function
// ----------------------------------------------------------------------------
// TODO: fresnelSchlick(cosTheta, F0): the Fresnel equation
// ----------------------------------------------------------------------------
// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 N = normalize(input.normal);
    float3 V = normalize(camPos - input.worldPos);

    // reflectance equation
    float3 Lo = float3(0.0f, 0.0f, 0.0f);
    // TODO: for each of the 4 lights add its outgoing radiance to Lo

    // ambient lighting (note that the next IBL tutorial will replace
    // this ambient lighting with environment lighting).
    float3 ambient = float3(0.03f, 0.03f, 0.03f) * albedo * ao;

    float3 color = ambient + Lo;

    // TODO: HDR tonemapping and gamma correction

    return float4(color, 1.0f);
}
