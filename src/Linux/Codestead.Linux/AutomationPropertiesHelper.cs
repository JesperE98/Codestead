using Avalonia.Controls;

namespace Codestead.Linux;

/// <summary>Small wrapper so screen-reader names can be set without importing the automation namespace everywhere.</summary>
internal static class AutomationPropertiesHelper
{
    public static void SetName(Control c, string name) => Avalonia.Automation.AutomationProperties.SetName(c, name);
}
