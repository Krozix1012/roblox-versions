' Runs the archiver with no window, writing to archive.log. Used by the hourly task from schedule.cmd.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c cd /d """ & here & """ && node archive.js >> archive.log 2>&1", 0, False
