// The compute shader: one thread per pixel of the texture, in thread groups of
// 10 x 10 x 1 threads (GLSL's local_size_x/y/z).

// The texture the compute shader writes: a read-write texture of float4 pixels,
// register u0 (an unordered access view; GLSL's image2D at binding 0).
RWTexture2D<float4> imgOutput : register(u0);

// The time, in seconds: root constants at register b0.
cbuffer TimeConstants : register(b0)
{
    float t;
};

[numthreads(10, 10, 1)]
void CSMain(uint3 dispatchThreadID : SV_DispatchThreadID)
{
    float4 value = float4(0.0f, 0.0f, 0.0f, 1.0f);
    // SV_DispatchThreadID: the thread's position among all threads of the dispatch
    // (GLSL's gl_GlobalInvocationID) - here the pixel it writes.
    int2 texelCoord = int2(dispatchThreadID.xy);
    float speed = 100.0f;
    // the width of the texture
    float width = 1000.0f;

    // The texture's size: all the threads of the dispatch, one per pixel (GLSL's
    // gl_NumWorkGroups * gl_WorkGroupSize - HLSL has no number of groups).
    uint imageWidth, imageHeight;
    imgOutput.GetDimensions(imageWidth, imageHeight);

    value.x = fmod(float(texelCoord.x) + t * speed, width) / imageWidth;
    value.y = float(texelCoord.y) / imageHeight;
    imgOutput[texelCoord] = value;
}
