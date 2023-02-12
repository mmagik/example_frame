
import secondsToPixels from "./secondsToPixels"


// export default function layerStartPx(frameStartSeconds, layerStartSeconds, timeScaleState) {
//     const frameStartPx = secondsToPixels(frameStartSeconds, timeScaleState)
//     return secondsToPixels(layerStartSeconds, timeScaleState) + frameStartPx + timeScaleState.scaleLeftMargin
// }

export default function layerStartPx(layerStartSeconds, timeScaleState) {
    return secondsToPixels(layerStartSeconds, timeScaleState) + timeScaleState.scaleLeftMargin
}
