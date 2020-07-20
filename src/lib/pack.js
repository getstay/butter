const fs = require('fs-extra')
const path = require('path')
const execAsync = require('util').promisify(require('child_process').execFile)
const { path7za: sevenBin } = require('7zip-bin')
const useTmpDir = require('@m59/use-tmp-dir')
const describeLibraries = require('./describeLibraries.js')
const lbaLibraryToEmbeddedContentsList = require('./lbaLibraryToEmbeddedContentsList.js')
const butterToLbaLibrary = require('./butterToLbaLibrary.js')
const insertLibraryEntriesUnlessPresent = require('./insertLibraryEntriesUnlessPresent.js')
const insertManifestEntriesUnlessPresent = require('./insertManifestEntriesUnlessPresent.js')
const libraryPackTemplateFilepath = path.join(__dirname, '../../library-pack-template.odt')

module.exports = async ({ outputFilepath, libraryPath, libraryNames = [], modify = false }) => {
	outputFilepath = path.resolve(outputFilepath)
	const existingOutputFile = await fs.stat(outputFilepath)
		.catch(error => error.code === 'ENOENT' ? null : (() => { throw error })())
	const contentsLists = await (await describeLibraries({ libraryPath, libraryNames, moduleFileExtension: '.vb' }))
		.map(library => ({ name: library.name, contentsList: lbaLibraryToEmbeddedContentsList((butterToLbaLibrary(library))) }))
	const manifestEntry = 'META-INF/manifest.xml'
	await useTmpDir(async tmpDir => {
		await execAsync(sevenBin, [
			'x',
			`-o${tmpDir}`,
			existingOutputFile ? outputFilepath : libraryPackTemplateFilepath,
			manifestEntry,
			'Basic/script-lc.xml',
			'Dialogs/dialog-lc.xml'
		])
		const entryPaths = await Promise.all([
			...contentsLists
				.flatMap(({ name, contentsList }) => contentsList)
				.map(async ({ name, contents }) => {
					await fs.outputFile(path.join(tmpDir, name), contents)
					return name
				}),
			...([ 'script', 'dialog' ].map(async componentType =>
				insertLibraryEntriesUnlessPresent({
					libraryPath: tmpDir,
					libraryNames,
					target: 'embed',
					componentType
				})
			))
		])
		await insertManifestEntriesUnlessPresent({
			manifestFilepath: path.join(tmpDir, manifestEntry),
			entryPaths
		})
		if (!(existingOutputFile && modify)) {
			await fs.copy(libraryPackTemplateFilepath, outputFilepath)
		}
		await execAsync(sevenBin, [ 'u', outputFilepath, manifestEntry, ...entryPaths ], { cwd: tmpDir })
	})
	return outputFilepath
}
