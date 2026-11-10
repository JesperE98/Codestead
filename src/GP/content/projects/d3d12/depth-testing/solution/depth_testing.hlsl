// The shaders. main.cpp compiles them at run time with D3DCompileFromFile.

// The texture of the draw: register t0, in the descriptor table of root parameter 2.
Texture2D texture1 : register(t0);
// The sampler: register s0, the static sampler of the root signature (WRAP: the floor's
// texture coordinates go up to 2, so its texture repeats).
SamplerState wrapSampler : register(s0);

// Root constants set from main.cpp with SetGraphicsRoot32BitConstants: the vertex
// shader sees them as a constant buffer at register b0.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1 (the CBV in root parameter 1's table): the
// view and projection matrices, the same for every draw of a frame.
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
};

// What the vertex shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader: runs once per vertex.
PSInput VSMain(float4 position : POSITION, float2 texCoord : TEXCOORD)
{
    PSInput result;

    // model, then view, then projection (GLSL: projection * view * model * position).
    result.position = mul(mul(mul(position, model), view), projection);
    result.texCoord = texCoord;

    return result;
}

// The projection's near and far planes (static const: constants of the shader itself,
// not values in a constant buffer).
static const float near = 0.1f;
static const float far = 100.0f;

// Turns a depth value (0..1, not linear) back into the distance from the camera. Direct3D's
// depth is 0..1 already (OpenGL's NDC z is -1..1, so learnopengl first does z * 2.0 - 1.0).
float LinearizeDepth(float depth)
{
    return (near * far) / (far - depth * (far - near));
}

// The pixel shader: runs once per pixel a triangle covers and returns its colour (RGBA).
float4 PSMain(PSInput input) : SV_TARGET
{
    // divide by far to get depth in range [0,1] for visualization purposes
    float depth = LinearizeDepth(input.position.z) / far;
    return float4(depth, depth, depth, 1.0f);
}
