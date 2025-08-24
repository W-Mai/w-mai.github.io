import {defineEcConfig} from '@astrojs/starlight/expressive-code'
import {pluginFrames, pluginTextMarkers} from '@astrojs/starlight/expressive-code'

export default defineEcConfig({
    plugins: [pluginFrames(), pluginTextMarkers()],
})
