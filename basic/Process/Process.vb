Sub [Example]
	' you can color stderr red like this:
    ' libreoffice 2> >(while read line; do echo -e "\e[01;31m$line\e[0m" >&2; done)
	stdout_log("foo")
	stderr_log("bar")
	stdout_log("baz")
End Sub

Private Function StdioWriteOptions ()
	options = ChildProcess.ExecOptions()
	With options
		.capture = False
		.exitCode = False
		.silent = False
	End With
	StdioWriteOptions = options
End Function

Function stdout_write (value as String)
	ChildProcess.execFile("printf", Array("%s", value), StdioWriteOptions())
End Function

Function stdout_log (value as String)
	stdout_write(value & Chr(10))
End Function

Function stderr_write (value as String)
	shellString =  ChildProcess.joinShellArgs(Array("printf", "%s", value))
	ChildProcess.execFile("/bin/sh", Array("-c", shellString & " > /dev/stderr"), StdioWriteOptions())
End Function

Function stderr_log (value as String)
	stderr_write(value & Chr(10))
End Function