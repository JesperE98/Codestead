// The terrain, tessellated on the GPU: vertex shader -> hull shader (OpenGL's tessellation
// control shader) -> the fixed-function tessellator -> domain shader (OpenGL's tessellation
// evaluation shader) -> pixel shader.

cbuffer SceneConstantBuffer : register(b0)
{
    float4x4 model;
    float4x4 view;
    float4x4 projection;
};

// The height map, read by the domain shader.
Texture2D heightMap : register(t0);
SamplerState heightMapSampler : register(s0);

// A control point of a patch, as the vertex shader hands it on.
struct VSOutput
{
    float4 position : POSITION;
    float2 texCoord : TEXCOORD;
};

// The vertex shader passes the control points through: the hull and domain shaders
// do the work.
VSOutput VSMain(float3 position : POSITION, float2 texCoord : TEXCOORD)
{
    VSOutput result;

    result.position = float4(position, 1.0f);
    result.texCoord = texCoord;

    return result;
}

// A control point as the hull shader outputs it (the same).
struct HSOutput
{
    float4 position : POSITION;
    float2 textureCoord : TEXCOORD;
};

// What the patch constant function computes once per patch: how finely the tessellator
// divides the quad - one factor per edge (OpenGL's gl_TessLevelOuter[4]) and two for its
// inside (gl_TessLevelInner[2]). Edge 0 is the edge u = 0, edge 1 v = 0, edge 2 u = 1,
// edge 3 v = 1 - the same order as OpenGL's.
struct HSConstantOutput
{
    float edges[4] : SV_TessFactor;
    float inside[2] : SV_InsideTessFactor;
};

// The patch constant function: the part of OpenGL's tessellation control shader inside
// if (gl_InvocationID == 0), which Direct3D runs once per patch.
HSConstantOutput PatchConstantFunction(InputPatch<VSOutput, 4> patch)
{
    HSConstantOutput output;

    // TODO: how finely to tessellate - for now 1 everywhere: no new vertices, every patch stays
    // one quad (Direct3D needs a hull shader for a tessellated pipeline, OpenGL can do without)
    output.edges[0] = 1;
    output.edges[1] = 1;
    output.edges[2] = 1;
    output.edges[3] = 1;

    output.inside[0] = 1;
    output.inside[1] = 1;

    return output;
}

// The hull shader: runs once per output control point (SV_OutputControlPointID, OpenGL's
// gl_InvocationID) and passes it through. The attributes describe the patch: a quad
// domain, fractional odd spacing, triangles in counter-clockwise order, 4 control points
// out, and the function that sets the tessellation factors.
[domain("quad")]
[partitioning("fractional_odd")]
[outputtopology("triangle_ccw")]
[outputcontrolpoints(4)]
[patchconstantfunc("PatchConstantFunction")]
HSOutput HSMain(InputPatch<VSOutput, 4> patch, uint i : SV_OutputControlPointID)
{
    HSOutput output;

    output.position = patch[i].position;
    output.textureCoord = patch[i].texCoord;

    return output;
}

// What the domain shader hands on to the rasterizer and the pixel shader.
struct DSOutput
{
    float4 position : SV_POSITION;
    float height : HEIGHT;
};

// The domain shader: runs once per vertex the tessellator makes, with the vertex's place in the
// quad (SV_DomainLocation, OpenGL's gl_TessCoord) and the patch's control points.
// TODO: place each new vertex in its patch (bilinear interpolation of the corners) and move it
// up by the height from the texture
[domain("quad")]
DSOutput DSMain(HSConstantOutput patchConstants, float2 tessCoord : SV_DomainLocation, const OutputPatch<HSOutput, 4> patch)
{
    DSOutput output;

    output.height = 0.0f;
    output.position = float4(0.0f, 0.0f, 0.0f, 0.0f);

    return output;
}

float4 PSMain(DSOutput input) : SV_TARGET
{
    float h = (input.height + 16.0f) / 64.0f;
    return float4(h, h, h, 1.0f);
}
