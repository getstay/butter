const fs = require('fs')
const path = require('path')
const xmlParser = require('fast-xml-parser')
const R = require('ramda')

/*
 * user profile format
 * <library:library library:name="MyLibrary" xlink:href="$(USER)/basic/MyLibrary/script.xlb/" xlink:type="simple" library:link="false"/>
 *
 * embedded format
 * <library:library library:name="Standard" library:link="false"/>
 */

const EmptyXlc = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:libraries PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "libraries.dtd">
<library:libraries xmlns:library="http://openoffice.org/2000/library" xmlns:xlink="http://www.w3.org/1999/xlink">
</library:libraries>
`.trim()

const createBaseLibraryEntry = ({ libraryName }) => ({
	'@_library:name': libraryName,
	'@_library:link': 'false'
})

const createUserProfileLibraryEntry = ({ libraryName, componentType }) => ({
	...createBaseLibraryEntry({ libraryName }),
	'@_xlink:href': `$(USER)/basic/${libraryName}/${componentType}.xlb/`,
	'@_xlink:type': 'simple',
})

const xmlParserOptions = {
	ignoreAttributes: false
}

const uniqueInsertLibraryEntries = ({ xlc, createEntry, componentType, libraryNames }) => {
	const header = xlc.split('\n').slice(0, 2)
	const librariesPath = [ 'library:libraries', 'library:library' ]
	const librariesLens = R.lensPath(librariesPath)
	const json = R.pipe
		(
			xlc => xmlParser.parse(xlc, xmlParserOptions, true),
			R.over(
				librariesLens,
				R.cond([
					[ Array.isArray, R.identity ],
					[ R.isNil, () => [] ],
					[ R.T, Array.of ]
				])
			)
		)
		(xlc)
	const existingLibraryNames = R.path(librariesPath, json).map(library => library['@_library:name'])
	const missingLibraryNames = libraryNames.filter(name => !existingLibraryNames.includes(name))
	if (!missingLibraryNames.length) {
		return { value: xlc, modified: false }
	}
	const newEntries = missingLibraryNames.map(libraryName => createEntry({ libraryName, componentType }))
	const updatedJson = R.over(librariesLens, libraries => [ ...libraries, ...newEntries ], json)
	const updatedXlc = [
		...header,
		new xmlParser.j2xParser({ ...xmlParserOptions, format: true, indentBy: ' ', ignoreAttributes: false, supressEmptyNode: true }).parse(updatedJson)
	].join('\n')
	return { value: updatedXlc, modified: true }
}


const embeddedTypeDirMap = {
	script: 'Basic',
	dialog: 'Dialogs'
}

const targetParameters = {
	user_profile: ({ componentType }) => ({
		filename: `${componentType}.xlc`,
		createEntry: createUserProfileLibraryEntry
	}),
	embed: ({ componentType }) => ({
		filename: `${embeddedTypeDirMap[componentType]}/${componentType}-lc.xml`,
		createEntry: createBaseLibraryEntry
	})
}

module.exports = async ({ libraryNames, libraryPath, componentType, target }) => {
	const { filename, createEntry } = targetParameters[target]({ componentType })
	const filepath = path.join(libraryPath, filename)
	const xlc = await fs.promises.readFile(filepath, 'utf8')
		.catch(error => {
			if (error.code === 'ENOENT') {
				return EmptyXlc
			}
			throw error
		})
	const { value: contents, modified } = uniqueInsertLibraryEntries({ xlc, createEntry, componentType, libraryNames })
	if (modified) {
		await fs.promises.writeFile(filepath, contents)
	}
	return filename
}
