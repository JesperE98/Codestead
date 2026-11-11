#version 330 core
out vec4 FragColor;

in float Height;

void main()
{
    float h = (Height + 16.0) / 64.0; // shift and scale the height into a grey value (0 .. 1)
    FragColor = vec4(h, h, h, 1.0);
}
