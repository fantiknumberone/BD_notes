import type { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore -- Quartz turns *.inline.ts imports into bundled script strings.
import script from "./scripts/interactive.inline"
import style from "./styles/interactive.scss"

const Interactive: QuartzComponent = () => null
Interactive.afterDOMLoaded = script
Interactive.css = style

export default (() => Interactive) satisfies QuartzComponentConstructor
