const Xba = require('./Xba.js')

const butterToLbaComponentConverters = {
	dialog: v => v,
	module: (({ contents, name, type }) => ({ name, extension: '.xba', contents: Xba({ moduleName: name, script: contents }), type }))
}

module.exports = ({ name, components }) => ({
	name,
	components: components.map(component => butterToLbaComponentConverters[component.type](component))
})
