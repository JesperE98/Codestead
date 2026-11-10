#version 330 core
out float FragColor;

in vec2 TexCoords;

uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D texNoise;

uniform vec3 samples[32];

// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
int kernelSize = 32;
float radius = 0.5;
float bias = 0.025;

// tile noise texture over screen based on screen dimensions divided by noise size
const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0);

uniform mat4 projection;

void main()
{
    // TODO: the occlusion factor: a TBN matrix from the normal and the random vector, then for every kernel sample its view-space position,
    //       projected to the screen to look up the depth stored there; count the samples behind that surface (with the range check)
}
