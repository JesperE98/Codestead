namespace Codestead.GP.Gpu.Shading;

// The matrix libraries the course's C++ code uses: GLM (OpenGL and Vulkan: column vectors, right-handed, as
// learnopengl.com and vulkan-tutorial.com use it) and DirectXMath (DirectX 12: row vectors, left-handed).
// Matrices are stored column by column (V[col * n + row]); a DirectXMath XMMATRIX is stored as the matrix it is in
// DirectXMath's own (row-vector) convention, so XMMatrixTranspose and products work as written.
public sealed partial class ShaderRunner
{
    /// <summary>GLM_FORCE_DEPTH_ZERO_TO_ONE: glm::perspective maps depth to 0..1 (Vulkan) instead of -1..1.</summary>
    public bool DepthZeroToOne { get; set; }

    private static ShaderValue M(int n, Func<int, int, double> at)
    {
        var v = new double[n * n];
        for (int c = 0; c < n; c++)
            for (int r = 0; r < n; r++) v[c * n + r] = at(r, c);
        return ShaderValue.Matrix(n, v);
    }

    /// <summary>A 4×4 matrix from its rows (as DirectXMath and the docs write them).</summary>
    private static ShaderValue Rows(double[][] rows) => M(4, (r, c) => rows[r][c]);

    private static double[] V3(ShaderValue v) => v.Padded(3);

    private static double[] Normalize3(double[] v)
    {
        double l = Math.Sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return l == 0 ? v : [v[0] / l, v[1] / l, v[2] / l];
    }

    private static double[] Cross(double[] a, double[] b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

    private static double Dot3(double[] a, double[] b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    /// <summary>A rotation about a normalised axis (right-handed, counter-clockwise looking down the axis) as a column-vector matrix.</summary>
    private static ShaderValue AxisAngle(double angle, double[] axis)
    {
        var a = Normalize3(axis);
        double c = Math.Cos(angle), s = Math.Sin(angle), t = 1 - c;
        double x = a[0], y = a[1], z = a[2];
        double[][] rows =
        [
            [t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0],
            [t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0],
            [t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0],
            [0, 0, 0, 1],
        ];
        return Rows(rows);
    }

    private static ShaderValue Transpose(ShaderValue m) => M(m.Cols, (r, c) => m.V![r * m.Cols + c]);

    /// <summary>The GLM and DirectXMath functions; null when the name is neither.</summary>
    private ShaderValue? MatrixFunction(string name, List<ShaderValue> a, int line)
    {
        ShaderRuntimeException Arity() => new($"wrong arguments to '{name}'", line);
        double S(int i) => i < a.Count ? a[i].X : throw Arity();
        switch (name)
        {
            // ---------- GLM ----------
            case "value_ptr":
                return a.Count == 1 ? a[0] : throw Arity();
            case "translate" when a.Count == 2 && a[0].IsMatrix:
            {
                var v = V3(a[1]);
                return MatrixMultiply(a[0], Rows([[1, 0, 0, v[0]], [0, 1, 0, v[1]], [0, 0, 1, v[2]], [0, 0, 0, 1]]), line);
            }
            case "rotate" when a.Count == 3 && a[0].IsMatrix:
                return MatrixMultiply(a[0], AxisAngle(a[1].X, V3(a[2])), line);
            case "scale" when a.Count == 2 && a[0].IsMatrix:
            {
                var v = V3(a[1]);
                return MatrixMultiply(a[0], Rows([[v[0], 0, 0, 0], [0, v[1], 0, 0], [0, 0, v[2], 0], [0, 0, 0, 1]]), line);
            }
            case "perspective" when a.Count == 4:
            {
                double f = 1 / Math.Tan(S(0) / 2), aspect = S(1), n = S(2), fa = S(3);
                return DepthZeroToOne
                    ? Rows([[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, fa / (n - fa), -(fa * n) / (fa - n)], [0, 0, -1, 0]])
                    : Rows([[f / aspect, 0, 0, 0], [0, f, 0, 0], [0, 0, -(fa + n) / (fa - n), -(2 * fa * n) / (fa - n)], [0, 0, -1, 0]]);
            }
            case "ortho" when a.Count is 4 or 6:
            {
                double l = S(0), r = S(1), b = S(2), t = S(3), n = a.Count == 6 ? S(4) : -1, f = a.Count == 6 ? S(5) : 1;
                return DepthZeroToOne
                    ? Rows([[2 / (r - l), 0, 0, -(r + l) / (r - l)], [0, 2 / (t - b), 0, -(t + b) / (t - b)], [0, 0, -1 / (f - n), -n / (f - n)], [0, 0, 0, 1]])
                    : Rows([[2 / (r - l), 0, 0, -(r + l) / (r - l)], [0, 2 / (t - b), 0, -(t + b) / (t - b)], [0, 0, -2 / (f - n), -(f + n) / (f - n)], [0, 0, 0, 1]]);
            }
            case "lookAt" when a.Count == 3:
            {
                var eye = V3(a[0]);
                var f = Normalize3([a[1].Padded(3)[0] - eye[0], a[1].Padded(3)[1] - eye[1], a[1].Padded(3)[2] - eye[2]]);
                var s = Normalize3(Cross(f, V3(a[2])));
                var u = Cross(s, f);
                return Rows([[s[0], s[1], s[2], -Dot3(s, eye)], [u[0], u[1], u[2], -Dot3(u, eye)], [-f[0], -f[1], -f[2], Dot3(f, eye)], [0, 0, 0, 1]]);
            }
            case "inverse" when a.Count == 1 && a[0].IsMatrix:
                return Inverse(a[0], line);

            // ---------- DirectXMath (row vectors: v' = v * M) ----------
            case "XMMatrixIdentity":
                return ShaderValue.Identity(4);
            case "XMMatrixTranslation":
                return Rows([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [S(0), S(1), S(2), 1]]);
            case "XMMatrixScaling":
                return Rows([[S(0), 0, 0, 0], [0, S(1), 0, 0], [0, 0, S(2), 0], [0, 0, 0, 1]]);
            case "XMMatrixRotationX":
            {
                double c = Math.Cos(S(0)), s = Math.Sin(S(0));
                return Rows([[1, 0, 0, 0], [0, c, s, 0], [0, -s, c, 0], [0, 0, 0, 1]]);
            }
            case "XMMatrixRotationY":
            {
                double c = Math.Cos(S(0)), s = Math.Sin(S(0));
                return Rows([[c, 0, -s, 0], [0, 1, 0, 0], [s, 0, c, 0], [0, 0, 0, 1]]);
            }
            case "XMMatrixRotationZ":
            {
                double c = Math.Cos(S(0)), s = Math.Sin(S(0));
                return Rows([[c, s, 0, 0], [-s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
            }
            case "XMMatrixRotationAxis" or "XMMatrixRotationNormal" when a.Count == 2:
                // DirectXMath's rotation is the transpose of the column-vector one (row vectors).
                return Transpose(AxisAngle(S(1), V3(a[0])));
            case "XMMatrixPerspectiveFovLH" when a.Count == 4:
            {
                double h = 1 / Math.Tan(S(0) / 2), w = h / S(1), range = S(3) / (S(3) - S(2));
                return Rows([[w, 0, 0, 0], [0, h, 0, 0], [0, 0, range, 1], [0, 0, -range * S(2), 0]]);
            }
            case "XMMatrixPerspectiveFovRH" when a.Count == 4:
            {
                double h = 1 / Math.Tan(S(0) / 2), w = h / S(1), range = S(3) / (S(2) - S(3));
                return Rows([[w, 0, 0, 0], [0, h, 0, 0], [0, 0, range, -1], [0, 0, range * S(2), 0]]);
            }
            case "XMMatrixOrthographicRH" when a.Count == 4:
            {
                double range = 1 / (S(2) - S(3));
                return Rows([[2 / S(0), 0, 0, 0], [0, 2 / S(1), 0, 0], [0, 0, range, 0], [0, 0, range * S(2), 1]]);
            }
            case "XMMatrixOrthographicOffCenterRH" or "XMMatrixOrthographicOffCenterLH" when a.Count == 6:
            {
                // (left, right, bottom, top, near, far), as DirectXMath builds it for row vectors.
                double rw = 1 / (S(1) - S(0)), rh = 1 / (S(3) - S(2));
                bool rhs = name.EndsWith("RH", StringComparison.Ordinal);
                double range = rhs ? 1 / (S(4) - S(5)) : 1 / (S(5) - S(4));
                return Rows([[2 * rw, 0, 0, 0], [0, 2 * rh, 0, 0], [0, 0, range, 0], [-(S(0) + S(1)) * rw, -(S(3) + S(2)) * rh, (rhs ? range : -range) * S(4), 1]]);
            }
            case "XMMatrixLookAtRH" when a.Count == 3:
            {
                // LookAtRH(eye, focus, up) = LookToLH(eye, eye - focus, up).
                var eye = V3(a[0]);
                var r2 = Normalize3([eye[0] - a[1].Padded(3)[0], eye[1] - a[1].Padded(3)[1], eye[2] - a[1].Padded(3)[2]]);
                var r0 = Normalize3(Cross(V3(a[2]), r2));
                var r1 = Cross(r2, r0);
                return Rows([[r0[0], r1[0], r2[0], 0], [r0[1], r1[1], r2[1], 0], [r0[2], r1[2], r2[2], 0], [-Dot3(r0, eye), -Dot3(r1, eye), -Dot3(r2, eye), 1]]);
            }
            case "XMMatrixOrthographicLH" when a.Count == 4:
            {
                double range = 1 / (S(3) - S(2));
                return Rows([[2 / S(0), 0, 0, 0], [0, 2 / S(1), 0, 0], [0, 0, range, 0], [0, 0, -range * S(2), 1]]);
            }
            case "XMMatrixLookAtLH" when a.Count == 3:
            {
                var eye = V3(a[0]);
                var r2 = Normalize3([a[1].Padded(3)[0] - eye[0], a[1].Padded(3)[1] - eye[1], a[1].Padded(3)[2] - eye[2]]);
                var r0 = Normalize3(Cross(V3(a[2]), r2));
                var r1 = Cross(r2, r0);
                return Rows([[r0[0], r1[0], r2[0], 0], [r0[1], r1[1], r2[1], 0], [r0[2], r1[2], r2[2], 0], [-Dot3(r0, eye), -Dot3(r1, eye), -Dot3(r2, eye), 1]]);
            }
            case "XMVector3TransformCoord" or "XMVector3TransformNormal" or "XMVector4Transform" when a.Count == 2 && a[1].IsMatrix:
            {
                // DirectXMath's row vector times the matrix: (x, y, z, 1) for a point (divided by w), w = 0 for a normal.
                var m = a[1];
                var v = a[0].Padded(4);
                double w = name switch { "XMVector3TransformCoord" => 1, "XMVector3TransformNormal" => 0, _ => v[3] };
                double[] row = [v[0], v[1], v[2], w];
                var r = new double[4];
                for (int c = 0; c < 4; c++)
                    for (int k = 0; k < 4; k++) r[c] += row[k] * m.V![c * 4 + k];
                if (name == "XMVector3TransformCoord" && r[3] != 0) return ShaderValue.Vec(r[0] / r[3], r[1] / r[3], r[2] / r[3], 1);
                return ShaderValue.Vec(r);
            }
            case "XMMatrixMultiply" when a.Count == 2:
                return MatrixMultiply(a[0], a[1], line);
            case "XMMatrixTranspose" when a.Count == 1:
                return Transpose(a[0]);
            case "XMMatrixInverse" when a.Count == 2:
                return Inverse(a[1], line);
            case "XMVectorAdd" when a.Count == 2:
                return ShaderValue.Vec(a[0].Padded(4).Zip(a[1].Padded(4), (x, y) => x + y).ToArray());
            case "XMVectorSubtract" when a.Count == 2:
                return ShaderValue.Vec(a[0].Padded(4).Zip(a[1].Padded(4), (x, y) => x - y).ToArray());
            case "XMVectorScale" when a.Count == 2:
                return ShaderValue.Vec(a[0].Padded(4).Select(x => x * S(1)).ToArray());
            case "XMVector3Cross" when a.Count == 2:
            {
                var c = Cross(V3(a[0]), V3(a[1]));
                return ShaderValue.Vec(c[0], c[1], c[2], 0);
            }
            case "XMVectorSet" when a.Count == 4:
                return ShaderValue.Vec(S(0), S(1), S(2), S(3));
            case "XMLoadFloat3" when a.Count == 1 && !a[0].IsMatrix:
                // An XMVECTOR has four components: w = 0 for a loaded XMFLOAT3.
                return ShaderValue.Vec(a[0].Padded(3)[0], a[0].Padded(3)[1], a[0].Padded(3)[2], 0);
            case "XMLoadFloat3" or "XMLoadFloat4" or "XMLoadFloat4x4" or "XMLoadFloat3x3" when a.Count == 1:
                return a[0];
            case "XMVectorGetX" or "XMVectorGetY" or "XMVectorGetZ" or "XMVectorGetW" when a.Count == 1:
                return ShaderValue.Scalar(a[0].Padded(4)["XYZW".IndexOf(name[^1])]);
            case "XMVector3Length" when a.Count == 1:
            {
                var v = V3(a[0]);
                double len = Math.Sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
                return ShaderValue.Vec(len, len, len, len);
            }
            case "XMVector3Dot" when a.Count == 2:
            {
                var p = V3(a[0]);
                var q = V3(a[1]);
                double dot = p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
                return ShaderValue.Vec(dot, dot, dot, dot);
            }
            case "XMVectorNegate" when a.Count == 1:
                return ShaderValue.Vec(a[0].Padded(4).Select(x => -x).ToArray());
            case "XMVector3Normalize" when a.Count == 1:
            {
                var n = Normalize3(V3(a[0]));
                return ShaderValue.Vec(n[0], n[1], n[2], 0);
            }
            default:
                return null;
        }
    }

    private static ShaderValue Inverse(ShaderValue m, int line)
    {
        int n = m.Cols;
        var a = new double[n, 2 * n];
        for (int r = 0; r < n; r++)
        {
            for (int c = 0; c < n; c++) a[r, c] = m.V![c * n + r];
            a[r, n + r] = 1;
        }
        for (int col = 0; col < n; col++)
        {
            int pivot = col;
            for (int r = col + 1; r < n; r++)
                if (Math.Abs(a[r, col]) > Math.Abs(a[pivot, col])) pivot = r;
            if (Math.Abs(a[pivot, col]) < 1e-12) throw new ShaderRuntimeException("the matrix cannot be inverted", line);
            for (int c = 0; c < 2 * n; c++) (a[col, c], a[pivot, c]) = (a[pivot, c], a[col, c]);
            double p = a[col, col];
            for (int c = 0; c < 2 * n; c++) a[col, c] /= p;
            for (int r = 0; r < n; r++)
            {
                if (r == col) continue;
                double f = a[r, col];
                for (int c = 0; c < 2 * n; c++) a[r, c] -= f * a[col, c];
            }
        }
        return M(n, (r, c) => a[r, n + c]);
    }
}
