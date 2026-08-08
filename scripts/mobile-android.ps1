$ErrorActionPreference = "Stop"

$androidStudioJava = "C:\Program Files\Android\Android Studio\jbr"

if (-not $env:JAVA_HOME -and (Test-Path (Join-Path $androidStudioJava "bin\java.exe"))) {
  $env:JAVA_HOME = $androidStudioJava
}

if (-not $env:JAVA_HOME) {
  throw "JAVA_HOME nao configurado e Java do Android Studio nao encontrado em $androidStudioJava"
}

$javaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
if (-not (Test-Path $javaExe)) {
  throw "JAVA_HOME aponta para '$env:JAVA_HOME', mas '$javaExe' nao existe"
}

$env:Path = "$env:JAVA_HOME\bin;$env:Path"

npx.cmd expo run:android
