// The shaders of the brick wall. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures, in the descriptor table of root parameter 2: the diffuse map (t0) and the
// normal map (t1).
Texture2D diffuseMap : register(t0);
Texture2D normalMap : register(t1);
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

// The pixel shader: runs once per pixel the quad covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // obtain normal from normal map in range [0,1]
    float3 normal = normalMap.Sample(wrapSampler, input.texCoords).rgb;
    // transform normal vector to range [-1,1]
    normal = normalize(normal * 2.0f - 1.0f);  // this normal is in tangent space
    // The normal map is OpenGL-style: its y (green) points up the image. In Direct3D, v and
    // so the bitangent point down the image: flip y (a DirectX-style normal map stores it so).
    normal.y = -normal.y;

    // get diffuse color
    float3 color = diffuseMap.Sample(wrapSampler, input.texCoords).rgb;
    // ambient
    float3 ambient = 0.1f * color;
    // diffuse
    float3 lightDir = normalize(input.tangentLightPos - input.tangentFragPos);
    float diff = max(dot(lightDir, normal), 0.0f);
    float3 diffuse = diff * color;
    // specular
    float3 viewDir = normalize(input.tangentViewPos - input.tangentFragPos);
    float3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0f), 32.0f);

    float3 specular = float3(0.2f, 0.2f, 0.2f) * spec;
    return float4(ambient + diffuse + specular, 1.0f);
}
