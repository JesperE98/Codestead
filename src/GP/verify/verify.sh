#!/usr/bin/env bash
# Checks that the course's projects are correct C++ and shaders, with the real tools – not the app's simulator.
#
#   src/GP/verify/verify.sh src/GP/content/projects/opengl/hello-triangle/solution [more project folders …]
#
# The API is taken from the path (projects/<api>/…).
#   opengl: compiled with g++ against GLFW and a generated GLAD (OpenGL 3.3 core), shader files checked with
#           glslangValidator, then RUN under Xvfb with Mesa (llvmpipe); a screenshot of the window is saved.
#   vulkan: shaders compiled to SPIR-V with glslangValidator, compiled with g++ against GLFW and Vulkan, then RUN
#           under Xvfb on lavapipe with the Khronos validation layer; any validation message fails the check.
#   d3d12:  compiled (syntax only) with MinGW-w64 against the official DirectX-Headers (d3dx12.h), and the HLSL
#           checked with glslangValidator's HLSL front end. It cannot run without Windows.
#
# Needs (Ubuntu 24.04): g++ libglfw3-dev libvulkan-dev glslang-tools g++-mingw-w64-x86-64 xvfb x11-apps
#   imagemagick mesa-vulkan-drivers vulkan-validationlayers libgl1-mesa-dri libstb-dev libassimp-dev
#   libtinyobjloader-dev, and `pip install glad` (GLAD 1).
# Screenshots go to $VERIFY_OUT (default /tmp/codestead-gp-verify) as <api>-<chapter>-<folder>.png.
set -uo pipefail

OUT="${VERIFY_OUT:-/tmp/codestead-gp-verify}"
CACHE="${VERIFY_CACHE:-$HOME/.cache/codestead-gp-verify}"
mkdir -p "$OUT" "$CACHE"
status=0

glad_dir() {
  if [ ! -f "$CACHE/glad/src/glad.c" ]; then
    glad --profile core --api gl=3.3 --generator c --out-path "$CACHE/glad" >/dev/null
  fi
  echo "$CACHE/glad"
}

dx_headers() {
  local dir="$CACHE/DirectX-Headers"
  if [ ! -f "$dir/d3dx12_core.h" ]; then
    mkdir -p "$dir"
    for f in d3dx12.h d3d12.h d3dcommon.h dxgicommon.h dxgiformat.h d3d12sdklayers.h d3dx12_barriers.h d3dx12_core.h \
      d3dx12_default.h d3dx12_pipeline_state_stream.h d3dx12_render_pass.h d3dx12_resource_helpers.h \
      d3dx12_root_signature.h d3dx12_property_format_table.h d3d12video.h d3dx12_check_feature_support.h d3dx12_state_object.h; do
      curl -fsSL -o "$dir/$f" "https://raw.githubusercontent.com/microsoft/DirectX-Headers/main/include/directx/$f"
    done
    # DirectXMath (XMFLOAT4, XMMATRIX …), header-only.
    for f in DirectXMath.h DirectXMathConvert.inl DirectXMathMatrix.inl DirectXMathMisc.inl DirectXMathVector.inl \
      DirectXColors.h DirectXCollision.h DirectXCollision.inl DirectXPackedVector.h DirectXPackedVector.inl; do
      curl -fsSL -o "$dir/$f" "https://raw.githubusercontent.com/microsoft/DirectXMath/main/Inc/$f"
    done
  fi
  echo "$dir"
}

start_x() {
  if [ -z "${XVFB_PID:-}" ]; then
    # A free display number of its own, so several checks can run at the same time.
    local n
    for n in $(seq $(( 100 + RANDOM % 800 )) 999); do
      [ -e "/tmp/.X$n-lock" ] || [ -e "/tmp/.X11-unix/X$n" ] || break
    done
    Xvfb ":$n" -screen 0 1280x1024x24 >/dev/null 2>&1 &
    XVFB_PID=$!
    XVFB_DISPLAY=":$n"
    sleep 1
  fi
  export DISPLAY="$XVFB_DISPLAY"
}

# Runs the program for a few seconds, takes a screenshot of the window area and stops it.
run_and_shoot() {
  local exe="$1" name="$2" log="$3"
  start_x
  ( "$exe" >"$log" 2>&1 ) &
  local pid=$!
  sleep "${VERIFY_WAIT:-3}"
  xwd -root -silent | convert xwd:- -crop "${VERIFY_SIZE:-800x600}+0+0" "$OUT/$name.png"
  kill "$pid" 2>/dev/null; sleep 0.3; kill -9 "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  # The colour in the middle and at a few points, for a quick look.
  echo "    pixels (centre, top-centre, bottom-left): $(convert "$OUT/$name.png" -format '%[pixel:p{400,300}] %[pixel:p{400,150}] %[pixel:p{100,500}]' info:)"
}

fail() { echo "  FAIL: $*"; status=1; }

for dir in "$@"; do
  dir="${dir%/}"
  api=$(echo "$dir" | sed -n 's#.*projects/\([^/]*\)/.*#\1#p')
  name=$(echo "$dir" | sed -n 's#.*projects/\(.*\)#\1#p' | tr '/' '-')
  echo "== $dir ($api)"
  work=$(mktemp -d)
  cp -r "$dir"/. "$work"/
  case "$api" in
    opengl)
      glad=$(glad_dir)
      for s in "$work"/*.vs "$work"/*.vert; do [ -f "$s" ] && { glslangValidator -S vert "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S vert "$s" | tail -n +2)"; }; done
      for s in "$work"/*.fs "$work"/*.frag; do [ -f "$s" ] && { glslangValidator -S frag "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S frag "$s" | tail -n +2)"; }; done
      for s in "$work"/*.gs "$work"/*.geom; do [ -f "$s" ] && { glslangValidator -S geom "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S geom "$s" | tail -n +2)"; }; done
      # Model loading: learnopengl's model.h uses Assimp.
      libs=""; grep -rqs "assimp/" "$work" --include=*.cpp --include=*.h && libs="-lassimp"
      if g++ -std=c++17 -Wall -o "$work/app" "$work/main.cpp" "$glad/src/glad.c" -I"$glad/include" -I"$work" -I/usr/include/stb -lglfw -ldl $libs 2>"$work/build.log"; then
        echo "  compiled"
        if [ -z "${VERIFY_NO_RUN:-}" ]; then
          start_x; (cd "$work" && run_and_shoot ./app "$name" "$work/run.log")
          if grep -qi "error\|failed" "$work/run.log"; then fail "the program printed: $(cat "$work/run.log")"; fi
        fi
      else
        fail "compile error:"; head -30 "$work/build.log"
      fi
      grep -i "warning" "$work/build.log" | head -5
      ;;
    vulkan)
      mkdir -p "$work/shaders"
      for s in "$work"/shaders/*.vert "$work"/shaders/*.frag "$work"/shaders/*.geom; do
        [ -f "$s" ] || continue
        # shader.vert -> vert.spv (vulkan-tutorial's names); any other name -> name.vert.spv
        case "$(basename "$s")" in
          shader.vert|shader.frag) out="$work/shaders/$( [ "${s##*.}" = vert ] && echo vert || echo frag ).spv" ;;
          *) out="$s.spv" ;;
        esac
        glslangValidator -V "$s" -o "$out" >"$work/glslang.log" || { fail "$(basename "$s"):"; cat "$work/glslang.log"; }
      done
      if g++ -std=c++17 -Wall -I/usr/include/stb -o "$work/app" "$work/main.cpp" -lglfw -lvulkan 2>"$work/build.log"; then
        echo "  compiled"
        if [ -z "${VERIFY_NO_RUN:-}" ]; then
          start_x; (cd "$work" && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json run_and_shoot ./app "$name" "$work/run.log")
          # The debug messenger of vulkan-tutorial.com prints every message; errors and warnings carry a VUID or say so.
          if grep -q "validation layer:.*\(VUID\|Validation Error\|Validation Warning\|Validation Performance\)" "$work/run.log"; then
            fail "validation messages:"; grep "validation layer:.*\(VUID\|Validation Error\|Validation Warning\)" "$work/run.log" | cut -c1-300 | sort | uniq -c | head -10
          fi
          if grep -qi "failed\|exception\|what()" "$work/run.log"; then fail "the program printed: $(head -5 "$work/run.log")"; fi
        fi
      else
        fail "compile error:"; head -30 "$work/build.log"
      fi
      grep -i "warning" "$work/build.log" | head -5
      ;;
    d3d12)
      dxh=$(dx_headers)
      for s in "$work"/*.hlsl; do
        [ -f "$s" ] || continue
        # glslangValidator's HLSL front end needs SPIR-V output (-V) to compile at all.
        grep -q "VSMain" "$s" && { glslangValidator -V -D -e VSMain -S vert -o "$work/vs.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") VSMain:"; cat "$work/hlsl.log"; }; }
        grep -q "PSMain" "$s" && { glslangValidator -V -D -e PSMain -S frag -o "$work/ps.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") PSMain:"; cat "$work/hlsl.log"; }; }
        grep -qE "void[[:space:]]+GSMain[[:space:]]*\(" "$s" && { glslangValidator -V -D -e GSMain -S geom -o "$work/gs.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") GSMain:"; cat "$work/hlsl.log"; }; }
      done
      # For MinGW, d3d12.h/d3dx12 declare the methods that return a struct (GetCPUDescriptorHandleForHeapStart,
      # GetDesc ...) with an extra out-parameter (an ABI workaround). The course code is written for MSVC, like the
      # samples, so check it against the MSVC declarations: a patched copy of the headers (syntax-only check, so
      # the ABI does not matter).
      mkdir -p "$work/dxh"
      for h in "$dxh"/*.h "$dxh"/*.inl; do
        sed 's@#if defined(_MSC_VER) || !defined(_WIN32)@#if 1 // MSVC declarations (verify.sh)@' "$h" >"$work/dxh/$(basename "$h")"
      done
      # Model loading uses Assimp: its headers only (a copy, so MinGW does not see the rest of /usr/include).
      mkdir -p "$work/assimp-include"; cp -r /usr/include/assimp "$work/assimp-include/"
      if x86_64-w64-mingw32-g++ -std=c++17 -Wall -fsyntax-only -municode -I"$work/dxh" -I"$work" -I/usr/include/stb -I"$work/assimp-include" "$work/main.cpp" 2>"$work/build.log"; then
        echo "  compiled (syntax and types; DirectX 12 cannot run here)"
      else
        fail "compile error:"; grep -v "^In file included" "$work/build.log" | head -30
      fi
      grep -i "warning" "$work/build.log" | head -5
      ;;
    *) fail "unknown API in path: $dir" ;;
  esac
  rm -rf "$work"
done
[ -n "${XVFB_PID:-}" ] && kill "$XVFB_PID" 2>/dev/null
[ "$status" = 0 ] && echo "ALL OK" || echo "SOME CHECKS FAILED"
exit $status
