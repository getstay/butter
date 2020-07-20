const he = require('he')

const escapeXml = xml => he.escape(xml, { strict: true })

module.exports = ({ moduleName, script }) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE script:module PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "module.dtd">
<script:module xmlns:script="http://openoffice.org/2000/script" script:name="${moduleName}" script:language="StarBasic" script:moduleType="normal">${escapeXml(script)}
</script:module>`
