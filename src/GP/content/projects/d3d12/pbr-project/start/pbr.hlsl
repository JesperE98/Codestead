// The shaders of the spheres (learnopengl's 2.2.1.pbr.vs / 2.2.1.pbr.fs): physically based
// rendering with point lights and the light of the environment. main.cpp compiles them at
// run time with D3DCompileFromFile.

// material parameters: the five textures, registers t3 to t7, in the descriptor table of
// root parameter 4
Texture2D albedoMap : register(t3);
Texture2D normalMap : register(t4);
Texture2D metallicMap : register(t5);
Texture2D roughnessMap : register(t6);
Texture2D aoMap : register(t7);
// Their sampler: register s1, the root signature's second static sampler (linear, WRAP).
SamplerState wrapSampler : register(s1);

// IBL: the irradiance cube map, register t0, in the descriptor table of root parameter 2
TextureCube irradianceMap : register(t0);
// the pre-filter cube map and the BRDF lookup texture, registers t1 and t2, in the
// descriptor table of root parameter 3
TextureCube prefilterMap : register(t1);
Texture2D brdfLUT : register(t2);
// The sampler: register s0, the static sampler of the root signature (linear, CLAMP).
SamplerState clampSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0):
// the shaders see them as a constant buffer at register b0 - the values of one draw.
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
    float3 tangent : TANGENT;
};

static const float PI = 3.14159265359f;

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD, float3 tangent : TANGENT)
{
    PSInput result;

    result.texCoords = texCoords;
    // The position in world space (only the model matrix applied), for the lighting.
    float4 worldPos = mul(position, model);
    result.worldPos = worldPos.xyz;
    // The normal is a direction: w = 0, so the matrix's translation does not apply.
    result.normal = mul(float4(normal, 0.0f), normalMatrix).xyz;
    // The tangent lies in the surface: it turns with the model matrix.
    result.tangent = mul(float4(tangent, 0.0f), model).xyz;

    // Then view and projection, as before.
    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// ----------------------------------------------------------------------------
// The normal map's normal (tangent space) taken to world space with a TBN matrix
// built from the sphere's normal and tangent, as in the Normal Mapping chapter.
float3 getNormalFromMap(PSInput input)
{
    float3 tangentNormal = normalMap.Sample(wrapSampler, input.texCoords).xyz * 2.0f - 1.0f;

    float3 N = normalize(input.normal);
    float3 T = normalize(input.tangent);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B points the way the image's rows go up on the sphere: the normal map's green axis
    float3 B = cross(N, T);
    // T, B and N as the rows: with the vector on the left, mul gives x * T + y * B + z * N
    // (learnopengl: mat3(T, B, N) * tangentNormal)
    float3x3 TBN = float3x3(T, B, N);

    return normalize(mul(tangentNormal, TBN));
}
// ----------------------------------------------------------------------------
float DistributionGGX(float3 N, float3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0f);
    float NdotH2 = NdotH * NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0f) + 1.0f);
    denom = PI * denom * denom;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0f);
    float k = (r * r) / 8.0f;

    float nom   = NdotV;
    float denom = NdotV * (1.0f - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(float3 N, float3 V, float3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0f);
    float NdotL = max(dot(N, L), 0.0f);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
// ----------------------------------------------------------------------------
float3 fresnelSchlick(float cosTheta, float3 F0)
{
    return F0 + (1.0f - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
// ----------------------------------------------------------------------------
float3 fresnelSchlickRoughness(float cosTheta, float3 F0, float roughness)
{
    float invRoughness = 1.0f - roughness;
    return F0 + (max(float3(invRoughness, invRoughness, invRoughness), F0) - F0) * pow(clamp(1.0f - cosTheta, 0.0f, 1.0f), 5.0f);
}
// ----------------------------------------------------------------------------
// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // material properties
    float3 albedo   = pow(albedoMap.Sample(wrapSampler, input.texCoords).rgb, 2.2f);
    float metallic  = metallicMap.Sample(wrapSampler, input.texCoords).r;
    float roughness = roughnessMap.Sample(wrapSampler, input.texCoords).r;
    float ao        = aoMap.Sample(wrapSampler, input.texCoords).r;

    // input lighting data
    float3 N = getNormalFromMap(input);
    float3 V = normalize(camPos - input.worldPos);
    float3 R = reflect(-V, N);

    // calculate reflectance at normal incidence; if dia-electric (like plastic) use F0
    // of 0.04 and if it's a metal, use the albedo color as F0 (metallic workflow)
    float3 F0 = float3(0.04f, 0.04f, 0.04f);
    F0 = lerp(F0, albedo, metallic);

    // reflectance equation
    float3 Lo = float3(0.0f, 0.0f, 0.0f);
    for (int i = 0; i < 4; ++i)
    {
        // calculate per-light radiance
        float3 L = normalize(lightPositions[i].xyz - input.worldPos);
        float3 H = normalize(V + L);
        float distance = length(lightPositions[i].xyz - input.worldPos);
        float attenuation = 1.0f / (distance * distance);
        float3 radiance = lightColors[i].rgb * attenuation;

        // Cook-Torrance BRDF
        float NDF = DistributionGGX(N, H, roughness);
        float G   = GeometrySmith(N, V, L, roughness);
        float3 F  = fresnelSchlick(clamp(dot(H, V), 0.0f, 1.0f), F0);

        float3 numerator  = NDF * G * F;
        float denominator = 4.0f * max(dot(N, V), 0.0f) * max(dot(N, L), 0.0f) + 0.0001f; // + 0.0001 to prevent divide by zero
        float3 specular = numerator / denominator;

        // kS is equal to Fresnel
        float3 kS = F;
        // for energy conservation, the diffuse and specular light can't
        // be above 1.0 (unless the surface emits light); to preserve this
        // relationship the diffuse component (kD) should equal 1.0 - kS.
        float3 kD = float3(1.0f, 1.0f, 1.0f) - kS;
        // multiply kD by the inverse metalness such that only non-metals
        // have diffuse lighting, or a linear blend if partly metal (pure metals
        // have no diffuse light).
        kD *= 1.0f - metallic;

        // scale light by NdotL
        float NdotL = max(dot(N, L), 0.0f);

        // add to outgoing radiance Lo
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;  // note that we already multiplied the BRDF by the Fresnel (kS) so we won't multiply by kS again
    }

    // ambient lighting (we now use IBL as the ambient term)
    float3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0f), F0, roughness);

    float3 kS = F;
    float3 kD = 1.0f - kS;
    kD *= 1.0f - metallic;

    float3 irradiance = irradianceMap.Sample(clampSampler, N).rgb;
    float3 diffuse    = irradiance * albedo;

    // sample both the pre-filter map and the BRDF lut and combine them together as per the Split-Sum approximation to get the IBL specular part.
    const float MAX_REFLECTION_LOD = 4.0f;
    float3 prefilteredColor = prefilterMap.SampleLevel(clampSampler, R, roughness * MAX_REFLECTION_LOD).rgb;
    float2 brdf = brdfLUT.Sample(clampSampler, float2(max(dot(N, V), 0.0f), roughness)).rg;
    float3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    float3 ambient = (kD * diffuse + specular) * ao;

    float3 color = ambient + Lo;

    // HDR tonemapping
    color = color / (color + float3(1.0f, 1.0f, 1.0f));
    // gamma correct
    color = pow(color, 1.0f / 2.2f);

    return float4(color, 1.0f);
}
