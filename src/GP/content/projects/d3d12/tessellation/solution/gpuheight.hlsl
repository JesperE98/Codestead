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

    // ----------------------------------------------------------------------
    // Step 1: define constants to control tessellation parameters
    // set these as desired for your world height
    const int MIN_TESS_LEVEL = 4;
    const int MAX_TESS_LEVEL = 16;
    const float MIN_DISTANCE = 100;
    const float MAX_DISTANCE = 450;

    // ----------------------------------------------------------------------
    // Step 2: transform each vertex into eye space
    float4 eyeSpacePos00 = mul(mul(patch[0].position, model), view);
    float4 eyeSpacePos01 = mul(mul(patch[1].position, model), view);
    float4 eyeSpacePos10 = mul(mul(patch[2].position, model), view);
    float4 eyeSpacePos11 = mul(mul(patch[3].position, model), view);

    // ----------------------------------------------------------------------
    // Step 3: "distance" from camera scaled between 0 and 1
    float distance00 = clamp((abs(eyeSpacePos00.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f, 1.0f);
    float distance01 = clamp((abs(eyeSpacePos01.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f, 1.0f);
    float distance10 = clamp((abs(eyeSpacePos10.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f, 1.0f);
    float distance11 = clamp((abs(eyeSpacePos11.z) - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0.0f, 1.0f);

    // ----------------------------------------------------------------------
    // Step 4: interpolate edge tessellation level based on closer vertex
    // (HLSL's lerp is GLSL's mix)
    float tessLevel0 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance10, distance00));
    float tessLevel1 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance00, distance01));
    float tessLevel2 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance01, distance11));
    float tessLevel3 = lerp(MAX_TESS_LEVEL, MIN_TESS_LEVEL, min(distance11, distance10));

    // ----------------------------------------------------------------------
    // Step 5: set the corresponding outer edge tessellation levels
    output.edges[0] = tessLevel0;
    output.edges[1] = tessLevel1;
    output.edges[2] = tessLevel2;
    output.edges[3] = tessLevel3;

    // ----------------------------------------------------------------------
    // Step 6: set the inner tessellation levels to the max of the two parallel edges
    output.inside[0] = max(tessLevel1, tessLevel3);
    output.inside[1] = max(tessLevel0, tessLevel2);

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

// The domain shader: runs once per vertex the tessellator makes, with the vertex's place
// in the quad (SV_DomainLocation, OpenGL's gl_TessCoord) and the patch's control points.
[domain("quad")]
DSOutput DSMain(HSConstantOutput patchConstants, float2 tessCoord : SV_DomainLocation, const OutputPatch<HSOutput, 4> patch)
{
    DSOutput output;

    // get patch coordinate
    float u = tessCoord.x;
    float v = tessCoord.y;

    // ----------------------------------------------------------------------
    // retrieve control point texture coordinates
    float2 t00 = patch[0].textureCoord;
    float2 t01 = patch[1].textureCoord;
    float2 t10 = patch[2].textureCoord;
    float2 t11 = patch[3].textureCoord;

    // bilinearly interpolate texture coordinate across patch
    float2 t0 = (t01 - t00) * u + t00;
    float2 t1 = (t11 - t10) * u + t10;
    float2 texCoord = (t1 - t0) * v + t0;

    // lookup texel at patch coordinate for height and scale + shift as desired
    // (SampleLevel: outside the pixel shader there are no derivatives to pick a mip level)
    output.height = heightMap.SampleLevel(heightMapSampler, texCoord, 0).r * 64.0f - 16.0f;

    // ----------------------------------------------------------------------
    // retrieve control point position coordinates
    float4 p00 = patch[0].position;
    float4 p01 = patch[1].position;
    float4 p10 = patch[2].position;
    float4 p11 = patch[3].position;

    // compute patch surface normal
    float4 uVec = p01 - p00;
    float4 vVec = p10 - p00;
    float4 normal = normalize(float4(cross(vVec.xyz, uVec.xyz), 0.0f));

    // bilinearly interpolate position coordinate across patch
    float4 p0 = (p01 - p00) * u + p00;
    float4 p1 = (p11 - p10) * u + p10;
    float4 p = (p1 - p0) * v + p0 + normal * output.height;

    // ----------------------------------------------------------------------
    // output patch point position in clip space
    output.position = mul(mul(mul(p, model), view), projection);

    return output;
}

float4 PSMain(DSOutput input) : SV_TARGET
{
    float h = (input.height + 16.0f) / 64.0f;
    return float4(h, h, h, 1.0f);
}
