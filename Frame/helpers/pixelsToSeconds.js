
const getStepLimits = selectorMinStepSeconds => selectorMinStepSeconds > 0 ? selectorMinStepSeconds : 0


export default function pixelsToSeconds(positionInPixels, timeScaleState) {
    const { pixelsPerDivision, timelineStep } = timeScaleState
    // const step = getStepLimits(timelineStep)
    // return parseFloat((Math.round(positionInPixels / pixelsPerDivision / step) * step).toFixed(3))
    return positionInPixels / pixelsPerDivision
}
