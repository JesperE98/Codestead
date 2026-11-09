namespace Codestead.GP.Course.Checks;

// Hello Triangle: the orange triangle, then the rectangle from an index buffer.
public static partial class TaskChecks
{
    /// <summary>The triangle (-0.5, -0.5), (0.5, -0.5), (0, 0.5) is drawn in orange (the same place on screen in every API).</summary>
    private static bool TriangleDrawn(CheckContext c) => Orange(c, 0.5, 0.55) && c.IsClear(0.1, 0.1);

    /// <summary>The rectangle (±0.5, ±0.5): all four quarters are orange.</summary>
    private static bool RectangleDrawn(CheckContext c) =>
        Orange(c, 0.3, 0.3) && Orange(c, 0.7, 0.3) && Orange(c, 0.3, 0.7) && Orange(c, 0.7, 0.7) && c.IsClear(0.1, 0.1);

    private static Dictionary<string, TaskCheck> HelloTriangle => new()
    {
        // OpenGL
        ["vertex-buffer"] = c => c.Built && c.Has(@"glGenBuffers \( 1 , & VBO \)") && c.Has(@"glBufferData \( GL_ARRAY_BUFFER , sizeof \( vertices \) , vertices , GL_STATIC_DRAW \)"),
        ["vertex-shader"] = c => c.Built && c.Has(@"glCreateShader \( GL_VERTEX_SHADER \)") && c.Has(@"glCompileShader \( vertexShader \)") && c.Has("GL_COMPILE_STATUS"),
        ["fragment-shader"] = c => c.Built && c.Has(@"glCreateShader \( GL_FRAGMENT_SHADER \)") && c.Has(@"glCompileShader \( fragmentShader \)"),
        ["shader-program"] = c => c.Built && c.Has(@"glLinkProgram \( shaderProgram \)") && c.Has("GL_LINK_STATUS") && c.Has(@"glAttachShader \( shaderProgram , vertexShader \)") && c.Has(@"glAttachShader \( shaderProgram , fragmentShader \)"),
        ["vertex-attributes"] = c => c.Built && c.Has(@"glBindVertexArray \( VAO \)") && c.Has(@"glVertexAttribPointer \( 0 , 3 , GL_FLOAT") && c.Has(@"glEnableVertexAttribArray \( 0 \)"),
        ["element-buffer"] = c => c.Built && c.Has(@"glBufferData \( GL_ELEMENT_ARRAY_BUFFER , sizeof \( indices \) , indices") && c.Has(@"glBindBuffer \( GL_ELEMENT_ARRAY_BUFFER , EBO \)"),
        // Every API
        ["draw"] = TriangleDrawn,
        ["rectangle"] = RectangleDrawn,
    };
}
