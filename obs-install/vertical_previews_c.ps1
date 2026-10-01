# Option C: reframe above the burned-in text, then add new "BE RIGHT BACK!" text. Preview stills only.
$out = 'C:\StreamerBot\ctpg-pack\previews'
$font = 'C\:/Windows/Fonts/ariblk.ttf'
if (-not (Test-Path 'C:\Windows\Fonts\ariblk.ttf')) { $font = 'C\:/Windows/Fonts/arialbd.ttf' }
$jobs = @(
  @{ k='dca'; src='D:\OBS-Mobilin_old\brb\dca.mp4'; x=2322; fill='0x86E04F'; border='0x1B3A10' },
  @{ k='monorail'; src='D:\OBS-Mobilin_old\brb\monorail.mp4'; x=1150; fill='0xF4C04E'; border='0x4A2A0A' }
)
foreach ($j in $jobs) {
  $vf = "crop=956:1700:$($j.x):0,scale=1080:1920,drawtext=fontfile='$font':text='BE RIGHT':fontsize=150:fontcolor=$($j.fill):borderw=10:bordercolor=$($j.border):shadowx=0:shadowy=8:shadowcolor=black@0.45:x=(w-text_w)/2:y=1380,drawtext=fontfile='$font':text='BACK!':fontsize=150:fontcolor=$($j.fill):borderw=10:bordercolor=$($j.border):shadowx=0:shadowy=8:shadowcolor=black@0.45:x=(w-text_w)/2:y=1560"
  & ffmpeg -y -v error -ss 2.5 -i $j.src -frames:v 1 -vf $vf "$out\$($j.k)-C-reframe.png"
  & ffmpeg -y -v error -i "$out\$($j.k)-C-reframe.png" -vf "scale=-2:720" -q:v 4 "$out\$($j.k)-C-reframe-small.jpg"
}
Get-ChildItem $out\*-C-* | Select-Object Name,Length | Format-Table | Out-String
