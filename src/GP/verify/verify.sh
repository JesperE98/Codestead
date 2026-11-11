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
#   libtinyobjloader-dev libfreetype-dev, and `pip install glad` (GLAD 1).
# Game chapters (a key callback) run with fixedtime.c preloaded: deterministic time (frames / 60) and the space bar
# pressed at 0.5 s; the program holds frame VERIFY_T * 60 (VERIFY_T in seconds, default 1) and the screenshot shows
# that frame. VERIFY_FIXEDTIME=1 turns it on for any project.
# Screenshots go to $VERIFY_OUT (default /tmp/codestead-gp-verify) as <api>-<chapter>-<folder>.png.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${VERIFY_OUT:-/tmp/codestead-gp-verify}"
CACHE="${VERIFY_CACHE:-$HOME/.cache/codestead-gp-verify}"
mkdir -p "$OUT" "$CACHE"
status=0

# GLAD for OpenGL 3.3 core (the course's version), or for 4.x core when a project asks GLFW for a 4.x context
# (the debugging chapter: glDebugMessageCallback is core in 4.3; the guest articles: 4.1, 4.2, 4.5).
glad_dir() {
  local ver="${1:-3.3}" dir="$CACHE/glad"
  [ "$ver" != 3.3 ] && dir="$CACHE/glad$(echo "$ver" | tr -d .)"
  if [ ! -f "$dir/src/glad.c" ]; then
    glad --profile core --api gl=$ver --generator c --out-path "$dir" >/dev/null
  fi
  echo "$dir"
}

# The LD_PRELOAD shim with deterministic time and input (fixedtime.c), for projects that read keys through a key
# callback (the 2D game) or when VERIFY_FIXEDTIME is set: glfwGetTime() = frames / 60, frame VERIFY_T * 60 held.
fixedtime_for() {
  local work="$1"
  if grep -qs "glfwSetKeyCallback" "$work/main.cpp" || [ -n "${VERIFY_FIXEDTIME:-}" ]; then
    local so="$CACHE/fixedtime.so" src="$HERE/fixedtime.c"
    if [ ! -f "$so" ] || [ "$src" -nt "$so" ]; then
      # Built to a temporary name and moved, so checks running at the same time never see a half-written file.
      gcc -shared -fPIC -O2 -o "$so.$$" "$src" -ldl && mv -f "$so.$$" "$so" || { echo "  FAIL: fixedtime.c does not build" >&2; return; }
    fi
    echo "$so"
  fi
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
  local exe="$1" name="$2" log="$3" preload="${4:-}"
  start_x
  local ready=""
  # With the fixed-time shim the program holds frame VERIFY_T * 60 and then says so (fixedtime.c): wait for that,
  # however slow the driver is (at most VERIFY_MAXWAIT seconds), instead of a fixed time.
  [ -n "$preload" ] && { ready="$(mktemp -u)"; }
  ( VERIFY_READY="$ready" LD_PRELOAD="$preload" "$exe" >"$log" 2>&1 ) &
  local pid=$!
  if [ -n "$ready" ]; then
    local waited=0
    while [ ! -e "$ready" ] && kill -0 "$pid" 2>/dev/null && [ "$waited" -lt $(( ${VERIFY_MAXWAIT:-120} * 5 )) ]; do
      sleep 0.2; waited=$(( waited + 1 ))
    done
    [ -e "$ready" ] || echo "    (frame $(awk "BEGIN { print int(${VERIFY_T:-1.0} * 60 + 0.5) }") not reached before the screenshot)"
    sleep 0.5; rm -f "$ready"
  else
    sleep "${VERIFY_WAIT:-3}"
  fi
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
      # A 4.x context (the debugging chapter 4.3, the guest articles 4.1 / 4.2 / 4.5): GLAD for that version.
      glver=3.3
      if grep -qsE "GLFW_CONTEXT_VERSION_MAJOR, *4" "$work/main.cpp"; then
        glver=4.$(grep -oE "GLFW_CONTEXT_VERSION_MINOR, *[0-9]" "$work/main.cpp" | head -1 | grep -oE "[0-9]$")
      fi
      glad=$(glad_dir $glver)
      for s in "$work"/*.vs "$work"/*.vert; do [ -f "$s" ] && { glslangValidator -S vert "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S vert "$s" | tail -n +2)"; }; done
      for s in "$work"/*.fs "$work"/*.frag; do [ -f "$s" ] && { glslangValidator -S frag "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S frag "$s" | tail -n +2)"; }; done
      for s in "$work"/*.gs "$work"/*.geom; do [ -f "$s" ] && { glslangValidator -S geom "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S geom "$s" | tail -n +2)"; }; done
      # The guest articles' tessellation (learnopengl's .tcs / .tes) and compute (.comp) stages.
      for s in "$work"/*.tcs "$work"/*.tesc; do [ -f "$s" ] && { glslangValidator -S tesc "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S tesc "$s" | tail -n +2)"; }; done
      for s in "$work"/*.tes "$work"/*.tese; do [ -f "$s" ] && { glslangValidator -S tese "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S tese "$s" | tail -n +2)"; }; done
      for s in "$work"/*.comp; do [ -f "$s" ] && { glslangValidator -S comp "$s" >/dev/null || fail "$(basename "$s"): $(glslangValidator -S comp "$s" | tail -n +2)"; }; done
      # Model loading: learnopengl's model.h uses Assimp.
      libs=""; grep -rqs "assimp/" "$work" --include=*.cpp --include=*.h && libs="-lassimp"
      # Text rendering: FreeType.
      grep -qs "ft2build.h" "$work/main.cpp" && libs="$libs $(pkg-config --cflags --libs freetype2)"
      shim=$(fixedtime_for "$work"); [ -n "$shim" ] && echo "  fixed time (frames / 60, space pressed at 0.5 s; shows frame $(awk "BEGIN { print int(${VERIFY_T:-1.0} * 60 + 0.5) }") = ${VERIFY_T:-1.0} s)"
      if g++ -std=c++17 -Wall -o "$work/app" "$work/main.cpp" "$glad/src/glad.c" -I"$glad/include" -I"$work" -I/usr/include/stb -lglfw -ldl $libs 2>"$work/build.log"; then
        echo "  compiled"
        if [ -z "${VERIFY_NO_RUN:-}" ]; then
          start_x; (cd "$work" && run_and_shoot ./app "$name" "$work/run.log" "$shim")
          if grep -qi "error\|failed" "$work/run.log"; then fail "the program printed: $(cat "$work/run.log")"; fi
        fi
      else
        fail "compile error:"; head -30 "$work/build.log"
      fi
      grep -i "warning" "$work/build.log" | head -5
      ;;
    vulkan)
      mkdir -p "$work/shaders"
      # Also the tessellation (.tesc/.tese) and compute (.comp) stages of the guest articles.
      for s in "$work"/shaders/*.vert "$work"/shaders/*.frag "$work"/shaders/*.geom "$work"/shaders/*.tesc "$work"/shaders/*.tese "$work"/shaders/*.comp; do
        [ -f "$s" ] || continue
        # shader.vert -> vert.spv (vulkan-tutorial's names); any other name -> name.vert.spv
        case "$(basename "$s")" in
          shader.vert|shader.frag) out="$work/shaders/$( [ "${s##*.}" = vert ] && echo vert || echo frag ).spv" ;;
          *) out="$s.spv" ;;
        esac
        glslangValidator -V "$s" -o "$out" >"$work/glslang.log" || { fail "$(basename "$s"):"; cat "$work/glslang.log"; }
      done
      libs=""; grep -qs "ft2build.h" "$work/main.cpp" && libs="$(pkg-config --cflags --libs freetype2)"
      # Skeletal animation reads the animated model with Assimp.
      grep -qs "assimp/" "$work/main.cpp" && libs="$libs -lassimp"
      shim=$(fixedtime_for "$work"); [ -n "$shim" ] && echo "  fixed time (frames / 60, space pressed at 0.5 s; shows frame $(awk "BEGIN { print int(${VERIFY_T:-1.0} * 60 + 0.5) }") = ${VERIFY_T:-1.0} s)"
      if g++ -std=c++17 -Wall -I/usr/include/stb -o "$work/app" "$work/main.cpp" -lglfw -lvulkan $libs 2>"$work/build.log"; then
        echo "  compiled"
        if [ -z "${VERIFY_NO_RUN:-}" ]; then
          start_x; (cd "$work" && VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json run_and_shoot ./app "$name" "$work/run.log" "$shim")
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
        # The guest articles' hull / domain (tessellation) and compute shaders.
        grep -qE "[[:space:]]HSMain[[:space:]]*\(" "$s" && { glslangValidator -V -D -e HSMain -S tesc -o "$work/hs.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") HSMain:"; cat "$work/hlsl.log"; }; }
        grep -qE "[[:space:]]DSMain[[:space:]]*\(" "$s" && { glslangValidator -V -D -e DSMain -S tese -o "$work/ds.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") DSMain:"; cat "$work/hlsl.log"; }; }
        grep -qE "void[[:space:]]+CSMain[[:space:]]*\(" "$s" && { glslangValidator -V -D -e CSMain -S comp -o "$work/cs.spv" "$s" >"$work/hlsl.log" || { fail "$(basename "$s") CSMain:"; cat "$work/hlsl.log"; }; }
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
      # Text rendering uses FreeType: its headers only, the same way.
      mkdir -p "$work/freetype-include"; cp -r /usr/include/freetype2/. "$work/freetype-include/"
      if x86_64-w64-mingw32-g++ -std=c++17 -Wall -fsyntax-only -municode -I"$work/dxh" -I"$work" -I/usr/include/stb -I"$work/assimp-include" -I"$work/freetype-include" "$work/main.cpp" 2>"$work/build.log"; then
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
