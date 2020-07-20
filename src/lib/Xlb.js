module.exports = ({ libraryName, elements }) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE library:library PUBLIC "-//OpenOffice.org//DTD OfficeDocument 1.0//EN" "library.dtd">
<library:library xmlns:library="http://openoffice.org/2000/library" library:name="${libraryName}" library:readonly="false" library:passwordprotected="false">
${elements.map(({ name }) => ` <library:element library:name="${name}"/>`).join('\n')}
</library:library>`
