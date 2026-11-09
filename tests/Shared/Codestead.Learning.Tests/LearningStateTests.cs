namespace Codestead.Learning.Tests;

public class LearningStateTests
{
    [Fact(DisplayName = "sparade framsteg följer med uppgifter som flyttat till ett annat kapitel")]
    public void MovedTasksKeepTheirProgress()
    {
        var state = new LearningState();
        state.Progress["old/task"] = true;
        state.Progress["old/other"] = true;
        state.Progress["old/fam@debian"] = true;
        state.Attempts["old/task"] = 2;
        state.HintSeen.Add("old/task");
        state.Game.SolutionSeen.Add("old/fam@debian");
        var moved = new Dictionary<string, string> { ["old/task"] = "new/task", ["old/fam"] = "new/fam" };

        Assert.True(state.MoveTasks(moved));
        Assert.Equal(["old/other", "new/task", "new/fam@debian"], state.Progress.Keys);
        Assert.Equal(2, state.Attempts["new/task"]);
        Assert.Equal(["new/task"], state.HintSeen);
        Assert.Equal(["new/fam@debian"], state.Game.SolutionSeen);
        // Running it again (every start) changes nothing.
        Assert.False(state.MoveTasks(moved));
    }
}
