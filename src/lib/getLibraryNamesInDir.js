const fs = require('fs')

module.exports = async libraryPath => {
	try {
		const contents = await fs.promises.readdir(libraryPath, { withFileTypes: true })
		const directories = contents.filter(stats => stats.isDirectory())
		return directories.map(({ name }) => name)
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(`Library path "${libraryPath}" does not exist.`)
		}
		if (error.code === 'ENOTDIR') {
			throw new Error(`Library path "${libraryPath}" is not a directory.`)
		}
		throw error
	}
}
