using Avalonia.Controls;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>Pictures in a text: still images, animated GIF and WebP (every frame), and a missing picture left out.</summary>
public class MarkdownPictureTests
{
    // 4×4 pictures: red, green, blue frames of 50 ms (made with Pillow).
    private const string Gif = "R0lGODlhBAAEAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQABQAAACwAAAAABAAEAAAICQABCBxIsCCAgAAh+QQBBQABACwAAAAABAAEAIEA/wAAAAAAAAAAAAAICQABCBxIsCCAgAAh+QQBBQABACwAAAAABAAEAIEAAP8AAAAAAAAAAAAICQABCBxIsCCAgAA7";
    private const string Webp = "UklGRrQAAABXRUJQVlA4WAoAAAACAAAAAwAAAwAAQU5JTQYAAAAAAAAAAABBTk1GKAAAAAAAAAAAAAMAAAMAADIAAAJWUDhMDwAAAC8DwAAABxD9j/4HIqL/AQBBTk1GKAAAAAAAAAAAAAMAAAMAADIAAABWUDhMDwAAAC8DwAAAB9D/iP4HIqL/AQBBTk1GKAAAAAAAAAAAAAMAAAMAADIAAABWUDhMDwAAAC8DwAAABxDR//4HIqL/AQA=";
    private const string Png = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP8z4AATAxEcQAz0QEHOoQ+uAAAAABJRU5ErkJggg==";

    [Theory(DisplayName = "en bild i texten visas med alla sina bildrutor")]
    [InlineData("images/a.png", Png, 1)]
    [InlineData("images/a.gif", Gif, 3)]
    [InlineData("images/a.webp", Webp, 3)]
    public void PictureShows(string path, string base64, int frames)
        => Ui.Run(() =>
    {
        var view = new MarkdownView { ImageSource = p => p == path ? Convert.FromBase64String(base64) : null };
        view.SetMarkdown($"Före.\n\n![En bild]({path} \"Bildtext\")\n\nEfter.");
        var window = new Window { Width = 600, Height = 400, Content = view };
        window.Show();
        Dispatcher.UIThread.RunJobs();
        var picture = Assert.Single(view.GetVisualDescendants().OfType<AnimatedImage>());
        Assert.Equal(frames, picture.FrameCount);
        Assert.Contains(view.GetVisualDescendants().OfType<TextBlock>(), t => t.Text == "Bildtext");
        window.Close();
    });

    [Fact(DisplayName = "en bild som saknas lämnas bort, och texten runt den visas")]
    public void MissingPictureIsLeftOut()
        => Ui.Run(() =>
    {
        var view = new MarkdownView { ImageSource = _ => null };
        view.SetMarkdown("Före.\n\n![En bild](images/saknas.png)\n\nEfter.");
        var window = new Window { Width = 600, Height = 400, Content = view };
        window.Show();
        Dispatcher.UIThread.RunJobs();
        Assert.Empty(view.GetVisualDescendants().OfType<AnimatedImage>());
        window.Close();
    });
}
