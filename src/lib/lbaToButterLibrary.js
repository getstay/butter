const lbaToButterComponentConverters = {
	dialog: v => v,
	module: (({ contents, name, type }) => ({ name, extension: '.vb', contents: extractModuleScript(contents), type }))
}

module.exports = ({ name, components }) => ({
	name,
	components: components.map(component => lbaToButterComponentConverters[component.type](component))
})
