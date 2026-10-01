# Preview only: renders the live-mode overlay over a park photo in 3 states. Touches only preview-live\.
$d = 'C:\StreamerBot\ctpg-pack\preview-live'
Copy-Item C:\StreamerBot\ctpg-pack\parkdata.js $d -Force
'window.CTPG_PLAN = { park: "Hollywood Studios", party:false, items:[{time:"23:30",label:"Late snack at Woody''s Lunch Box"}], watch:[], skip:[] };' | Set-Content "$d\plan.js" -Encoding utf8
"md5 " + (Get-FileHash "$d\overlay.html" -Algorithm MD5).Hash
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$states = @(@('1-before', ''), @('2-riding', 'Riding'), @('3-eats', 'Eats'))
foreach ($st in $states) {
  "window.CTPG_NOW = {""now"":""$($st[1])"",""park"":""Hollywood Studios"",""since"":$ms};" | Set-Content "$d\now_state.js" -Encoding utf8
  foreach ($v in @(@('h','0',1920,1080), @('v','1',1080,1920))) {
    $png = "$d\$($st[0])-$($v[0]).png"
    & $edge --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=6000 "--window-size=$($v[2]),$($v[3])" "--screenshot=$png" "file:///C:/StreamerBot/ctpg-pack/preview-live/frame.html?v=$($v[1])" 2>$null | Out-Null
    & ffmpeg -y -v error -i $png -vf "scale='if(gt(iw,ih),960,-2)':'if(gt(iw,ih),-2,960)'" -q:v 3 ($png -replace '\.png$','.jpg')
  }
  "ok $($st[0])"
}
