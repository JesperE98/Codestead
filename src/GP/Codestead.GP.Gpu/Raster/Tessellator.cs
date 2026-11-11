namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// The fixed-function tessellator between the control (hull) and the evaluation (domain) shader: it cuts a patch's
/// domain into triangles by the tessellation levels and gives the (u, v) of each new vertex. Where the points go
/// along an edge follows Direct3D 11's reference tessellator, which Mesa (llvmpipe, lavapipe) and the Direct3D
/// drivers use: levels in 16.16 fixed point, fractional odd / even spacing with the two shorter segments placed
/// symmetrically. The inside of a quad is the grid of the inside levels' points; its outer ring is joined to the
/// edges' points (that joining is the simulator's own, close to but not exactly the drivers' pattern).
/// </summary>
internal static class Tessellator
{
    private const int FracBits = 16;
    private const long One = 1L << FracBits;
    private const long Half = One / 2;

    /// <summary>The domain points (u, v) and the triangles (indices into them, counter-clockwise unless cw).</summary>
    public sealed record Mesh(List<(double U, double V)> Points, List<int[]> Triangles);

    /// <summary>How the points of an edge with one level are placed (D3D's TESS_FACTOR_CONTEXT).</summary>
    private sealed class Edge
    {
        public bool Odd;
        public long HalfFraction;
        public int NumHalfPoints;
        public int SplitPoint;
        public long InvFloorSegments, InvCeilSegments;

        /// <summary>The number of points along the edge, both ends included.</summary>
        public int Points => Odd ? NumHalfPoints * 2 : NumHalfPoints * 2 + 1;

        public static Edge Of(double level, bool odd)
        {
            var e = new Edge { Odd = odd };
            long fxp = (long)(level * One);
            long half = (fxp + 1) / 2;
            if (odd || half == Half) half += Half;
            long floor = half & ~(One - 1);
            long ceil = (half + One - 1) & ~(One - 1);
            e.HalfFraction = half - floor;
            e.NumHalfPoints = (int)(ceil >> FracBits);
            if (ceil == floor) e.SplitPoint = e.NumHalfPoints + 1;
            else if (odd) e.SplitPoint = floor == One ? 0 : (RemoveMsb((int)(floor >> FracBits) - 1) << 1) + 1;
            else e.SplitPoint = (RemoveMsb((int)(floor >> FracBits)) << 1) + 1;
            int floorSegments = (int)((floor * 2) >> FracBits), ceilSegments = (int)((ceil * 2) >> FracBits);
            if (odd)
            {
                floorSegments -= 1;
                ceilSegments -= 1;
            }
            e.InvFloorSegments = floorSegments <= 0 ? 0 : (One + floorSegments / 2) / floorSegments;
            e.InvCeilSegments = ceilSegments <= 0 ? 0 : (One + ceilSegments / 2) / ceilSegments;
            return e;
        }

        private static int RemoveMsb(int x)
        {
            if (x <= 0) return 0;
            int msb = 1 << (31 - System.Numerics.BitOperations.LeadingZeroCount((uint)x));
            return x & ~msb;
        }

        /// <summary>Where point <paramref name="point"/> (0 … Points - 1) lies on the edge, 0 … 1.</summary>
        public double Place(int point)
        {
            bool flip = false;
            if (point >= NumHalfPoints)
            {
                point = (NumHalfPoints << 1) - point;
                if (Odd) point -= 1;
                flip = true;
            }
            if (point == NumHalfPoints) return 0.5;
            int onCeil = point, onFloor = point;
            if (point > SplitPoint) onFloor -= 1;
            long locFloor = onFloor * InvFloorSegments, locCeil = onCeil * InvCeilSegments;
            long loc = (locFloor * (One - HalfFraction) + locCeil * HalfFraction + Half) >> FracBits;
            if (flip) loc = One - loc;
            return Math.Clamp(loc / (double)One, 0, 1);
        }

        public double[] All() => Enumerable.Range(0, Points).Select(Place).ToArray();
    }

    /// <summary>
    /// The levels as the tessellator uses them for a spacing: clamped to its range (fractional odd 1 … 63, fractional
    /// even 2 … 64, equal 1 … 64, rounded up to a whole number), and whether points are placed with odd parity.
    /// </summary>
    private static (double Level, bool Odd) Level(double level, string spacing, double lower = double.NaN)
    {
        if (double.IsNaN(level)) level = 1;
        switch (spacing)
        {
            case "fractional_odd":
                level = Math.Clamp(level, double.IsNaN(lower) ? 1 : lower, 63);
                return (level, true);
            case "fractional_even":
                level = Math.Clamp(level, 2, 64);
                return (level, false);
            default:
                level = Math.Ceiling(Math.Clamp(level, 1, 64) - 1e-9);
                return (level, ((int)level & 1) == 1);
        }
    }

    /// <summary>"fractional_odd_spacing" / HLSL "fractional_odd" → "fractional_odd"; equal spacing / "integer" / "pow2" → "equal".</summary>
    public static string Spacing(string? spacing) => spacing switch
    {
        not null when spacing.Contains("odd", StringComparison.OrdinalIgnoreCase) => "fractional_odd",
        not null when spacing.Contains("even", StringComparison.OrdinalIgnoreCase) => "fractional_even",
        _ => "equal",
    };

    /// <summary>
    /// A quad patch: outer levels for the edges u = 0, v = 0, u = 1, v = 1 (GLSL gl_TessLevelOuter[0 … 3], HLSL
    /// SV_TessFactor[0 … 3]), inner levels along u and along v. Null: the patch is culled (an outer level ≤ 0).
    /// </summary>
    public static Mesh? Quad(double[] outer, double[] inner, string spacing, bool cw)
    {
        if (outer.Length < 4 || outer.Take(4).Any(o => !(o > 0))) return null;
        var o = outer.Take(4).Select(x => Level(x, spacing)).ToArray();
        double innerU = inner.Length > 0 ? inner[0] : 1, innerV = inner.Length > 1 ? inner[1] : innerU;
        // Fractional odd: when any level ends up above 1, the inside levels are at least a little above 1, so there is
        // a ring of inside points to join the edges to (D3D's "picture frame").
        double lower = double.NaN;
        const double epsilon = 1.0 / (1 << 16);
        if (spacing == "fractional_odd" && (o.Any(x => x.Level > 1 + epsilon / 2) || innerU > 1 + epsilon / 2 || innerV > 1 + epsilon / 2)) lower = 1 + epsilon;
        var iu = Level(innerU, spacing, lower);
        var iv = Level(innerV, spacing, lower);
        var points = new List<(double U, double V)>();
        var triangles = new List<int[]>();
        int Add(double u, double v)
        {
            points.Add((u, v));
            return points.Count - 1;
        }
        void Tri(int a, int b, int c)
        {
            // Counter-clockwise in (u, v) (u to the right, v up), or clockwise for cw.
            var (pa, pb, pc) = (points[a], points[b], points[c]);
            double area = (pb.U - pa.U) * (pc.V - pa.V) - (pc.U - pa.U) * (pb.V - pa.V);
            if (Math.Abs(area) < 1e-14) return;
            if ((area > 0) == cw) (b, c) = (c, b);
            triangles.Add([a, b, c]);
        }
        // Every level 1: the quad as two triangles.
        if (o.All(x => x.Level <= 1) && iu.Level <= 1 && iv.Level <= 1)
        {
            int c00 = Add(0, 0), c10 = Add(1, 0), c11 = Add(1, 1), c01 = Add(0, 1);
            Tri(c00, c10, c01);
            Tri(c10, c11, c01);
            return new Mesh(points, triangles);
        }
        var pu = Edge.Of(iu.Level, iu.Odd).All();
        var pv = Edge.Of(iv.Level, iv.Odd).All();
        int nu = pu.Length, nv = pv.Length;
        // The inside: the grid of the inside levels' points without its outer ring.
        var grid = new int[nu, nv];
        for (int i = 1; i < nu - 1; i++)
            for (int j = 1; j < nv - 1; j++) grid[i, j] = Add(pu[i], pv[j]);
        double midU = (nu - 1) / 2.0, midV = (nv - 1) / 2.0;
        for (int i = 1; i < nu - 2; i++)
            for (int j = 1; j < nv - 2; j++)
            {
                int a = grid[i, j], b = grid[i + 1, j], c = grid[i + 1, j + 1], d = grid[i, j + 1];
                // The diagonals mirror at the middle, so the pattern is the same in each quarter.
                bool lowU = i + 0.5 < midU, lowV = j + 0.5 < midV;
                if (lowU == lowV)
                {
                    Tri(a, b, c);
                    Tri(a, c, d);
                }
                else
                {
                    Tri(a, b, d);
                    Tri(b, c, d);
                }
            }
        // The edges' points (corners shared), and the inside ring's side next to each edge.
        int corner00 = Add(0, 0), corner10 = Add(1, 0), corner11 = Add(1, 1), corner01 = Add(0, 1);
        List<int> EdgePoints(int edge, int from, int to)
        {
            var e = Edge.Of(o[edge].Level, o[edge].Odd);
            var list = new List<int> { from };
            for (int k = 1; k < e.Points - 1; k++)
            {
                double t = e.Place(k);
                list.Add(edge switch
                {
                    0 => Add(0, t),
                    1 => Add(t, 0),
                    2 => Add(1, t),
                    _ => Add(t, 1),
                });
            }
            list.Add(to);
            return list;
        }
        // Each side runs in increasing u or v; the ring side likewise.
        var bottom = EdgePoints(1, corner00, corner10);
        var right = EdgePoints(2, corner10, corner11);
        var top = EdgePoints(3, corner01, corner11);
        var left = EdgePoints(0, corner00, corner01);
        bool hasRing = nu > 2 && nv > 2;
        if (!hasRing)
        {
            // No inside points (an inside level of 1 with even spacing): a fan from the centre.
            int centre = Add(0.5, 0.5);
            foreach (var side in new[] { bottom, right, top, left })
                for (int k = 0; k + 1 < side.Count; k++) Tri(centre, side[k], side[k + 1]);
            return new Mesh(points, triangles);
        }
        var ringBottom = Enumerable.Range(1, nu - 2).Select(i => grid[i, 1]).ToList();
        var ringTop = Enumerable.Range(1, nu - 2).Select(i => grid[i, nv - 2]).ToList();
        var ringLeft = Enumerable.Range(1, nv - 2).Select(j => grid[1, j]).ToList();
        var ringRight = Enumerable.Range(1, nv - 2).Select(j => grid[nu - 2, j]).ToList();
        Stitch(bottom, ringBottom, p => points[p].U);
        Stitch(top, ringTop, p => points[p].U);
        Stitch(left, ringLeft, p => points[p].V);
        Stitch(right, ringRight, p => points[p].V);
        return new Mesh(points, triangles);

        // Joins an edge's points to the ring side beside it: walking both in order, the one whose next point comes
        // first along the side advances (each step one triangle).
        void Stitch(List<int> outerSide, List<int> ringSide, Func<int, double> along)
        {
            int a = 0, b = 0;
            while (a < outerSide.Count - 1 || b < ringSide.Count - 1)
            {
                // Ties (the middle of a symmetric pattern) go to the edge in the first half and to the ring in the
                // second, so the two halves mirror each other.
                double outerMid = a < outerSide.Count - 1 ? (along(outerSide[a]) + along(outerSide[a + 1])) / 2 : double.MaxValue;
                double ringMid = b < ringSide.Count - 1 ? (along(ringSide[b]) + along(ringSide[b + 1])) / 2 : double.MaxValue;
                bool advanceOuter = Math.Abs(outerMid - ringMid) < 1e-12 ? outerMid < 0.5 : outerMid < ringMid;
                if (advanceOuter)
                {
                    Tri(outerSide[a], outerSide[a + 1], ringSide[b]);
                    a++;
                }
                else
                {
                    Tri(outerSide[a], ringSide[b + 1], ringSide[b]);
                    b++;
                }
            }
        }
    }

    /// <summary>
    /// A triangle patch: outer levels for the edges u = 0, v = 0, w = 0, one inner level. Rings of points from the
    /// edges inwards, each ring's sides joined to the next ring's (the simulator's own joining).
    /// </summary>
    public static Mesh? Triangle(double[] outer, double[] inner, string spacing, bool cw)
    {
        if (outer.Length < 3 || outer.Take(3).Any(o => !(o > 0))) return null;
        var o = outer.Take(3).Select(x => Level(x, spacing)).ToArray();
        var ii = Level(inner.Length > 0 ? inner[0] : 1, spacing, spacing == "fractional_odd" && o.Any(x => x.Level > 1) ? 1 + 1.0 / (1 << 16) : double.NaN);
        var points = new List<(double U, double V)>();
        var triangles = new List<int[]>();
        int Add(double u, double v)
        {
            points.Add((u, v));
            return points.Count - 1;
        }
        void Tri(int a, int b, int c)
        {
            var (pa, pb, pc) = (points[a], points[b], points[c]);
            double area = (pb.U - pa.U) * (pc.V - pa.V) - (pc.U - pa.U) * (pb.V - pa.V);
            if (Math.Abs(area) < 1e-14) return;
            if ((area > 0) == cw) (b, c) = (c, b);
            triangles.Add([a, b, c]);
        }
        // Barycentric (u, v, w = 1 - u - v); corners u = 1, v = 1, w = 1.
        var cu = Add(1, 0);
        var cv = Add(0, 1);
        var cw0 = Add(0, 0);
        if (o.All(x => x.Level <= 1) && ii.Level <= 1)
        {
            Tri(cu, cv, cw0);
            return new Mesh(points, triangles);
        }
        // Edge u = 0 runs from w (0,0) to v (0,1); v = 0 from u (1,0) to w; w = 0 from v to u.
        List<int> Side(int edge, int from, int to, Func<double, (double, double)> at)
        {
            var e = Edge.Of(o[edge].Level, o[edge].Odd);
            var list = new List<int> { from };
            for (int k = 1; k < e.Points - 1; k++)
            {
                var (u, v) = at(e.Place(k));
                list.Add(Add(u, v));
            }
            list.Add(to);
            return list;
        }
        var sides = new[]
        {
            Side(0, cw0, cv, t => (0, t)),
            Side(1, cu, cw0, t => (1 - t, 0)),
            Side(2, cv, cu, t => (t, 1 - t)),
        };
        // The inside: rings of the inner level's points, each a smaller triangle.
        var inside = Edge.Of(ii.Level, ii.Odd).All();
        int n = inside.Length - 1;
        int rings = n / 2;
        var ringsList = new List<List<int>[]>();
        for (int r = 1; r <= rings; r++)
        {
            // Ring r: the triangle whose corners lie at depth r (barycentric coordinates from the inner points).
            double d = inside[r];
            double scale = 1 - 3 * d;
            if (scale <= 1e-9)
            {
                ringsList.Add([[Add(1.0 / 3, 1.0 / 3)], [], []]);
                break;
            }
            int segments = n - 2 * r;
            (double, double) Bary(double a, double b, double c) => (d + a * scale, d + b * scale);
            var ring = new List<int>[3];
            var corners = new[] { Bary(0, 0, 1), Bary(1, 0, 0), Bary(0, 1, 0) };
            int rw = Add(corners[0].Item1, corners[0].Item2), ru = Add(corners[1].Item1, corners[1].Item2), rv = Add(corners[2].Item1, corners[2].Item2);
            List<int> RingSide(int from, int to, Func<double, (double, double)> at)
            {
                var list = new List<int> { from };
                for (int k = 1; k < segments; k++)
                {
                    double t = (inside[r + k] - inside[r]) / Math.Max(1e-12, inside[n - r] - inside[r]);
                    var (u, v) = at(t);
                    list.Add(Add(u, v));
                }
                list.Add(to);
                return list;
            }
            ring[0] = RingSide(rw, rv, t => Bary(0, t, 1 - t));
            ring[1] = RingSide(ru, rw, t => Bary(1 - t, 0, t));
            ring[2] = RingSide(rv, ru, t => Bary(t, 1 - t, 0));
            ringsList.Add(ring);
        }
        var outerRing = sides;
        foreach (var ring in ringsList)
        {
            if (ring[1].Count == 0)
            {
                // The centre point.
                foreach (var side in outerRing)
                    for (int k = 0; k + 1 < side.Count; k++) Tri(ring[0][0], side[k], side[k + 1]);
                outerRing = [];
                break;
            }
            for (int s = 0; s < 3; s++) Join(outerRing[s], ring[s]);
            outerRing = ring;
        }
        if (outerRing.Length == 3 && outerRing[0].Count > 0 && ringsList.Count > 0 && ringsList[^1][1].Count > 0)
        {
            // The innermost ring: a triangle (or a point already handled).
            var last = outerRing;
            if (last[0].Count == 2 && last[1].Count == 2 && last[2].Count == 2) Tri(last[0][0], last[1][0], last[2][0]);
            else
            {
                int centre = Add(1.0 / 3, 1.0 / 3);
                foreach (var side in last)
                    for (int k = 0; k + 1 < side.Count; k++) Tri(centre, side[k], side[k + 1]);
            }
        }
        else if (ringsList.Count == 0)
        {
            int centre = Add(1.0 / 3, 1.0 / 3);
            foreach (var side in sides)
                for (int k = 0; k + 1 < side.Count; k++) Tri(centre, side[k], side[k + 1]);
        }
        return new Mesh(points, triangles);

        void Join(List<int> outerSide, List<int> innerSide)
        {
            // Both sides run the same way; positions compared by their share of the side's length.
            double Pos(List<int> side, int k) => side.Count <= 1 ? 0.5 : Dist(side[0], side[k]) / Math.Max(1e-12, Dist(side[0], side[^1]));
            double Dist(int a, int b) => Math.Sqrt(Math.Pow(points[a].U - points[b].U, 2) + Math.Pow(points[a].V - points[b].V, 2));
            int a = 0, b = 0;
            while (a < outerSide.Count - 1 || b < innerSide.Count - 1)
            {
                bool advanceOuter = b >= innerSide.Count - 1 || a < outerSide.Count - 1 && (Pos(outerSide, a) + Pos(outerSide, a + 1)) / 2 <= (Pos(innerSide, b) + Pos(innerSide, b + 1)) / 2;
                if (advanceOuter)
                {
                    Tri(outerSide[a], outerSide[a + 1], innerSide[b]);
                    a++;
                }
                else
                {
                    Tri(outerSide[a], innerSide[b + 1], innerSide[b]);
                    b++;
                }
            }
        }
    }
}
