#version 150

#moj_import <light.glsl>
#moj_import <fog.glsl>

in vec3 Position;
in vec4 Color;
in vec2 UV0;
in ivec2 UV2;

uniform sampler2D Sampler2;

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;
uniform mat3 IViewRotMat;
uniform int FogShape;

out float vertexDistance;
out vec4 vertexColor;
out vec4 lightColor;
out vec2 texCoord0;

void main() {
    vec3 pos = Position;

    // Shfit chat left 2 px for better alignment
    if (Position.z >= 100 && Position.z <= 101) {
        pos.x -= 2;
    }    

    gl_Position = ProjMat * ModelViewMat * vec4(pos, 1.0);
    vertexDistance = fog_distance(ModelViewMat, IViewRotMat * Position, FogShape);
    vertexColor = Color;
    lightColor = minecraft_sample_lightmap(Sampler2, UV2);
    texCoord0 = UV0;
}