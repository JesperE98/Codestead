import { type CheckContext } from "../CheckContext.js";
import { perApi, type Checks } from "./TaskChecks.PerApi.js";

// Hello Triangle: the orange triangle, then the rectangle from an index buffer.

/** The orange of the course's first triangle: (1.0, 0.5, 0.2). */

export function orange(c: CheckContext, x: number, y: number): boolean {
  return c.pixelIs(x, y, 1.0, 0.5, 0.2);
}

/** The triangle (-0.5, -0.5), (0.5, -0.5), (0, 0.5) is drawn in orange (the same place on screen in every API). */

export function triangleDrawn(c: CheckContext): boolean {
  return orange(c, 0.5, 0.55) && c.isClear(0.1, 0.1);
}

/** The rectangle (±0.5, ±0.5): all four quarters are orange. */

export function rectangleDrawn(c: CheckContext): boolean {
  return orange(c, 0.3, 0.3) && orange(c, 0.7, 0.3) && orange(c, 0.3, 0.7) && orange(c, 0.7, 0.7) && c.isClear(0.1, 0.1);
}

export function helloTriangle(): Checks {
  return {
    // OpenGL
    "vertex-shader": perApi({
        opengl: c => c.built && c.has("glCreateShader \\( GL_VERTEX_SHADER \\)") && c.has("glCompileShader \\( vertexShader \\)") && c.has("GL_COMPILE_STATUS"),
        d3d12: c => c.built && c.hasIn("shaders.hlsl", "PSInput VSMain \\( float4 position : POSITION \\)") && c.hasIn("shaders.hlsl", "SV_POSITION")}),
    "fragment-shader": c => c.built && c.has("glCreateShader \\( GL_FRAGMENT_SHADER \\)") && c.has("glCompileShader \\( fragmentShader \\)"),
    "shader-program": c => c.built && c.has("glLinkProgram \\( shaderProgram \\)") && c.has("GL_LINK_STATUS") && c.has("glAttachShader \\( shaderProgram , vertexShader \\)") && c.has("glAttachShader \\( shaderProgram , fragmentShader \\)"),
    "vertex-attributes": c => c.built && c.has("glBindVertexArray \\( VAO \\)") && c.has("glVertexAttribPointer \\( 0 , 3 , GL_FLOAT") && c.has("glEnableVertexAttribArray \\( 0 \\)"),
    "element-buffer": c => c.built && c.has("glBufferData \\( GL_ELEMENT_ARRAY_BUFFER , sizeof \\( indices \\) , indices") && c.has("glBindBuffer \\( GL_ELEMENT_ARRAY_BUFFER , EBO \\)"),
    "vertex-buffer": perApi({
        opengl: c => c.built && c.has("glGenBuffers \\( 1 , & VBO \\)") && c.has("glBufferData \\( GL_ARRAY_BUFFER , sizeof \\( vertices \\) , vertices , GL_STATIC_DRAW \\)"),
        vulkan: c => c.built && c.has("VK_BUFFER_USAGE_VERTEX_BUFFER_BIT") && c.has("vkAllocateMemory") && c.has("vkMapMemory") && c.has("vkDestroyBuffer \\( device , vertexBuffer , nullptr \\)"),
        d3d12: c => c.built && c.has("D3D12_HEAP_TYPE_UPLOAD") && c.has("memcpy \\(") && c.has("m_vertexBufferView \\. StrideInBytes = sizeof \\( Vertex \\)")}),
    // Vulkan
    "shaders": c => c.built && c.hasIn("shader.vert", "layout \\( location = 0 \\) in vec3 inPosition") && c.hasIn("shader.vert", "gl_Position") && c.hasIn("shader.frag", "outColor = vec4 \\( 1\\.0 , 0\\.5 , 0\\.2 , 1\\.0 \\)"),
    "shader-modules": c => c.built && c.has("vkCreateShaderModule") && c.has("readFile \\( \"shaders/vert\\.spv\" \\)") && c.has("vkDestroyShaderModule"),
    "vertex-input": c => c.built && c.has("struct Vertex \\{ glm :: vec3 pos ;") && c.has("getAttributeDescriptions") && c.has("std :: vector < Vertex > vertices"),
    "fixed-functions": c => c.built && c.has("vkCreatePipelineLayout") && c.has("cullMode = VK_CULL_MODE_BACK_BIT") && c.has("frontFace = VK_FRONT_FACE_CLOCKWISE"),
    "pipeline": perApi({
        vulkan: c => c.built && c.has("vkCreateGraphicsPipelines") && c.has("vkDestroyPipeline \\( device , graphicsPipeline , nullptr \\)"),
        d3d12: c => c.built && c.has("D3DCompileFromFile \\( L\"shaders\\.hlsl\"") && c.has("D3D12_INPUT_ELEMENT_DESC") && c.has("CreateGraphicsPipelineState \\(")}),
    "index-buffer": perApi({
        vulkan: c => c.built && c.has("VK_BUFFER_USAGE_INDEX_BUFFER_BIT") && c.has("createIndexBuffer \\( \\) ;"),
        d3d12: rectangleDrawn}),
    // DirectX 12
    "pixel-shader": c => c.built && c.hasIn("shaders.hlsl", "float4 PSMain \\( PSInput input \\) : SV_TARGET") && c.hasIn("shaders.hlsl", "float4 \\( 1\\.0f , 0\\.5f , 0\\.2f , 1\\.0f \\)"),
    "root-signature": c => c.built && c.has("D3D12_ROOT_SIGNATURE_FLAG_ALLOW_INPUT_ASSEMBLER_INPUT_LAYOUT") && c.has("CreateRootSignature \\("),
    "rectangle-vertices": c => c.built && c.has("\\{ \\{ -0\\.5f , 0\\.5f , 0\\.0f \\} \\}") && c.has("\\{ \\{ 0\\.5f , 0\\.5f , 0\\.0f \\} \\}"),
    // Every API
    "draw": triangleDrawn,
    "rectangle": rectangleDrawn,
    // Exercises, each on the finished rectangle (relative window points; the same place on screen in every API).
    "ex-colour": c => c.pixelIs(0.5, 0.6, 0.2, 0.8, 0.4) && c.pixelIs(0.3, 0.3, 0.2, 0.8, 0.4) && c.isClear(0.1, 0.1),
    // 0.4 wide and 1.6 high: orange near the top and bottom edges, the clear colour where the rectangle used to reach.
    "ex-tall": c => orange(c, 0.5, 0.15) && orange(c, 0.5, 0.85) && c.isClear(0.35, 0.5) && c.isClear(0.65, 0.5),
    // A roof above the rectangle: orange under the peak, clear beside it, and the body still there.
    "ex-house": c => orange(c, 0.5, 0.13) && c.isClear(0.3, 0.15) && c.isClear(0.7, 0.15) && rectangleDrawn(c),
    // Only the edges: the inside of both triangles is the clear colour, but orange lines are drawn.
    "ex-wireframe": c => c.isClear(0.35, 0.62) && c.isClear(0.62, 0.35) && c.anyDrawnPixel(p => p[0] > 0.8 && p[1] > 0.35 && p[1] < 0.65 && p[2] < 0.35),
  };
}
