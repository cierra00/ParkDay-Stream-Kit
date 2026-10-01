using System;

public class CPHInline
{
    // Remembers which main scene you are on (Now or live), so banners, live clone and dance return you there.
    // Uses the scene from the trigger; falls back to asking OBS.
    public bool Execute()
    {
        string s = "";
        if (args.ContainsKey("obs.sceneName") && args["obs.sceneName"] != null) s = args["obs.sceneName"].ToString();
        else if (args.ContainsKey("sceneName") && args["sceneName"] != null) s = args["sceneName"].ToString();
        if (string.IsNullOrWhiteSpace(s)) s = CPH.ObsGetCurrentScene();
        if (!string.IsNullOrWhiteSpace(s) &&
            (s.Equals("Now", StringComparison.OrdinalIgnoreCase) || s.Equals("live", StringComparison.OrdinalIgnoreCase)))
        {
            CPH.SetGlobalVar("ctpgHomeScene", s, true);
            CPH.LogInfo("[HOME] Home scene is now '" + s + "'.");
        }
        return true;
    }
}
