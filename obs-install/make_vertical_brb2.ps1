# Rebuilds the two NEW vertical BRB files (made earlier by Claude) with typewriter text matching the originals.
# Originals dca.mp4 and monorail.mp4 are only read.
$sched = @(@(0.6,1),@(0.7,2),@(0.9,4),@(1.1,5),@(1.2,6),@(1.4,7),@(1.5,8),@(1.8,10),@(1.9,11),@(2.0,12),@(2.1,13),@(2.3,14))
$jobs = @(
  @{ k='dca'; src='D:\OBS-Mobilin_old\brb\dca.mp4'; dst='D:\OBS-Mobilin_old\brb\dca-vertical.mp4'; x=2322 },
  @{ k='monorail'; src='D:\OBS-Mobilin_old\brb\monorail.mp4'; dst='D:\OBS-Mobilin_old\brb\monorail-vertical.mp4'; x=1150 }
)
foreach ($j in $jobs) {
  $inputs = @('-i', $j.src)
  foreach ($s in $sched) { $inputs += @('-loop','1','-t','5','-i', ("C:\StreamerBot\ctpg-pack\brb_text\{0}\n{1:D2}.png" -f $j.k, $s[1])) }
  $fc = "[0:v]crop=956:1700:$($j.x):0,scale=1080:1920:flags=lanczos[b0]"
  for ($i = 0; $i -lt $sched.Count; $i++) {
    $start = $sched[$i][0]; $end = if ($i -lt $sched.Count - 1) { $sched[$i+1][0] } else { 99 }
    $fc += ";[b$i][$($i+1):v]overlay=0:0:enable='between(t,$start,$end-0.001)'[b$($i+1)]"
  }
  $fc += ";[b$($sched.Count)]format=yuv420p[out]"
  $tmp = $j.dst + '.new.mp4'
  & ffmpeg -y -v error @inputs -filter_complex $fc -map '[out]' -t 5 -r 30 -c:v libx264 -preset slow -crf 18 -an -movflags +faststart $tmp
  if (Test-Path $tmp) { Move-Item -Force $tmp $j.dst; "made $($j.dst) $((Get-Item $j.dst).Length) bytes" }
  & ffmpeg -y -v error -t 3 -i $j.dst -vf "fps=10,crop=1080:560:0:1250,scale=360:-2,tile=5x6" -frames:v 1 "C:\StreamerBot\ctpg-pack\previews\$($j.k)-vertical-anim.jpg"
}
