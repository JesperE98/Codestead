// The shaders of the exploding model (learnopengl's explode.vs / .gs / .fs). main.cpp compiles
// them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants (root parameter 0).
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float time;    // seconds since the first frame
};

// The mesh's diffuse map (register t0, learnopengl's texture_diffuse1) and the sampler.
Texture2D texture_diffuse1 : register(t0);
SamplerState wrapSampler : register(s0);

// What the vertex shader hands on to the geometry shader.
struct VSOutput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct GSOutput
{
    float4 position : SV_POSITION;
    float2 texCoords : TEXCOORD;
};

VSOutput VSMain(float4 position : POSITION, float3 normal : NORMAL, float2 texCoords : TEXCOORD)
{
    VSOutput result;

    result.texCoords = texCoords;
    result.position = mul(mul(mul(position, model), view), projection);

    return result;
}

// Moves a position along a direction: 0 .. 2 units and back, following sin(time).
float4 explode(float4 position, float3 normal)
{
    float magnitude = 2.0f;
    float3 direction = normal * ((sin(time) + 1.0f) / 2.0f) * magnitude;
    return position + float4(direction, 0.0f);
}

// The normal of a triangle: the cross product of two of its sides.
float3 GetNormal(float4 position0, float4 position1, float4 position2)
{
    float3 a = position0.xyz - position1.xyz;
    float3 b = position2.xyz - position1.xyz;
    return normalize(cross(a, b));
}

// The geometry shader: runs once per triangle (its three vertices, as the vertex shader
// left them) and emits a triangle strip of at most 3 vertices: the same triangle again.
[maxvertexcount(3)]
void GSMain(triangle VSOutput input[3], inout TriangleStream<GSOutput> triStream)
{
    GSOutput output;
    float3 normal = GetNormal(input[0].position, input[1].position, input[2].position);

    output.position = explode(input[0].position, normal);
    output.texCoords = input[0].texCoords;
    triStream.Append(output);
    output.position = explode(input[1].position, normal);
    output.texCoords = input[1].texCoords;
    triStream.Append(output);
    output.position = explode(input[2].position, normal);
    output.texCoords = input[2].texCoords;
    triStream.Append(output);
    triStream.RestartStrip();
}

float4 PSMain(GSOutput input) : SV_TARGET
{
    return texture_diffuse1.Sample(wrapSampler, input.texCoords);
}
