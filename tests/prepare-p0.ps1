param(
  [Parameter(Mandatory=$true)][string]$MixedScreenshot,
  [string]$OutputDirectory = '.vision-research'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.IO;
public static class P0Image {
  public static void Save(string source, string target, int cap) {
    using (var original = new Bitmap(source)) {
      int width = Math.Min(cap, original.Width);
      int height = (int)Math.Round(original.Height * (double)width / original.Width);
      using (var scaled = new Bitmap(original, width, height))
      using (var output = new BinaryWriter(File.Create(target))) {
        output.Write(width);
        output.Write(height);
        for (int y = 0; y < height; y++)
          for (int x = 0; x < width; x++) {
            Color pixel = scaled.GetPixel(x, y);
            output.Write(pixel.R);
            output.Write(pixel.G);
            output.Write(pixel.B);
          }
      }
    }
  }
}
"@
[P0Image]::Save((Resolve-Path -LiteralPath $MixedScreenshot).Path, (Join-Path $OutputDirectory 'user-mixed-kan.rgb'), 1280)

$sources = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'p0-sources.json') -Raw | ConvertFrom-Json
foreach ($source in $sources.PSObject.Properties) {
  $target = Join-Path $OutputDirectory ($source.Name + '.png')
  if (!(Test-Path -LiteralPath $target)) {
    Invoke-WebRequest -UseBasicParsing -Uri ($source.Value + '?width=1200') -OutFile $target
  }
  [P0Image]::Save((Resolve-Path -LiteralPath $target).Path, (Join-Path $OutputDirectory ($source.Name + '.rgb')), 1200)
}
