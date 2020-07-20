#!/usr/bin/env node

const fs = require('fs-extra')
const path = require('path')
const HOME = require('os').homedir()
const sade = require('sade')
const { path7za: sevenBin } = require('7zip-bin')
const { execFile: execAsync, spawn } = require('promisify-child-process')
const regex = require('regex-fun')
const { ulid } = require('ulid')
const useTmpDir = require('@m59/use-tmp-dir')
const describeLibraries = require('./lib/describeLibraries.js')
const extractModuleScript = require('./lib/extractModuleScript.js')
const lbaLibraryToContentsList = require('./lib/lbaLibraryToContentsList.js')
const lbaLibraryToEmbeddedContentsList = require('./lib/lbaLibraryToEmbeddedContentsList.js')
const butterToLbaLibrary = require('./lib/butterToLbaLibrary.js')
const lbaToButterLibrary = require('./lib/lbaToButterLibrary.js')
const insertLibraryEntriesUnlessPresent = require('./lib/insertLibraryEntriesUnlessPresent.js')
const pkg = require('../package.json')
const pack = require('./lib/pack.js')
const getLibraryNamesInDir = require('./lib/getLibraryNamesInDir.js')
const CallBodyRegex = name => regex.combine(
	regex.capture(regex.either('Function', 'Sub'), regex.anyNumber(/\s/), name),
	regex.capture(regex.oneOrMoreNonGreedy(regex.either(/./, '\n'))),
	regex.capture(regex.combine('End ', regex.either('Function', 'Sub')))
)
const R = require('ramda')
//(?:Function)(?:.|\n)+?(?:End Function)
const createCloseEverythingScript = fnName => `
Function ${fnName} ()
	iter = StarDesktop.getComponents().createEnumeration()
	Do While iter.hasMoreElements()
		document = iter.nextElement()
		document.close(True)
	Loop
End Function
`

const config = {
	user_profile_path: process.env.LIBREOFFICE_USER_PROFILE_PATH || `${HOME}/.config/libreoffice/4/user`
}

const formatImportExportArgs = (LibraryName, args = {}) => {
	const { l: libraryPath, _: moreLibraryNames = [] } = args
	const libraryNames = LibraryName ? [ LibraryName, ...moreLibraryNames ] : []
	return { ...args, libraryPath, libraryNames }
}

const libraryPathOption = [ '-l, --library-path', 'specify the directory of exported libraries ', './basic' ]

const program = sade
	('butter')
  .version(pkg.version)

  .command('export <...LibraryNames>')
		.describe('extracts LibreOffice Basic scripts from a libraries within a LibreOffice user profile.')
		.option(...libraryPathOption)
		.example('export MyLibrary')
		.example('export -l ./path/to/libraries MyLibrary')
		.action(async (...args) => {
			const { libraryPath, libraryNames } = formatImportExportArgs(...args)
			const userProfileLibraryPath = path.join(config.user_profile_path, 'basic')
			const libraries = await describeLibraries({ libraryPath: userProfileLibraryPath, libraryNames, moduleFileExtension: '.xba' })
			await Promise.all(libraries.map(async lbaLibrary => {
				const library = lbaToButterLibrary(lbaLibrary)
				const outputLibraryDir = path.join(libraryPath, library.name)
				await Promise.all(library.components.map(async component => {
					const outputComponentFile = path.join(outputLibraryDir, `${component.name}${component.extension}`)
					await fs.outputFile(outputComponentFile, component.contents)
					console.log(`${component.type} "${library.name}.${component.name}" written to "${outputComponentFile}"`)
				}))
				console.log(`library "${library.name}" exported to "${outputLibraryDir}"`)
			}))
		})

  .command('import [...LibraryNames]')
		.describe('the opposite of `export` - copies libraries into the user profile')
		.option(...libraryPathOption)
		.example('import')
		.example('import MyLibrary')
		.example('import MyLibrary AnotherLibrary')
		.example('import -l ./path/to/libraries MyLibrary AnotherLibrary')
		.action(async (...args) => {
			const { libraryPath, libraryNames } = formatImportExportArgs(...args)
			const outputLibraryPath = path.join(config.user_profile_path, 'basic')
			await (await describeLibraries({ libraryPath, libraryNames, moduleFileExtension: '.vb' }))
				.map(library => ({ name: library.name, contentsList: lbaLibraryToContentsList((butterToLbaLibrary(library))) }))
				.reduce(
					async (promise, { name: libraryName, contentsList }) => {
						await promise
						await useTmpDir(async tmpDir => {
							const tmpLibraryDir = path.join(tmpDir, libraryName)
							const outputLibraryDir = path.join(outputLibraryPath, libraryName)
							await Promise.all(contentsList.map(async ({ name, contents }) => {
								await fs.outputFile(path.join(tmpLibraryDir, name), contents)
								console.log(`created file "${name}"`)
							}))
							console.log(`writing library "${libraryName}" to "${outputLibraryDir}"`)
							await fs.move(tmpLibraryDir, outputLibraryDir, { overwrite: true })
						})
					},
					Promise.resolve()
				)
			await Promise.all([ 'script', 'dialog' ].map(async componentType =>
				insertLibraryEntriesUnlessPresent({
					libraryPath: outputLibraryPath,
					libraryNames,
					target: 'user_profile',
					componentType
				})
			))
			console.log(`imported libraries: ${libraryNames.join(', ')}`)
		})

  .command('pack [...LibraryNames]')
		.describe('')
		.option(...libraryPathOption)
		.option('-o, --output', 'filepath where OpenDocument Text file containing the libraries will be written')
		.option('--modify', 'pack libraries into existing output file', false)
		.example('pack -o ./dist/my-library.odt MyLibrary')
		.example('pack -l ./path/to-libraries -o ./dist/my-library.odt MyLibrary AnotherLibrary')
		.example('pack --modify -o ./dist/my-library.odt MyLibrary')
		.action(async (...args) => {
			const { libraryPath, libraryNames, output, modify } = formatImportExportArgs(...args)
			if (!output) {
				throw new Error('-o, --output argument required')
			}
			await pack({ modify, outputFilepath: output, libraryPath, libraryNames })
		})

  .command('unpack <filepath> [...LibraryNames]')
		.describe('Extracts embedded libraries from a document/archive')
		.option(...libraryPathOption)
		.example('unpack dist/my-library.odt')
		.example('unpack dist/my-library.odt MyLibrary AnotherLibrary')
		.action(() => {
			console.log('NOT IMPLEMENTED')
		})

	.command('run <expression>')
		.describe('Executes a Sub or Function invocation expression')
		.option('-l, --library-path', 'load libraries from file or directory')
		.option('--disable-profile-isolation', 'invoke soffice with the user profile directly instead of a temporary copy', false)
		.example(`run 'SomeUserProfileLibrary.MyModule.Main("arg1String", 2, True")'`)
		.example(`run -l './basic', 'SomeLocalLibrary.MyModule.Main("arg1String", 2, True")'`)
		.example(`run -l './my-file.odt', 'SomeEmbeddedLibrary.MyModule.Main("arg1String", 2, True")'`)
		.action(async (expression, { l: libraryPath }) => {
			if (libraryPath) {
				const libraryPathIsDirectory = (await fs.stat(libraryPath)).isDirectory()
				await (libraryPathIsDirectory ? useTmpDir : fn => fn('/dev/null'))(async tmpDir => {
					const bundle = path.join(tmpDir, 'bundle.odt')
					const embeddedLibrariesFile = libraryPathIsDirectory
						?	await pack({
								libraryPath,
								libraryNames: await getLibraryNamesInDir(libraryPath),
								outputFilepath: bundle
							})
						:	await fs.copy(libraryPath, bundle)
					const [ LibraryName, ModuleName, CallName ] = expression.split(/\.|\(| /)
					const modulePath = `Basic/${LibraryName}/${ModuleName}.xml`
					const moduleTmpPath = path.join(tmpDir, modulePath)
					await execAsync(sevenBin, [ 'x', bundle, modulePath ], { cwd: tmpDir })
					const module = await fs.readFile(moduleTmpPath, 'utf8')
					const closeEverythingFnName = `closeEverything_${ulid()}`
					const runnableModule = R.pipe
						(
							R.replace(CallBodyRegex(CallName), `$1$2\n\t${closeEverythingFnName}()\n$3`),
							module => {
								const lines = module.split('\n')
								const start = lines.slice(0, lines.length - 1)
								const end = lines.slice(-1)
								return [ ...start, createCloseEverythingScript(closeEverythingFnName), ...end ].join('\n')
							}
						)
						(module)
					await fs.writeFile(moduleTmpPath, runnableModule)
					await execAsync(sevenBin, [ 'u', bundle, modulePath ], { cwd: tmpDir })
					await spawn('libreoffice', [ '--headless', '--view', bundle, `macro://./${expression}` ], { stdio: 'inherit' })
				})
			}
		})
	
	.parse(process.argv, { lazy: true })

;(async () => {
	try {
		if (program === undefined) {
			return
		}
		const { name, handler, args } = program
		await handler(...args)
	} catch (error) {
		console.error(error.message)
	}
})()
