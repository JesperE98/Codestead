// The shaders of the scene, drawn from the camera. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures, in the descriptor table of root parameter 2: the wood (t0) and the shadow
// maps (t1, a texture array: one layer per cascade).
Texture2D diffuseTexture : register(t0);
Texture2DArray shadowMap : register(t1);
// The samplers, static samplers of the root signature: s0 for the wood (linear, WRAP), s1
// for the shadow maps (no filtering, a white BORDER).
SamplerState wrapSampler : register(s0);
SamplerState shadowSampler : register(s1);

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
    float3 lightDir;    // the direction towards the light
    float farPlane;
    float4 cascadePlaneDistances[16];    // where each cascade ends (x; float4: every array element takes a 16-byte row)
    int cascadeCount;   // number of frusta - 1
};

// The light-space matrices of the cascades (learnopengl's uniform block LightSpaceMatrices):
// register b2, the constant buffer view in root parameter 3's table.
cbuffer LightSpaceMatrices : register(b2)
{
    float4x4 lightSpaceMatrices[16];
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float3 normal : NORMAL;
    float2 texCoord : TEXCOORD0;
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

// the cascade of a fragment: the first one whose far distance lies beyond the fragment's depth
// in view space
int CascadeLayer(float3 fragPosWorldSpace)
{
    float4 fragPosViewSpace = mul(float4(fragPosWorldSpace, 1.0f), view);
    float depthValue = abs(fragPosViewSpace.z);

    int layer = -1;
    for (int i = 0; i < cascadeCount; ++i)
    {
        if (depthValue < cascadePlaneDistances[i].x)
        {
            layer = i;
            break;
        }
    }
    if (layer == -1)
    {
        layer = cascadeCount;
    }
    return layer;
}

float ShadowCalculation(float3 fragPosWorldSpace, float3 normal)
{
    // select cascade layer
    int layer = CascadeLayer(fragPosWorldSpace);

    float4 fragPosLightSpace = mul(float4(fragPosWorldSpace, 1.0f), lightSpaceMatrices[layer]);
    // perform perspective divide
    float3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform x and y from [-1,1] to [0,1] texture coordinates: in Direct3D v points down
    // while y points up, so y is flipped. z needs nothing: Direct3D's depth is 0..1 already.
    float2 shadowUV = float2(projCoords.x * 0.5f + 0.5f, -projCoords.y * 0.5f + 0.5f);

    // get depth of current fragment from light's perspective
    float currentDepth = projCoords.z;

    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if (currentDepth > 1.0f)
    {
        return 0.0f;
    }
    // calculate bias (based on depth map resolution and slope), smaller for the bigger cascades
    float bias = max(0.05f * (1.0f - dot(normal, lightDir)), 0.005f);
    const float biasModifier = 0.5f;
    if (layer == cascadeCount)
    {
        bias *= 1.0f / (farPlane * biasModifier);
    }
    else
    {
        bias *= 1.0f / (cascadePlaneDistances[layer].x * biasModifier);
    }

    // PCF (percentage-closer filtering): the test for the 3 x 3 texels around the
    // fragment's place in its layer, averaged - soft shadow edges
    float shadow = 0.0f;
    uint width, height, elements;
    shadowMap.GetDimensions(width, height, elements);
    float2 texelSize = 1.0f / float2(width, height);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = shadowMap.Sample(shadowSampler, float3(shadowUV + float2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0f : 0.0f;
        }
    }
    shadow /= 9.0f;

    return shadow;
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    float3 color = diffuseTexture.Sample(wrapSampler, input.texCoord).rgb;
    float3 normal = normalize(input.normal);
    float3 lightColor = float3(0.3f, 0.3f, 0.3f);
    // ambient
    float3 ambient = 0.3f * lightColor;
    // diffuse
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * lightColor;
    // specular
    float3 viewDir = normalize(viewPos - input.fragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 64.0f);
    float3 specular = spec * lightColor;
    // calculate shadow
    float shadow = ShadowCalculation(input.fragPos, normal);
    float3 lighting = (ambient + (1.0f - shadow) * (diffuse + specular)) * color;

    return float4(lighting, 1.0f);
}
