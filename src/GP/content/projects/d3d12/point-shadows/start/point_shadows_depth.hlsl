// The shaders of the depth pass: they draw the scene from the light into the six faces of the
// depth cubemap, in one pass. main.cpp compiles them at run time with D3DCompileFromFile.

// Root constants (root parameter 0): the model matrix of the draw.
cbuffer ModelConstants : register(b0)
{
    float4x4 model;
};

// The constant buffer at register b1: this pass needs the six shadow matrices, far_plane
// and the light's position (view, projection and viewPos are the camera's).
cbuffer SceneConstantBuffer : register(b1)
{
    float4x4 view;
    float4x4 projection;
    float4x4 shadowMatrices[6];
    float3 viewPos;
    float far_plane;
    float3 lightPos;
};

// What the vertex shader hands on to the geometry shader: the position in world space, in
// SV_POSITION like learnopengl's gl_Position - the geometry shader's output is what the
// rasterizer uses.
struct GSInput
{
    float4 position : SV_POSITION;
};

// What the geometry shader hands on to the rasterizer and the pixel shader.
struct PSInput
{
    float4 position : SV_POSITION;
    float4 fragPos : POSITION;    // FragPos from GS (output per emitvertex)
    uint layer : SV_RenderTargetArrayIndex;    // the cube face (slice) this triangle goes to
};

// TODO: the vertex shader: the position in world space (only the model matrix) - the geometry shader projects it once per cube face

// TODO: the geometry shader (at most 18 vertices): emit the triangle six times, once per cube face: layer = face, fragPos = the world position, position = fragPos times shadowMatrices[face]

// TODO: the pixel shader: return the distance to the light, divided by far_plane, as the depth (SV_Depth)
