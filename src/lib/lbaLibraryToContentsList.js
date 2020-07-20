const Xlb = require('./Xlb.js')

module.exports = ({ name: libraryName, components }) => [
	{ name: 'dialog.xlb', contents: Xlb({ libraryName, elements: components.filter(({ type }) => type === 'dialog') }) },
	{ name: 'script.xlb', contents: Xlb({ libraryName, elements: components.filter(({ type }) => type === 'module') }) },
	...components.map(({ name, extension, contents }) => ({ name: `${name}${extension}`, contents }))
]
