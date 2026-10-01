$parks = [ordered]@{
 "Magic Kingdom"="75ea578a-adc8-4116-a54d-dccb60765ef9"; "EPCOT"="47f90d2c-e191-4239-a466-5892ef59a88b";
 "Hollywood Studios"="288747d1-8b4f-4a64-867e-ea7c9b27bad8"; "Animal Kingdom"="1c84a229-8862-4648-9c71-378ddd2c7693";
 "Disneyland"="7340550b-c14d-4def-80bb-acdb51d49a66"; "California Adventure"="832fcd51-ea19-4e77-85c7-75d5843b127c";
 "Universal Studios Florida"="eb3f4560-2383-4a36-9152-6b3e5ed6bc57"; "Islands of Adventure"="267615cc-8943-4c2a-ae2c-5da728ca591f";
 "Epic Universe"="12dbb85b-265f-44e6-bccf-f1faa17211fc"; "Universal Studios Hollywood"="bc4005c5-8c7e-41d7-b349-cdddf1796427" }
$head = 'parade|cavalcade|firework|spectacular|happily ever after|luminous|fantasmic|starlight|enchantment|wondrous journeys|world of color|nighttime|harmonious|kaleidoscope|awakenings|beacons of magic|spelltacular|celebration|drone show'
$not = '^meet |pianist|\bdans\b|philharmonic|flag retreat|dj |character|photo'
$out = @()
foreach ($p in $parks.Keys) {
  $r = Invoke-RestMethod "https://api.themeparks.wiki/v1/entity/$($parks[$p])/live"
  foreach ($e in ($r.liveData | ? { $_.entityType -eq 'SHOW' })) {
    $t = ($e.showtimes | ? { $_.startTime } | % { ([datetimeoffset]$_.startTime).ToString('MM-dd HH:mm') + $(if ($_.type -match 'Special') {'*'} else {''}) }) -join ' '
    $h = ($e.name -match $head) -and -not ($e.name -match $not)
    $out += [pscustomobject]@{Park=$p; Headliner=$h; Status=$e.status; Name=$e.name; Times=$t}
  }
}
$out | Export-Csv "$PSScriptRoot\shows_research.csv" -NoTypeInformation -Encoding UTF8
$out | ? { -not ($_.Name -match '^Meet ') } | % { "{0} | {1} | {2} | {3} | {4}" -f $_.Park, $(if($_.Headliner){'YES'}else{'-'}), $_.Status, $_.Name, $_.Times }
