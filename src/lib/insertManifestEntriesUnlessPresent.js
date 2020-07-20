const fs = require('fs')
const xmlParser = require('fast-xml-parser')

const xmlParserOptions = {
	ignoreAttributes: false
}

const uniqueInsertManifestEntries = ({ manifest, entryPaths }) => {
	const header = manifest.split('\n').slice(0, 1)
	const json = xmlParser.parse(manifest, xmlParserOptions, true)
	const entries = json['manifest:manifest']['manifest:file-entry']
	const existingPaths = entries.map(entry => entry['@_manifest:full-path'])
	const missingPaths = entryPaths.filter(entryPath => !existingPaths.includes(entryPath))
	if (!missingPaths.length) {
		return { value: manifest, modified: false }
	}
	missingPaths.forEach(entryPath =>
		entries.push({
			'@_manifest:full-path': entryPath,
			'@_manifest:media-type': 'text/xml'
		})
	)
	const updatedManifest = [
		...header,
		new xmlParser.j2xParser({ ...xmlParserOptions, format: true, indentBy: ' ', ignoreAttributes: false, supressEmptyNode: true }).parse(json)
	].join('\n')
	return { value: updatedManifest, modified: true }
}

module.exports = async ({ manifestFilepath, entryPaths }) => {
	const manifest = await fs.promises.readFile(manifestFilepath, 'utf8')
	const { value: contents, modified } = uniqueInsertManifestEntries({ manifest, entryPaths })
	if (modified) {
		await fs.promises.writeFile(manifestFilepath, contents)
	}
	return manifestFilepath
}
