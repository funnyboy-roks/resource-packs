#version 150

// Modifications by Godlander

in vec3 Position;
in vec4 Color;

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;
uniform vec2 ScreenSize;

out vec4 vertexColor;

bool rougheq(vec3 a, vec3 b) {
    return all(lessThan(abs(a - b), vec3(0.01)));
}
int toint(ivec3 v) {
    return v.x << 16 | v.y << 8 | v.z;
}

void main() {
    vec3 pos = Position;
    vertexColor = Color;

    // Remove Bar to the left of chat prompt
    if (Position.z == 0 && Position.x <= 2 && toint(ivec3(Color.rgb*255)) == 0x77B3E9) {
        vertexColor = vec4(0);
    }

    // Shift the chat bar to the left 1 px to make left and bottom the same size -- Still can't get the right margin to be 1px >:(
    if(Position.z == 0 && Position.y > 250 && toint(ivec3(Color.rgb*255)) == 0) {
        pos.x -= 1;
    }

    // Remove the chat bars to the left of the chat
    if (Position.x <= 2 && Position.z == 50 && Color.a > .5) {
        vertexColor = vec4(0);
    }

    // Clean up scroll bar
    if (Position.z == 0 && Color.a < 1) {
        // Remove blue part of scroll bar
        if (rougheq(Color.rgb, vec3(51,51,170)/255.)) {
            vertexColor = vec4(0);
        }

        // Shift grey part right 2 px
        if (rougheq(Color.rgb, vec3(204)/255.)) {
            pos.x += 2; vertexColor = vec4(0.7);
        }
    }
    gl_Position = ProjMat * ModelViewMat * vec4(pos, 1.0);
    // gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);
}