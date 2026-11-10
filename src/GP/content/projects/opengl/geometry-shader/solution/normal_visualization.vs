#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out VS_OUT {
    vec3 normal;
} vs_out;

uniform mat4 view;
uniform mat4 model;

void main()
{
    // the geometry shader works in view space: the position and the normal are only multiplied by view * model
    mat3 normalMatrix = mat3(transpose(inverse(view * model)));
    vs_out.normal = normalize(normalMatrix * aNormal); // normalized: the model is scaled, the lines must still be 0.2 long
    gl_Position = view * model * vec4(aPos, 1.0);
}
