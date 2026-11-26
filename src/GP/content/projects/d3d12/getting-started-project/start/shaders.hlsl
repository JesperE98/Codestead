// The shaders of the rectangle. main.cpp compiles them at run time with D3DCompileFromFile.

// The textures: registers t0 and t1, in the descriptor table of root parameter 0.
Texture2D texture1 : register(t0);    // the container
Texture2D texture2 : register(t1);    // the face
// The samplers: registers s0 and s1, the static samplers of the root signature.
SamplerState wrapSampler : register(s0);     // repeats the texture outside 0..1
SamplerState clampSampler : register(s1);    // stretches its edge pixels outside 0..1

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the pixel
// shader sees them as a constant buffer at register b0.
cbuffer MixConstants : register(b0)
{
    float mixValue;    // how much of the face shows
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
    float2 texCoord : TEXCOORD;      // the texture coordinates, interpolated like the colour
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float4 color : COLOR, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = position;
    result.color = color;
    result.texCoord = texCoord;

    return result;
}

// The pixel shader: runs once per pixel the rectangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // Linearly interpolate between both textures by mixValue (0.5: half and half).
    // The face is mirrored horizontally: u becomes 1 - u.
    return lerp(texture1.Sample(clampSampler, input.texCoord), texture2.Sample(wrapSampler, float2(1.0f - input.texCoord.x, input.texCoord.y)), mixValue);
}
