const fs = require('fs')
const path = require('path')
const getLibraryNamesInDir = require('./getLibraryNamesInDir.js')

const getLibraryComponentsInDir = async ({ libraryDir, moduleFileExtension }) => {
	const componentTypes = [
		{ name: 'dialog', extension: '.xdl' },
		{ name: 'module', extension: moduleFileExtension }
	]
	const componentExtensions = componentTypes.map(({ extension }) => extension)
	return await Promise.all(
		(await fs.promises.readdir(libraryDir, { withFileTypes: true }))
			.filter(stats => stats.isFile() && componentExtensions.includes(path.extname(stats.name)))
			.map(async ({ name }) => {
				const componentPath = path.join(libraryDir, name)
				const extension = path.extname(name)
				return {
					extension,
					contents: await fs.promises.readFile(componentPath, 'utf8'),
					name: path.basename(name, extension),
					path: componentPath,
					type: componentTypes.find(type => type.extension === extension).name
				}
			})
	)
}

module.exports = async ({ libraryPath, libraryNames, moduleFileExtension }) => {
	const availableLibraryNames = await getLibraryNamesInDir(libraryPath)
	if (availableLibraryNames.length === 0) {
		throw new Error(`There are no libraries in library path ${libraryPath}.`)
	}
	const missingLibraries = libraryNames.filter(name => !availableLibraryNames.includes(name))
	if (missingLibraries.length) {
			throw new Error(`The following libraries were not found in "${libraryPath}": ${missingLibraries.join(',')}`)
	}
	const selectedLibraryNames = libraryNames.length ? libraryNames : availableLibraryNames
	return Promise.all(selectedLibraryNames.map(async name => {
		const libraryDir = path.join(libraryPath, name)
		return {
			name,
			path: libraryDir,
			components: await getLibraryComponentsInDir({ libraryDir, moduleFileExtension })
		}
	}))
}
