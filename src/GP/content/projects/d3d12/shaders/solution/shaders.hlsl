// The shaders of the triangle. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the shaders
// see them as a constant buffer at register b0.
cbuffer OffsetConstants : register(b0)
{
    float xOffset;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 color : COLOR;            // out of the vertex shader, into the pixel shader
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float4 color : COLOR)
{
    PSInput result;

    // The vertex buffer holds 3 floats (x, y, z) per vertex; w is filled in with 1.0.
    result.position = float4(position.x + xOffset, -position.y, position.z, 1.0f);    // upside down, moved right
    result.color = position;    // the position as the colour: x -> red, y -> green, z -> blue

    return result;
}

// The pixel shader: runs once per pixel the triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // The colour from the vertex shader, interpolated across the triangle.
    return input.color;
}
