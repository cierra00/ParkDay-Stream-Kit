# Makes NEW vertical versions next to the originals. Originals are not touched.
$font = 'C\:/Windows/Fonts/ariblk.ttf'
if (-not (Test-Path 'C:\Windows\Fonts\ariblk.ttf')) { $font = 'C\:/Windows/Fonts/arialbd.ttf' }
$jobs = @(
  @{ k='dca'; src='D:\OBS-Mobilin_old\brb\dca.mp4'; dst='D:\OBS-Mobilin_old\brb\dca-vertical.mp4'; x=2322; y1=1560; y2=1740; fill='0x86E04F'; border='0x1B3A10' },
  @{ k='monorail'; src='D:\OBS-Mobilin_old\brb\monorail.mp4'; dst='D:\OBS-Mobilin_old\brb\monorail-vertical.mp4'; x=1150; y1=1380; y2=1560; fill='0xF4C04E'; border='0x4A2A0A' }
)
foreach ($j in $jobs) {
  if (Test-Path $j.dst) { "SKIP exists: $($j.dst)"; continue }
  $t = "fontfile='$font':fontsize=150:fontcolor=$($j.fill):borderw=10:bordercolor=$($j.border):shadowx=0:shadowy=8:shadowcolor=black@0.45:x=(w-text_w)/2"
  # Same timing as the original: nothing, then "BE RIGHT", then "BE RIGHT BACK!"
  $vf = "crop=956:1700:$($j.x):0,scale=1080:1920:flags=lanczos,drawtext=$($t):text='BE RIGHT':y=$($j.y1):enable='gte(t,0.8)',drawtext=$($t):text='BACK!':y=$($j.y2):enable='gte(t,1.6)',format=yuv420p"
  & ffmpeg -y -v error -i $j.src -vf $vf -c:v libx264 -preset slow -crf 18 -r 30 -an -movflags +faststart $j.dst
  "made $($j.dst) $((Get-Item $j.dst).Length) bytes"
  & ffmpeg -y -v error -i $j.dst -vf "fps=1,scale=216:-2,tile=5x1" -frames:v 1 "C:\StreamerBot\ctpg-pack\previews\$($j.k)-vertical-sheet.jpg"
}
