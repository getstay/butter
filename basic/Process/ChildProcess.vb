Private Function TempFileWritable_create ()
	file = com.sun.star.io.TempFile.create()
	file.closeInput()
	TempFileWritable_create = file
End Function

Private Function getFileText (filepath)
	Dim desc(0) as new com.sun.star.beans.PropertyValue
	desc(0).Name = "Hidden"
	desc(0).Value = True
	doc = StarDesktop.loadComponentFromURL(convertToUrl(filepath), "_blank", 0, desc)
	getFileText = doc.Text.String
	doc.close(True)
End function

Private Function makeInvocationScript (silent, capture, stdoutFilepath, stderrFilepath)
	If (Not silent And Not capture) Then
		script = "fn"
	ElseIf (silent) Then
		script = "fn > " & stdoutFilepath & " 2> " & stderrFilepath			
	Else
		lines = Array(_
			"out=""$(mktemp -u)""", _
			"err=""$(mktemp -u)""", _
			"mkfifo ""${out}"" ""${err}""", _
			"trap 'rm ""${out}"" ""${err}""' EXIT", _
			"tee -a " & shellEscapeArg(stdoutFilepath) & " < ""${out}"" &", _
			"tee -a " & shellEscapeArg(stderrFilepath) & " < ""${err}"" >&2 &", _
			"fn > ""${out}"" 2> ""${err}""" _
		)
		script = join(lines, Chr(10))
	End If
	makeInvocationScript = script
End Function

Private Function makeOutputCapturingScript (shellString, silent, capture, stdoutFilepath, stderrFilepath, exitCodeFilepath)
	lines = Array( _
		"#!/bin/sh", _
		"fn () {", _
		  "  " & shellString, _
		"}", _
		makeInvocationScript(silent, capture, stdoutFilepath, stderrFilepath), _
		"echo $? >> " & exitCodeFilepath _
	)
	makeOutputCapturingScript = join(lines, Chr(10))
End Function

Function joinShellArgs (args)
	param = IIF(UBound(args) > -1, shellEscapeArg(args(0)), "")
	For i = 1 to UBound(args)
		param = param & " " & shellEscapeArg(args(i))
	Next i
	joinShellArgs = param
End Function

Function shellEscapeArg (value as String)
	GlobalScope.BasicLibraries.LoadLibrary("Tools")
	shellEscapeArg = "'" & Strings.replaceString(value, "'\''", "'") & "'"
End Function

Function makeExecString (cmd as String, args)
	makeExecString = shellEscapeArg(cmd) & " " & joinShellArgs(args)
End Function

Type TypeExecOptions
	capture
	exitCode
	silent
End Type

Function ExecOptions ()
	Dim options as new TypeExecOptions
	ExecOptions = options
End Function

Function ExecOptionsDefault (Optional inputO)
	oo = ExecOptions()
	o = IIF(IsMissing(inputO), oo, inputO)
	With oo
		.capture  = IIF(IsEmpty(o.capture),  True,  o.capture)
		.exitCode = IIF(IsEmpty(o.exitCode), True,  o.exitCode)
		.silent   = IIF(IsEmpty(o.silent),   False, o.silent)
	End With
	ExecOptionsDefault = oo
End Function

Function exec (shellString as String, Optional inputOptions)
	options = ExecOptionsDefault(inputOptions)
	
	stdout = Nothing
	stderr = Nothing
	exitCode = Nothing
	
	scriptFile = TempFileWritable_create()
	scriptFilepath = convertFromUrl(scriptFile.Uri)
	stdoutFilepath = "/dev/null"
	stderrFilepath = "/dev/null"
	exitCodeFilepath = "/dev/null"
	
	If (options.capture) Then
		stdoutFile = TempFileWritable_create()
		stderrFile = TempFileWritable_create()
		stdoutFilepath = convertFromUrl(stdoutFile.Uri)
		stderrFilepath = convertFromUrl(stderrFile.Uri)
	End If

	If (options.exitCode) Then
		exitCodeFile = TempFileWritable_create()
		exitCodeFilepath = convertFromUrl(exitCodeFile.Uri)
	End If

	scriptContents = makeOutputCapturingScript(shellString, options.silent, options.capture, stdoutFilepath, stderrFilepath, exitCodeFilepath)
	script = FreeFile
	Open scriptFile.Uri For Output as #script
	Print #script scriptContents
	Close #script
	Shell("/bin/sh", 6, scriptFilepath, True)
	
	scriptFile.closeOutput()
	
	If (options.capture) Then
		stdout = getFileText(stdoutFilepath)
		stderr = getFileText(stderrFilepath)
		stdoutFile.closeOutput()
		stderrFile.closeOutput()
	End If
	
	If (options.exitCode) Then
		exitCode = CLng(getFileText(exitCodeFilepath))
		exitCodeFile.closeOutput()
	End If
	
	exec = Array(stdout, stderr, exitCode)
End Function

Function execFile (cmd as String, Optional args, Optional options)
	execFile = exec(makeExecString(cmd, args), options)
End Function

Sub [execFile Example]
	options = ExecOptions()
	With options
	'	.capture = False
	'	.exitCode = False
	'	.silent = True
	End With
	'result = execFile("echo", Array("foo"))
	result = execFile("curl", Array("-X", "GET", "-L", "https://api.libreoffice.org"), options)
	stdout = result(0)
	stderr = result(1)
	exitCode = result(2)
End Sub
