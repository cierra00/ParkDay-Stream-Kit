using System;

public class CPHInline
{
    // When the dance video ends, go back to your home scene (Now or live), unless you already switched away.
    public bool Execute()
    {
        string video = "dance-intro-video";
        CPH.Wait(1500);                                   // let the video start
        DateTime until = DateTime.Now.AddMinutes(5);
        while (DateTime.Now < until)
        {
            string cur = CPH.ObsGetCurrentScene();
            if (string.IsNullOrWhiteSpace(cur) || !cur.Equals("dance", StringComparison.OrdinalIgnoreCase))
            {
                CPH.LogInfo("[DANCE] Left the dance scene manually ('" + cur + "'), nothing to do.");
                return true;
            }
            string r = CPH.ObsSendRaw("GetMediaInputStatus", "{\"inputName\":\"" + video + "\"}", 0) ?? "";
            if (r.Contains("OBS_MEDIA_STATE_ENDED") || r.Contains("OBS_MEDIA_STATE_STOPPED")) break;
            CPH.Wait(500);
        }
        string h = CPH.GetGlobalVar<string>("ctpgHomeScene", true);
        string home = string.IsNullOrWhiteSpace(h) ? "live" : h;
        string now = CPH.ObsGetCurrentScene();
        if (!string.IsNullOrWhiteSpace(now) && now.Equals("dance", StringComparison.OrdinalIgnoreCase))
        {
            CPH.ObsSetScene(home);
            CPH.LogInfo("[DANCE] Video ended, back to '" + home + "'.");
        }
        return true;
    }
}
