// The shaders of the brick wall. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures, in the descriptor table of root parameter 2: the diffuse map (t0), the
// normal map (t1) and the depth map (t2).
Texture2D diffuseMap : register(t0);
Texture2D normalMap : register(t1);
Texture2D depthMap : register(t2);
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
    float heightScale;    // how deep the surface goes, in texture units
    float3 lightPos;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float3 fragPos : POSITION;    // the position in world space
    float2 texCoords : TEXCOORD0;
    // the positions the lighting needs, in tangent space
    float3 tangentLightPos : TEXCOORD1;
    float3 tangentViewPos : TEXCOORD2;
    float3 tangentFragPos : TEXCOORD3;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD, float3 tangent : TANGENT, float3 bitangent : BINORMAL)
{
    PSInput result;

    float4 worldPos = mul(position, model);
    result.fragPos = worldPos.xyz;
    result.texCoords = texCoords;

    // The tangent, the bitangent and the normal in world space (w = 0: directions).
    float3 T = normalize(mul(float4(tangent, 0.0f), normalMatrix).xyz);
    float3 N = normalize(mul(float4(normal, 0.0f), normalMatrix).xyz);
    T = normalize(T - dot(T, N) * N); // Gram-Schmidt: make T perpendicular to N again
    // B from T and N: cross(T, N) points down the image, like the bitangent with Direct3D's
    // v (learnopengl's cross(N, T) points up: its v grows up the image)
    float3 B = cross(T, N);

    // world space -> tangent space: T, B and N as the rows of the matrix (the inverse of an
    // orthonormal matrix is its transpose - learnopengl: transpose(mat3(T, B, N)))
    float3x3 TBN = float3x3(T, B, N);
    result.tangentLightPos = mul(TBN, lightPos);
    result.tangentViewPos = mul(TBN, viewPos);
    result.tangentFragPos = mul(TBN, result.fragPos);

    result.position = mul(mul(worldPos, view), projection);

    return result;
}

// The texture coordinates where the view ray really hits the deep surface (parallax
// occlusion mapping): step along the ray, layer by layer, until it is below the depth map's
// surface, then interpolate between the last two layers.
float2 ParallaxMapping(float2 texCoords, float3 viewDir)
{
    // number of depth layers: more when the view is flat to the surface
    const float minLayers = 8.0f;
    const float maxLayers = 32.0f;
    float numLayers = lerp(maxLayers, minLayers, abs(dot(float3(0.0f, 0.0f, 1.0f), viewDir)));
    // calculate the size of each layer
    float layerDepth = 1.0f / numLayers;
    // depth of current layer
    float currentLayerDepth = 0.0f;
    // the amount to shift the texture coordinates per layer (from vector P)
    float2 P = viewDir.xy / viewDir.z * heightScale;
    float2 deltaTexCoords = P / numLayers;

    // get initial values. SampleLevel(..., 0): mip level 0 - inside a loop whose number of
    // steps differs from pixel to pixel the hardware cannot work out the mip level (Sample
    // needs it from the neighbouring pixels), and the compiler refuses Sample there.
    float2 currentTexCoords = texCoords;
    float currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;

    while (currentLayerDepth < currentDepthMapValue)
    {
        // shift texture coordinates along direction of P
        currentTexCoords -= deltaTexCoords;
        // get depthmap value at current texture coordinates
        currentDepthMapValue = depthMap.SampleLevel(wrapSampler, currentTexCoords, 0).r;
        // get depth of next layer
        currentLayerDepth += layerDepth;
    }

    // get texture coordinates before collision (reverse operations)
    float2 prevTexCoords = currentTexCoords + deltaTexCoords;

    // get depth after and before collision for linear interpolation
    float afterDepth = currentDepthMapValue - currentLayerDepth;
    float beforeDepth = depthMap.SampleLevel(wrapSampler, prevTexCoords, 0).r - currentLayerDepth + layerDepth;

    // interpolation of texture coordinates
    float weight = afterDepth / (afterDepth - beforeDepth);
    float2 finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0f - weight);

    return finalTexCoords;
}

// The pixel shader: runs once per pixel the quad covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // offset texture coordinates with Parallax Mapping
    float3 viewDir = normalize(input.tangentViewPos - input.tangentFragPos);
    float2 texCoords = input.texCoords;

    texCoords = ParallaxMapping(input.texCoords, viewDir);
    if (texCoords.x > 1.0f || texCoords.y > 1.0f || texCoords.x < 0.0f || texCoords.y < 0.0f)
        discard;

    // obtain normal from normal map
    float3 normal = normalMap.Sample(wrapSampler, texCoords).rgb;
    normal = normalize(normal * 2.0f - 1.0f);  // this normal is in tangent space
    // The normal map is OpenGL-style: its y (green) points up the image. In Direct3D, v and
    // so the bitangent point down the image: flip y (a DirectX-style normal map stores it so).
    normal.y = -normal.y;

    // get diffuse color
    float3 color = diffuseMap.Sample(wrapSampler, texCoords).rgb;
    // ambient
    float3 ambient = 0.1f * color;
    // diffuse
    float3 lightDir = normalize(input.tangentLightPos - input.tangentFragPos);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * color;
    // specular
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);

    float3 specular = float3(0.2f, 0.2f, 0.2f) * spec;
    return float4(ambient + diffuse + specular, 1.0f);
}
