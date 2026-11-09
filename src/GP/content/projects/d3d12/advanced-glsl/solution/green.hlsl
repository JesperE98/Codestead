// The pixel shader of the green cube. main.cpp compiles it at run time with D3DCompileFromFile.

float4 PSMain(float4 position : SV_POSITION) : SV_TARGET
{
    return float4(0.0f, 1.0f, 0.0f, 1.0f);
}
