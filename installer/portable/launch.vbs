Option Explicit
Dim shell, files, baseDir, edgePath, appUrl
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
baseDir = files.GetParentFolderName(WScript.ScriptFullName)
appUrl = "http://127.0.0.1:3100"

shell.Run Chr(34) & baseDir & "\runtime\node.exe" & Chr(34) & " " & Chr(34) & baseDir & "\server.mjs" & Chr(34), 0, False
WScript.Sleep 1400

edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If Not files.FileExists(edgePath) Then edgePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If files.FileExists(edgePath) Then
  shell.Run Chr(34) & edgePath & Chr(34) & " --app=" & appUrl & " --start-maximized", 1, False
Else
  shell.Run appUrl, 1, False
End If
