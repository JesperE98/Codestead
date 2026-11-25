#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

uniform sampler2D screenTexture;

void main()
{
    vec3 col = texture(screenTexture, TexCoords).rgb;
    // a vignette: full brightness in the middle, fading to black towards the corners
    float distanceFromCentre = length(TexCoords - vec2(0.5));
    col *= 1.0 - smoothstep(0.4, 0.7, distanceFromCentre);
    FragColor = vec4(col, 1.0);
}
