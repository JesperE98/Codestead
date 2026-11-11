// The compute shader: one thread per texel of the texture, in thread groups of 10 x 10 x 1
// threads ([numthreads], GLSL's local_size_x/y/z).

// TODO: the texture as a RWTexture2D<float4> at register u0, thread groups of 10 x 10 x 1, and in
// CSMain one thread per texel that writes red = x / width and green = y / height
[numthreads(1, 1, 1)]
void CSMain(uint3 dispatchThreadID : SV_DispatchThreadID)
{
}
