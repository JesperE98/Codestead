using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Shapes;
using Avalonia.Data;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls;

/// <summary>
/// Simple line icons drawn in the text colour of the button they sit in, for the places where a colour
/// emoji would stand out too much (the settings and achievements entries in the menus).
/// </summary>
public static class Icons
{
    private static string N(double v) => v.ToString("0.##", CultureInfo.InvariantCulture);

    /// <summary>A gear: eight teeth around a ring (24 × 24).</summary>
    private static readonly Lazy<Geometry> GearGeometry = new(() =>
    {
        var sb = new System.Text.StringBuilder();
        const double cx = 12, cy = 12, outer = 10, root = 7.4;
        for (int i = 0; i < 8; i++)
        {
            double a = i * 45;
            foreach (var (deg, r) in new[] { (a - 15.0, root), (a - 8.0, outer), (a + 8.0, outer), (a + 15.0, root) })
            {
                double rad = deg * Math.PI / 180;
                sb.Append(sb.Length == 0 ? "M" : " L").Append(N(cx + r * Math.Cos(rad))).Append(',').Append(N(cy + r * Math.Sin(rad)));
            }
        }
        sb.Append(" Z M15,12 A3,3 0 1 1 9,12 A3,3 0 1 1 15,12 Z");
        return Geometry.Parse(sb.ToString());
    });

    /// <summary>A trophy: cup with handles, stem and base (24 × 24).</summary>
    private static readonly Lazy<Geometry> TrophyGeometry = new(() => Geometry.Parse(
        "M7,4 L17,4 L17,9 A5,5 0 0 1 7,9 Z " +
        "M7,5.5 L4.5,5.5 A2.6,2.6 0 0 0 7.6,11 " +
        "M17,5.5 L19.5,5.5 A2.6,2.6 0 0 1 16.4,11 " +
        "M12,14 L12,17 " +
        "M9,17 L15,17 L15,20 L9,20 Z"));

    private static Control Draw(Geometry geometry, double size)
    {
        var path = new Avalonia.Controls.Shapes.Path
        {
            Data = geometry,
            StrokeThickness = 1.7,
            StrokeJoin = PenLineJoin.Round,
            StrokeLineCap = PenLineCap.Round,
            Stretch = Stretch.Uniform,
            Width = size,
            Height = size,
            VerticalAlignment = VerticalAlignment.Center,
        };
        // The same colour as the text of the button (or other control) around it.
        path.Bind(Shape.StrokeProperty, new Binding("Foreground") { RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor) { AncestorType = typeof(TemplatedControl) } });
        return path;
    }

    public static Control Gear(double size = 16) => Draw(GearGeometry.Value, size);

    public static Control Trophy(double size = 16) => Draw(TrophyGeometry.Value, size);

    /// <summary>An icon followed by a text, for a menu entry.</summary>
    public static StackPanel Label(Control icon, string text, double spacing = 9)
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = spacing };
        row.Children.Add(icon);
        row.Children.Add(new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Center });
        return row;
    }
}
