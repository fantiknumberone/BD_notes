import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import Interactive from "./Interactive"

const config = await loadQuartzConfig()
export default config

// Keep components from YAML and append the local course widgets to the page.
const currentLayout = await loadQuartzLayout()
export const layout = await loadQuartzLayout({
  defaults: {
    afterBody: [...(currentLayout.defaults.afterBody ?? []), Interactive()],
  },
})
