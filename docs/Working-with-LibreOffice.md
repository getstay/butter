## soffice binary

`soffice.bin` is the substance of libreoffice - the underlying binary for command line usage or launching the GUI. This binary is found in an 'installation' of LibreOffice or something portable, like an AppImage. The `libreoffice` command is a shell script that calls `oosplash` that calls `soffice.bin`. The shell script seems mostly for the purpose of setting up some debugging tools and `ooslpash` restarts `soffice.bin` in some cases closes that it closes i.e. first start. I prefer to call `soffice.bin` directly to avoid the overhead of those in scripting situations.

### installed

The likely scenario is:

- `libreoffice` is available via `PATH`
- LibreOffice is installed in `/usr/lib/libreoffice/`
- The path to `soffice.bin` is `/usr/lib/libreoffice/program/soffice.bin`
- Your user profile is `~/.config/libreoffice/4/user/`

### AppImage

The AppImage contains its own filesystem with an installation of libreoffice.

`soffice.bin` is probably at `/opt/libreoffice*.*/program/soffice.bin`

You can't call `soffice.bin` directly with the AppImage. I prefer to use the AppImage as a single distributable asset, but to extract its filesystem for execution.


## soffice.bin is unreliable for programming purposes

The semantics of the LibreOffice application fit with a system user / GUI situation and are strongly at odds with programmatic usage within another application. LibreOffice only supports one process per user profile at a time - parallel invocations are broken. One process may cause a user profile or document to be 'locked' by LibreOffice, and prevent a future process from running properly should it fail to unlock something. The user profile can greatly affect the behavior of a process, from changing how a document is processed within a macro to leaving the process hanging altogether due to an unhandled security issue. In the 'installation' scenario, the user profile is not isolated, can be 'locked', is not immutable, and is not version controlled.

For programming purposes, the user profile must be handled in this manner:

- per invocation of libreoffice: copy the user profile to a tmp dir, explicitly pass the tmp dir as the user profile path to the libreoffice command i.e. `soffice.bin --env:UserInstallation=/tmp/<unique_user_profile>/`, remove user profile tmp dir
- user profile lives with the application source files that use it when calling libreoffice, and so is version controlled.
- one user profile may be shared among different parts of the application that call libreoffice for different purposes, but only if the config is truly general to the consumers. The config should not have settings or scripts that are particular to a consumer. Consider whether the user profile has knowledge of the consumer or whether the consumer has knowledge of it.

### macro concerns

The security settings in the user profile prevent macros embedded in document from running by default. The only secure option is to allow embedded macros to run in trusted locations, only trusting locations where you have such documents. However, this means the inputs of your process are the document containing the macro and the user profile with the setting that allows it to run. If you move the document, you prevent it from being able to run, which is not at all an obvious consequence. To simplify matters and prevent such gotchas, it seems the only good choice is to go all in on the user profile by packaging your macros into it, instead of embedding them in documents, as far as building applications is concerned.

Having a LibreOffice user profile living in your source code is unfortunate. The xml cruft of and encoding of macros within the user profile is even worse. It is ideal to just write Basic code and have something run it, somehow, and it just work. You just version control those scripts - no user profile or other cruft. This works as long as the default user profile is sufficient, which should be the case so long as the stategy is to copy macros into it and run them from there. Generating a user profile and copying the macros into it has significant overhead you would not want to incur on every invocation, so this should be done in a build step, or at least at application startup.

Steps:
- write Basic macros
- run a command that takes a path to your macros and a path to your libreoffice binary, generates a user profile, and puts your macros into the user profile
- use that profile (using the tmp user profle copy strategy, of course) when executing a macro

#### dependencies

Whether you embed your macro and its dependencies into one document, put them all into a user profile, or embed your macro into a document and each or all dependencies into other documents, you have some form of a flat list of dependants and dependencies, instead of an ideal hierarchy, with each dependant packaging up its dependencies so that nothing else needs to deal with them. Without such a system, building up small, consumable units of functionality from other such units will suffer dependency resolution that is flimsy and unreliable.

Basic's library organization and loading semantics are mentally taxing and an obstacle to true modularity and encapsulation.

Modules within a library clobber each other when using the same names for things:


```vb
' FooLibrary.Module1
Public Const FooValue = 1
```

```vb
' FooLibrary.Module2
Public Const FooValue = 2
```

```vb
BasicLibraries.LoadLibrary("FooLibrary")
' should have a value of 1, but got clobbered by Module2.FooValue
FooLibrary.Module1.FooValue ' 2
```

A better approach is for a module to be a file and to load modules using a function that takes a module filepath and returns the module, allowing it to be explicitly assigned to a chosen variable name. Each file is put into its own library, so nothing is clobbered.

```vb
Function MyFunction
	Math = [#require]("./Math.vb")
	Math.min(9, 3, 4) ' 3
End Function
```

This is how NodeJS modules work, so we can follow the pattern of a NodeJS module package, and even use NodeJS tools, like `npm` to do it. All that is needed is a tool to parse `require` calls from scripts, resolve the files, create a uniquely named library per file, replace require calls with code to load the library and return its module, and put the libraries into a user profile. You can then pass that user profile to the libreoffice command and invoke a macro within it.

For example:

```
- src/
	- ./Foo.vb
	- ./Bar.vb
```
```sh
# specifying a file to compile
butter compile -o ./dist/my-macro-user-profile -n MyLibrary ./src/Foo.vb
butter run -u ./dist/my-macro-user-profile 'MyLibrary.Foo.someFooFn()'

# specifying multiple files to compile
butter compile -o ./dist/my-macro-user-profile -n MyLibrary ./src/*.vb
butter run -u ./dist/my-macro-user-profile 'MyLibrary.Foo.someFooFn()'
butter run -u ./dist/my-macro-user-profile 'MyLibrary.Bar.someBarFn()'
```

## reliable, compatible, independent unit of functionality

### developing macros

- Write macro modules as regular files in a project that is consumable as a NodeJS package.
- Use a tool to allow you to load other module files using `require`.
- Include scripts to compile, run, and test the macro.
- use CI to test macros on various versions of LibreOffice to confirm support.

#### working within the GUI and IDE

In this workflow, the user profile and macros in the structure that libreoffice can use are a build artifact, and so the source files are not directly usable/editable in LibreOffice. A high level tool could compile given files into a user profile, invoke libreoffice with that profile, and open the ide to the first given file, then watch for changes on the module files in the user profile and export the updated code back to the source files. This would be transparent to the user, as the specified files were loaded into libreoffice, and changes were saved to those files, as one would expect if this is just the way libreoffice worked in the first place, other than perhaps dependency libraries cluttering up the library menu.

```sh
butter ide ./src/*
```

### in applications that call libreoffice / macros

- bring LibreOffice into your project as an AppImage and pin an exact version.
- consume macros via user profiles containing them
- invoke macros using a wrapper around libreoffice that provides a unique, temporary user profile per invocation
