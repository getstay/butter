const xmlParser = require('fast-xml-parser')
const he = require('he')

const parseModuleXml = xml => xmlParser.parse(xml, {
	tagValueProcessor : value => he.decode(value, { strict: true })
})
module.exports = moduleXml => parseModuleXml(moduleXml)['script:module']
