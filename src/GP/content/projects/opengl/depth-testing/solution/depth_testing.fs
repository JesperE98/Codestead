#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D texture1;

float near = 0.1;
float far = 100.0;
float LinearizeDepth(float depth)
{
    float z = depth * 2.0 - 1.0; // back to NDC (OpenGL maps NDC z -1..1 to depth 0..1)
    return (2.0 * near * far) / (far + near - z * (far - near));
}

void main()
{
    // FragColor = texture(texture1, TexCoords);
    float depth = LinearizeDepth(gl_FragCoord.z) / far; // divide by far to get depth in range [0,1] for visualization purposes
    FragColor = vec4(vec3(depth), 1.0);
}
