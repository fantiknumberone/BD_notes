import type { QuartzComponent, QuartzComponentConstructor } from "./quartz/components/types"
// @ts-ignore -- Quartz bundles *.inline.ts imports as browser script strings.
import script from "./quartz/components/scripts/interactive.inline"
import style from "./quartz/components/styles/interactive.scss"

const Interactive: QuartzComponent = () => null
Interactive.afterDOMLoaded = script
Interactive.css = style

export default (() => Interactive) satisfies QuartzComponentConstructor
