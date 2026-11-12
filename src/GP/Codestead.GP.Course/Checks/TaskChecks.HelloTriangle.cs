namespace Codestead.GP.Course.Checks;

// Hello Triangle: the orange triangle, then the rectangle from an index buffer.
public static partial class TaskChecks
{
    /// <summary>The orange of the course's first triangle: (1.0, 0.5, 0.2).</summary>
    private static bool Orange(CheckContext c, double x, double y) => c.PixelIs(x, y, 1.0, 0.5, 0.2);

    /// <summary>The triangle (-0.5, -0.5), (0.5, -0.5), (0, 0.5) is drawn in orange (the same place on screen in every API).</summary>
    private static bool TriangleDrawn(CheckContext c) => Orange(c, 0.5, 0.55) && c.IsClear(0.1, 0.1);

    /// <summary>The rectangle (±0.5, ±0.5): all four quarters are orange.</summary>
    private static bool RectangleDrawn(CheckContext c) =>
        Orange(c, 0.3, 0.3) && Orange(c, 0.7, 0.3) && Orange(c, 0.3, 0.7) && Orange(c, 0.7, 0.7) && c.IsClear(0.1, 0.1);

    private static Dictionary<string, TaskCheck> HelloTriangle => new()
    {
        // OpenGL
        ["vertex-shader"] = PerApi(
            opengl: c => c.Built && c.Has(@"glCreateShader \( GL_VERTEX_SHADER \)") && c.Has(@"glCompileShader \( vertexShader \)") && c.Has("GL_COMPILE_STATUS"),
            d3d12: c => c.Built && c.HasIn("shaders.hlsl", @"PSInput VSMain \( float4 position : POSITION \)") && c.HasIn("shaders.hlsl", "SV_POSITION")),
        ["fragment-shader"] = c => c.Built && c.Has(@"glCreateShader \( GL_FRAGMENT_SHADER \)") && c.Has(@"glCompileShader \( fragmentShader \)"),
        ["shader-program"] = c => c.Built && c.Has(@"glLinkProgram \( shaderProgram \)") && c.Has("GL_LINK_STATUS") && c.Has(@"glAttachShader \( shaderProgram , vertexShader \)") && c.Has(@"glAttachShader \( shaderProgram , fragmentShader \)"),
        ["vertex-attributes"] = c => c.Built && c.Has(@"glBindVertexArray \( VAO \)") && c.Has(@"glVertexAttribPointer \( 0 , 3 , GL_FLOAT") && c.Has(@"glEnableVertexAttribArray \( 0 \)"),
        ["element-buffer"] = c => c.Built && c.Has(@"glBufferData \( GL_ELEMENT_ARRAY_BUFFER , sizeof \( indices \) , indices") && c.Has(@"glBindBuffer \( GL_ELEMENT_ARRAY_BUFFER , EBO \)"),
        ["vertex-buffer"] = PerApi(
            opengl: c => c.Built && c.Has(@"glGenBuffers \( 1 , & VBO \)") && c.Has(@"glBufferData \( GL_ARRAY_BUFFER , sizeof \( vertices \) , vertices , GL_STATIC_DRAW \)"),
            vulkan: c => c.Built && c.Has("VK_BUFFER_USAGE_VERTEX_BUFFER_BIT") && c.Has("vkAllocateMemory") && c.Has("vkMapMemory") && c.Has(@"vkDestroyBuffer \( device , vertexBuffer , nullptr \)"),
            d3d12: c => c.Built && c.Has("D3D12_HEAP_TYPE_UPLOAD") && c.Has(@"memcpy \(") && c.Has(@"m_vertexBufferView \. StrideInBytes = sizeof \( Vertex \)")),
        // Vulkan
        ["shaders"] = c => c.Built && c.HasIn("shader.vert", @"layout \( location = 0 \) in vec3 inPosition") && c.HasIn("shader.vert", "gl_Position") && c.HasIn("shader.frag", @"outColor = vec4 \( 1\.0 , 0\.5 , 0\.2 , 1\.0 \)"),
        ["shader-modules"] = c => c.Built && c.Has("vkCreateShaderModule") && c.Has(@"readFile \( ""shaders/vert\.spv"" \)") && c.Has("vkDestroyShaderModule"),
        ["vertex-input"] = c => c.Built && c.Has(@"struct Vertex \{ glm :: vec3 pos ;") && c.Has("getAttributeDescriptions") && c.Has(@"std :: vector < Vertex > vertices"),
        ["fixed-functions"] = c => c.Built && c.Has("vkCreatePipelineLayout") && c.Has(@"cullMode = VK_CULL_MODE_BACK_BIT") && c.Has(@"frontFace = VK_FRONT_FACE_CLOCKWISE"),
        ["pipeline"] = PerApi(
            vulkan: c => c.Built && c.Has("vkCreateGraphicsPipelines") && c.Has(@"vkDestroyPipeline \( device , graphicsPipeline , nullptr \)"),
            d3d12: c => c.Built && c.Has(@"D3DCompileFromFile \( L""shaders\.hlsl""") && c.Has("D3D12_INPUT_ELEMENT_DESC") && c.Has(@"CreateGraphicsPipelineState \(")),
        ["index-buffer"] = PerApi(
            vulkan: c => c.Built && c.Has("VK_BUFFER_USAGE_INDEX_BUFFER_BIT") && c.Has(@"createIndexBuffer \( \) ;"),
            d3d12: RectangleDrawn),
        // DirectX 12
        ["pixel-shader"] = c => c.Built && c.HasIn("shaders.hlsl", @"float4 PSMain \( PSInput input \) : SV_TARGET") && c.HasIn("shaders.hlsl", @"float4 \( 1\.0f , 0\.5f , 0\.2f , 1\.0f \)"),
        ["root-signature"] = c => c.Built && c.Has("D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT") && c.Has(@"CreateRootSignature \("),
        ["rectangle-vertices"] = c => c.Built && c.Has(@"\{ \{ -0\.5f , 0\.5f , 0\.0f \} \}") && c.Has(@"\{ \{ 0\.5f , 0\.5f , 0\.0f \} \}"),
        // Every API
        ["draw"] = TriangleDrawn,
        ["rectangle"] = RectangleDrawn,
    };
}
