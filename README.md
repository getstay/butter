# butter

A tool to make writing, distributing, and executing LibreOffice Basic code reasonable from a unix mindset.

## status: Proof of concept

The hello world example works, but this tool is incomplete and not ready for use.

## motivations

This is a small sample of relevant threads:

- https://stackoverflow.com/questions/62626602/how-to-run-libreoffice-macros-from-the-command-line-no-uno-or-libreoffice-ser
- https://superuser.com/questions/250086/what-is-needed-to-invoke-libreoffice-running-just-the-macro-without-the-gui
- https://ask.libreoffice.org/en/question/136470/libreoffice-stuck-on-2-or-more-parallel-processing/
- https://stackoverflow.com/questions/13675192/can-i-do-vba-programming-with-vim#comment18989035_13675915

Like, Microsoft Office, LibreOffice/OpenOffice assumes full control over Basic macro development and usage, from file creation, text editing, debugging, to execution.
- Want to write your Basic macros in vim (or any other text editor?). Not with this monolithic situation, friend! Instead, you are made to re-invent your text editor for the monolith, i.e. [vibreoffice](https://github.com/seanyeh/vibreoffice), or continue to kill your wrists, mind, and productivity with the native built-in IDE.
- To distribute your work, you have to either find and copy the files out of your user global config profile (including required cruft xml GUI related files), or figure out how to use the GUI to embed macro libraries into a file and save it.
- Version control? Your files are either in the user config profile or embedded in an easier-to-distribute file... but that file is a zip archive, so your version control commits are practically worthless.
- Want to download a macro and run it from the command line? That's a tolerable endeavor if you know the format (it's poorly documented and documented incorrectly in places), **except** you're bound to have a macro run and just hang afterward, because the macro itself is expected to close the document it is running from in that case, even though it is headless.
- If you get beyond those obstacles, try running a command twice in parallel - the second invocation does nothing whatsoever - not even reporting a reason. This is all eye-rolling madness in comparison to opening up a text editor, writing some code in it, typing a command, and the code runs. This project aims to let you write and invoke LibreOffice Basic macros without the LibreOffice GUI/IDE, allowing you to stay fully in the terminal if you wish, without jumping through any needless hoops. You are freed to move your work in and out of LibreOffice's monolithic control as you please.

Why is it called butter?
`LibreOffice Basic -> LBA -> Liquid Butter Alternative -> Butter`

## warning

Backup your user profile before trying this tool. There can be edge cases this tool is currently not handling, which could cause invalid files to be written to your user profile or some other kind of data loss / corruption. The context where this tool is most useful and safe is one where the user profile and libraries are being committed to version control.

## environment

Developed on Node 14 and LibreOffice 6.3.6.2, but should work on Node 12+ and LibreOffice 4+. TODO: automated testing for multiple environments.

## install

```sh
# install from GitHub
npm install -g getstay/butter
# install from npm
# npm install -g @getstay/butter # TODO: publish this
```

## example

There is a library `Process` inlcuded in this project under `./basic`. It has functions for working with child processes and writing to stdout and stderr. In this example, we indicate the directory containing the `Process` library, and invoke the `stdout_log` function of its module that is also called `Process`.
```sh
butter --library-path ./basic 'Process.Process.stdout_log("hello, world!")'

# log to stderr, with stderr output colored red to confirm it is stderr
butter --library-path ./basic 'Process.Process.stderr_log("hello, world!")' 2> >(while read line; do echo -e "\e[01;31m$line\e[0m" >&2; done)
```

## Library structure

### LibreOffice user profile

```txt
- basic/
	- dialog.xlc
			This file should contain an element for each Library installed in the profile, referencing the library's `dialog.xlb` file.
	- script.xlc
			This file should contain an element for each Library installed in the profile, referencing the library's `script.xlb` file.
	- ${LibraryName}/
		- dialog.xlb
			This file should contain an element for each dialog in the library, referencing the dialog's name.
		- script.xlb
			This file should contain an element for each module in the library, referencing the module's name.
		- ${DialogName}.xdl
			This file contains xml. It opens with the xml declaraction and doctype, and the rest is dialog markup.
		- ${ModuleName}.xba
			This file contains some xml cruft that can be ignored. The xml tag of interest is `script:module`. Its attribute `script:name` is the module name, and its text content is the LibreOffice Basic script with html entities encoded.
```

### exported

```txt
- ${libraryPath}/
	- ${LibraryName}/
		- ${DialogName}.xdl
			This file is unchanged from how it appears normally in a LibreOffice Library.
		- ${ModuleName}.vb
			LibreOffice Basic code belongs in these files.
			Unlike the original script embedded within xml, this script does not have encoded html entities.
			`.vb` was chosen as the extension because it seems to offer slightly better syntax highlighting for LibreOffice Basic code in editors than `.bas`.
```

## usage

Commands that interact with a user profile will look to the default LibreOffice user profile directory `~/.config/libreoffice/4/user`. You can reconfigure this with an environment variable `LIBREOFFICE_USER_PROFILE`.

```sh
LIBREOFFICE_USER_PROFILE="./path/to/libreoffice_user_profile" butter export MyLibrary
```

### export

Use this to get scripts out of the LibreOffice 'world' and into your local project / repository.

`export` extracts LibreOffice Basic scripts from a library within a LibreOffice user profile. By default, output will be under `./basic` from the current working directory, with the directory structure `./${LibraryName}/${ModuleName}.vb`. The directory name and file name are used as the library name and module name for the purposes of this tool, i.e. `butter import`. This avoids dealing with xml cruft files like `dialog.xlb` and `script.xlb`.

```sh
butter export -l ./path/to/libraries MyLibrary
```

### import

Use this to get your local scripts into LibreOffice for the sake of using the LibreOffice GUI/IDE for editing and debugging in that context. After saving your work, you can run `export` to bring your changes into your local project.

Takes the name of a local library, generates the necessary library files and places them in the user profile, and updates the relevant xml records in the user profile to include the library if it was not already present.

```sh
butter import -l ./path/to/libraries MyLibrary
```

```sh
LIBREOFFICE_USER_PROFILE="./path/to/libreoffice_user_profile" butter import ./path/to/MyLibrary
```

### pack

Takes a path to a Library directory and packs the library into an OpenDocument Text file (`.odt`). By default, a new `.odt` file is created, but you can specify an output path to any existing zip archive (which an `.odt` file is) and use the flag `--modify` to pack the library into the existing file. Without the `--modify` flag, the existing file would be overwritten by the new one.

```sh
butter pack -o ./dist/my-file.odt ./path/to/MyLibrary
butter pack --modify -o ./my-file.odt ./path/to/MyLibrary
```

### unpack

Takes a path to a zip archive (such as an `.odt` file) and a Library name and extracts the library scripts into a directory with the same semantics of `export`. `unpack` is just like `export`, except the library to be exported is in an archive instead of a user profile.

### run

```sh
butter run 'MyLibrary.MyModule.MyFn("arg1String", 2, True")'
butter run -l ./basic/ 'MyLibrary.MyModule.MyFn("arg1String", 2, True")'
butter run -l ./my-file.odt 'MyLibrary.MyModule.MyFn("arg1String", 2, True")'

butter run --disable-profile-isolation --library-path ./basic 'MyLibrary.MyModule.MyFn("arg1String", 2, True")'
```

## unsettled concerns

libreoffice creates a `.lock` file beside the user profile, doesn't delete it in some cases (i.e. ctrl + c signal to kill process), and complains about it at startup sometimes (possibly only in GUI usage). It would be good to know what the options are concerning that behavior and having a solid strategy for handling/avoiding it.

There is a similar concern as above with lock files created for file opened in libreoffice.

Dump of possibly relevant knowledge:
	The env vars [here](https://wiki.openoffice.org/wiki/Environment_Variables) that seem relevant didn't affect the profile `.lock` when I tried them. On my machine, the commands `libreoffice` and `soffice` refer to an entry script that sets those env vars, so I tried setting them and invoking `/usr/lib/libreoffice/program/soffice.bin` directly.
	There are some user profile settings that are relevant to user profile locking and file locking.
	This tool's `run` command copies the user profile to have a unique user profile per invocation of libreoffice, and uses the --view flag on the macro file it loads to hopefully avoid these issues while running macros.
