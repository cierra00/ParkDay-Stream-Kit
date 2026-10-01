# Read-only on the originals: writes preview stills to ctpg-pack\previews only.
$out = 'C:\StreamerBot\ctpg-pack\previews'; New-Item -ItemType Directory -Force $out | Out-Null
$vids = @{ monorail='D:\OBS-Mobilin_old\brb\monorail.mp4'; dca='D:\OBS-Mobilin_old\brb\dca.mp4'; pause1='$env:USERPROFILE\Videos\pause_1.mp4'; halloween='$env:USERPROFILE\Videos\pause_20260914192319.mp4' }
foreach ($k in $vids.Keys) {
  $p = $vids[$k]
  $info = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt -show_entries format=duration -of compact=p=0:nk=0 $p
  "$k : $info"
  & ffmpeg -y -v error -ss 2.5 -i $p -frames:v 1 "$out\$k-original.png"
}
foreach ($k in 'monorail','dca') {
  $p = $vids[$k]
  # A: centre crop to 9:16
  & ffmpeg -y -v error -ss 2.5 -i $p -frames:v 1 -vf "crop=ih*9/16:ih,scale=1080:1920" "$out\$k-A-crop.png"
  # B: full frame fitted to width, blurred zoomed copy behind
  & ffmpeg -y -v error -ss 2.5 -i $p -frames:v 1 -filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.08[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" "$out\$k-B-blurfill.png"
}
Get-ChildItem $out | Select-Object Name,Length | Format-Table | Out-String
