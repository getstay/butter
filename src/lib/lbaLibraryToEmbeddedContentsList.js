const Xlb = require('./Xlb.js')

const typeDirMap = {
	module: 'Basic',
	dialog: 'Dialogs'
}

module.exports = ({ name: libraryName, components }) => [
	{ name: `Dialogs/${libraryName}/dialog-lb.xml`, contents: Xlb({ libraryName, elements: components.filter(({ type }) => type === 'dialog') }) },
	{ name: `Basic/${libraryName}/script-lb.xml`, contents: Xlb({ libraryName, elements: components.filter(({ type }) => type === 'module') }) },
	...components.map(({ name, extension, contents, type }) => ({ name: `${typeDirMap[type]}/${libraryName}/${name}.xml`, contents }))
]
